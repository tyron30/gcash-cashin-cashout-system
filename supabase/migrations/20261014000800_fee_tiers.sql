-- =====================================================================
-- GCash Monitor - Migration 8: service fees (charges) for cash-in / cash-out
--
-- The owner defines a fee table, for example:
--     up to   100  ->  fee 10
--     up to   500  ->  fee 15
-- Each tier covers amounts above the previous tier up to its own limit
-- (so 1-100 = 10, 101-500 = 15). There can be no gaps or overlaps.
-- The fee is the SAME for cash-in and cash-out, and the customer pays
-- amount + fee (500 + 15 = 515).
--
-- * The DATABASE works out the fee. Staff cannot choose or change it.
-- * Every transaction keeps the fee it was charged. Changing the fee table
--   later only affects NEW transactions.
-- * Fees are reported separately from the money moved (voided excluded).
--
-- Run this ONCE in the SQL Editor after migrations 1-7.
-- (Fresh projects get it through setup_all.sql.)
-- =====================================================================

-- ---------- The fee table (owner-controlled) ----------
create table public.fee_tiers (
  id          uuid primary key default gen_random_uuid(),
  max_amount  numeric(12, 2) not null,
  fee_amount  numeric(12, 2) not null,
  created_at  timestamptz not null default now(),
  constraint fee_tiers_max_check check (max_amount > 0 and max_amount <= 999999.99),
  constraint fee_tiers_fee_check check (fee_amount >= 0 and fee_amount <= 999999.99),
  constraint fee_tiers_max_unique unique (max_amount)
);

alter table public.fee_tiers enable row level security;

-- Everyone logged in and active may READ the table (the form shows the fee).
create policy fee_tiers_select
  on public.fee_tiers for select to authenticated
  using ((select public.is_active_user()));

revoke all on public.fee_tiers from anon, authenticated;
grant select on public.fee_tiers to authenticated;
-- No write policy and no write permission: only save_fee_tiers() can change it.

-- ---------- The fee each transaction was charged ----------
alter table public.transactions add column fee_amount numeric(12, 2) not null default 0;
alter table public.transactions add constraint transactions_fee_check
  check (fee_amount >= 0 and fee_amount <= 999999.99);
-- What the customer paid in total. Calculated by the database, cannot be faked.
alter table public.transactions add column total_amount numeric(12, 2)
  generated always as (amount + fee_amount) stored;

-- ---------- Looking up a fee (internal) ----------
-- The first tier whose limit is at or above the amount. NULL = no tier covers it.
create or replace function public.fee_for_amount(p_amount numeric)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select t.fee_amount
  from public.fee_tiers t
  where t.max_amount >= p_amount
  order by t.max_amount
  limit 1;
$$;
revoke execute on function public.fee_for_amount(numeric) from public, anon, authenticated;

-- ---------- Owner: replace the whole fee table in one safe step ----------
create or replace function public.save_fee_tiers(p_tiers jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item   jsonb;
  v_max    numeric;
  v_fee    numeric;
  v_before jsonb;
  v_after  jsonb;
  v_count  integer;
begin
  perform public.assert_admin();

  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' then
    raise exception 'The fee table must be a list.';
  end if;
  if jsonb_array_length(p_tiers) > 50 then
    raise exception 'You can have at most 50 fee tiers.';
  end if;

  for v_item in select value from jsonb_array_elements(p_tiers) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item ->> 'max_amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       or coalesce(v_item ->> 'fee_amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception 'Each fee tier needs an "up to" amount and a fee (numbers with at most 2 decimals).';
    end if;
    v_max := (v_item ->> 'max_amount')::numeric;
    v_fee := (v_item ->> 'fee_amount')::numeric;
    if v_max <= 0 or v_max > 999999.99 then
      raise exception 'An "up to" amount must be between 0.01 and 999,999.99.';
    end if;
    if v_fee > 999999.99 then
      raise exception 'A fee cannot be more than 999,999.99.';
    end if;
  end loop;

  if (select count(*) from jsonb_array_elements(p_tiers))
     <> (select count(distinct (value ->> 'max_amount')::numeric) from jsonb_array_elements(p_tiers)) then
    raise exception 'Two tiers have the same "up to" amount. Each tier needs its own limit.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('max_amount', t.max_amount, 'fee_amount', t.fee_amount)
                            order by t.max_amount), '[]'::jsonb)
    into v_before from public.fee_tiers t;

  delete from public.fee_tiers where true;

  insert into public.fee_tiers (max_amount, fee_amount)
  select (value ->> 'max_amount')::numeric, (value ->> 'fee_amount')::numeric
  from jsonb_array_elements(p_tiers);
  get diagnostics v_count = row_count;

  select coalesce(jsonb_agg(jsonb_build_object('max_amount', t.max_amount, 'fee_amount', t.fee_amount)
                            order by t.max_amount), '[]'::jsonb)
    into v_after from public.fee_tiers t;

  perform public.write_audit_log('fee_tiers.updated', 'fee_tiers', null, null,
    jsonb_build_object('tiers', v_before), jsonb_build_object('tiers', v_after));

  return v_count;
end;
$$;
revoke execute on function public.save_fee_tiers(jsonb) from public, anon, authenticated;
grant execute on function public.save_fee_tiers(jsonb) to authenticated;

-- ---------- create_transaction: the database adds the fee ----------
drop function if exists public.create_transaction(text, text, numeric, text, text, timestamptz, uuid);

create or replace function public.create_transaction(
  p_transaction_type text,
  p_reference_number text,
  p_amount numeric,
  p_sender_receiver_name text default null,
  p_notes text default null,
  p_transaction_timestamp timestamptz default null,
  p_client_request_id uuid default null,
  p_expected_fee numeric default null   -- the fee the screen showed; refuse if it changed
)
returns public.transactions
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_row   public.transactions;
  v_ref   text := case when p_transaction_type = 'cash_out'
                       then public.normalize_reference(p_reference_number) end;
  v_name  text := nullif(btrim(regexp_replace(coalesce(p_sender_receiver_name, ''), '\s+', ' ', 'g')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_ts    timestamptz;
  v_fee   numeric;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'You are not allowed to record transactions.' using errcode = '42501';
  end if;

  -- Same form submitted twice -> return the record that already exists.
  if p_client_request_id is not null then
    select * into v_row from public.transactions t
    where t.created_by = v_uid and t.client_request_id = p_client_request_id;
    if found then
      return v_row;
    end if;
  end if;

  if p_transaction_type is null or p_transaction_type not in ('cash_in', 'cash_out') then
    raise exception 'Choose Cash In or Cash Out.';
  end if;

  perform public.validate_transaction_input(p_transaction_type, v_ref, p_amount, v_name, v_notes);

  -- The fee always comes from the owner's fee table (no tier = no fee).
  v_fee := coalesce(public.fee_for_amount(p_amount), 0);
  if p_expected_fee is not null and p_expected_fee <> v_fee then
    raise exception 'The fee for this amount is now % (the screen showed %). Please check the new total and save again.',
      v_fee, p_expected_fee;
  end if;

  -- Staff always get the server time. Only the owner may set another time.
  v_ts := coalesce(p_transaction_timestamp, now());
  if v_ts > now() + interval '2 minutes' then
    raise exception 'Date and time cannot be in the future.';
  end if;
  if p_transaction_timestamp is not null
     and abs(extract(epoch from (v_ts - now()))) > 120
     and not public.is_admin() then
    raise exception 'Only the owner can change the transaction date or time.' using errcode = '42501';
  end if;

  begin
    insert into public.transactions
      (reference_number, transaction_type, amount, fee_amount, sender_receiver_name, notes,
       transaction_timestamp, created_by, client_request_id)
    values
      (v_ref, p_transaction_type, p_amount, v_fee, v_name, v_notes,
       v_ts, v_uid, p_client_request_id)
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.transactions t
    where t.created_by = v_uid and t.client_request_id = p_client_request_id;
    if found then
      return v_row;
    end if;
    raise;
  end;

  perform public.write_audit_log('transaction.created', 'transaction', v_row.id, null, null,
    jsonb_build_object(
      'reference_number', v_row.reference_number,
      'transaction_type', v_row.transaction_type,
      'amount', v_row.amount,
      'fee_amount', v_row.fee_amount,
      'business_date', v_row.business_date));

  return v_row;
end;
$$;
revoke execute on function public.create_transaction(text, text, numeric, text, text, timestamptz, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.create_transaction(text, text, numeric, text, text, timestamptz, uuid, numeric)
  to authenticated;

-- ---------- update_transaction: the owner may also correct the fee ----------
drop function if exists public.update_transaction(uuid, text, numeric, text, text, timestamptz, text);

create or replace function public.update_transaction(
  p_id uuid,
  p_reference_number text,
  p_amount numeric,
  p_sender_receiver_name text,
  p_notes text,
  p_transaction_timestamp timestamptz,
  p_reason text,
  p_fee_amount numeric default null      -- NULL = keep the fee as it is
)
returns public.transactions
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old    public.transactions;
  v_new    public.transactions;
  v_ref    text;
  v_fee    numeric;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_name   text := nullif(btrim(regexp_replace(coalesce(p_sender_receiver_name, ''), '\s+', ' ', 'g')), '');
  v_notes  text := nullif(btrim(coalesce(p_notes, '')), '');
  v_ts     timestamptz := p_transaction_timestamp;
begin
  perform public.assert_admin();

  if char_length(v_reason) < 5 then
    raise exception 'Enter a reason (at least 5 characters).';
  end if;
  if v_ts is null then
    raise exception 'Date and time are required.';
  end if;
  if v_ts > now() + interval '2 minutes' then
    raise exception 'Date and time cannot be in the future.';
  end if;

  select * into v_old from public.transactions t where t.id = p_id for update;
  if not found then
    raise exception 'Transaction not found.';
  end if;
  if v_old.status = 'voided' then
    raise exception 'Voided transactions cannot be edited.';
  end if;

  v_ref := case when v_old.transaction_type = 'cash_out'
                then public.normalize_reference(p_reference_number)
                else v_old.reference_number end;

  v_fee := coalesce(p_fee_amount, v_old.fee_amount);
  if v_fee < 0 or v_fee > 999999.99 or round(v_fee, 2) <> v_fee then
    raise exception 'The fee must be between 0 and 999,999.99 with at most 2 decimals.';
  end if;

  perform public.validate_transaction_input(v_old.transaction_type, v_ref, p_amount, v_name, v_notes);

  if (v_old.reference_number, v_old.amount, v_old.fee_amount, v_old.sender_receiver_name, v_old.notes, v_old.transaction_timestamp)
     is not distinct from (v_ref, p_amount, v_fee, v_name, v_notes, v_ts) then
    raise exception 'Nothing was changed.';
  end if;

  update public.transactions t
     set reference_number = v_ref,
         amount = p_amount,
         fee_amount = v_fee,
         sender_receiver_name = v_name,
         notes = v_notes,
         transaction_timestamp = v_ts,
         updated_by = auth.uid()
   where t.id = p_id
  returning * into v_new;

  perform public.write_audit_log('transaction.updated', 'transaction', p_id, v_reason,
    jsonb_build_object(
      'reference_number', v_old.reference_number, 'amount', v_old.amount, 'fee_amount', v_old.fee_amount,
      'sender_receiver_name', v_old.sender_receiver_name, 'notes', v_old.notes,
      'transaction_timestamp', v_old.transaction_timestamp, 'business_date', v_old.business_date),
    jsonb_build_object(
      'reference_number', v_new.reference_number, 'amount', v_new.amount, 'fee_amount', v_new.fee_amount,
      'sender_receiver_name', v_new.sender_receiver_name, 'notes', v_new.notes,
      'transaction_timestamp', v_new.transaction_timestamp, 'business_date', v_new.business_date));

  return v_new;
end;
$$;
revoke execute on function public.update_transaction(uuid, text, numeric, text, text, timestamptz, text, numeric)
  from public, anon, authenticated;
grant execute on function public.update_transaction(uuid, text, numeric, text, text, timestamptz, text, numeric)
  to authenticated;

-- ---------- Totals now include fees collected (voided never counted) ----------
drop function if exists public.daily_totals(date, date, text);

create or replace function public.daily_totals(p_from date, p_to date, p_type text default null)
returns table (
  business_date date,
  cash_in_total numeric,
  cash_out_total numeric,
  cash_in_count integer,
  cash_out_count integer,
  voided_count integer,
  fee_total numeric
)
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a valid date range.';
  end if;
  if p_to - p_from > 91 then
    raise exception 'Choose a date range of 92 days or less.';
  end if;
  if p_type is not null and p_type not in ('cash_in', 'cash_out') then
    raise exception 'Invalid transaction type.';
  end if;

  return query
  select
    (p_from + g)::date,
    coalesce(sum(t.amount) filter (where t.status = 'completed' and t.transaction_type = 'cash_in'), 0)::numeric,
    coalesce(sum(t.amount) filter (where t.status = 'completed' and t.transaction_type = 'cash_out'), 0)::numeric,
    (count(*) filter (where t.status = 'completed' and t.transaction_type = 'cash_in'))::integer,
    (count(*) filter (where t.status = 'completed' and t.transaction_type = 'cash_out'))::integer,
    (count(*) filter (where t.status = 'voided'))::integer,
    coalesce(sum(t.fee_amount) filter (where t.status = 'completed'), 0)::numeric
  from generate_series(0, p_to - p_from) as g
  left join public.transactions t
    on t.business_date = p_from + g
   and (p_type is null or t.transaction_type = p_type)
  group by g
  order by g;
end;
$$;
revoke execute on function public.daily_totals(date, date, text) from public, anon, authenticated;
grant execute on function public.daily_totals(date, date, text) to authenticated;

drop function if exists public.staff_totals(date);

create or replace function public.staff_totals(p_business_date date)
returns table (
  staff_id uuid,
  staff_name text,
  cash_in_total numeric,
  cash_out_total numeric,
  cash_in_count integer,
  cash_out_count integer,
  voided_count integer,
  fee_total numeric
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  -- security definer, so the owner check below runs first and is the gate.
  perform public.assert_admin();

  return query
  select
    t.created_by,
    p.full_name,
    coalesce(sum(t.amount) filter (where t.status = 'completed' and t.transaction_type = 'cash_in'), 0)::numeric,
    coalesce(sum(t.amount) filter (where t.status = 'completed' and t.transaction_type = 'cash_out'), 0)::numeric,
    (count(*) filter (where t.status = 'completed' and t.transaction_type = 'cash_in'))::integer,
    (count(*) filter (where t.status = 'completed' and t.transaction_type = 'cash_out'))::integer,
    (count(*) filter (where t.status = 'voided'))::integer,
    coalesce(sum(t.fee_amount) filter (where t.status = 'completed'), 0)::numeric
  from public.transactions t
  join public.profiles p on p.id = t.created_by
  where t.business_date = p_business_date
  group by t.created_by, p.full_name
  order by p.full_name;
end;
$$;
revoke execute on function public.staff_totals(date) from public, anon, authenticated;
grant execute on function public.staff_totals(date) to authenticated;

drop function if exists public.transaction_summary(date, date, text, text, uuid, text);

create or replace function public.transaction_summary(
  p_from date,
  p_to date,
  p_type text default null,
  p_status text default null,
  p_staff uuid default null,
  p_search text default null
)
returns table (
  total_count bigint,
  cash_in_total numeric,
  cash_out_total numeric,
  cash_in_count integer,
  cash_out_count integer,
  voided_count integer,
  fee_total numeric
)
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_key    text := upper(regexp_replace(coalesce(v_search, ''), '[^A-Za-z0-9]', '', 'g'));
  v_like   text := lower(replace(replace(replace(coalesce(v_search, ''), '\', '\\'), '%', '\%'), '_', '\_'));
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a valid date range.';
  end if;
  if p_to - p_from > 91 then
    raise exception 'Choose a date range of 92 days or less.';
  end if;
  if p_type is not null and p_type not in ('cash_in', 'cash_out') then
    raise exception 'Invalid transaction type.';
  end if;
  if p_status is not null and p_status not in ('completed', 'voided') then
    raise exception 'Invalid status.';
  end if;

  return query
  select
    count(*),
    coalesce(sum(t.amount) filter (where t.status = 'completed' and t.transaction_type = 'cash_in'), 0)::numeric,
    coalesce(sum(t.amount) filter (where t.status = 'completed' and t.transaction_type = 'cash_out'), 0)::numeric,
    (count(*) filter (where t.status = 'completed' and t.transaction_type = 'cash_in'))::integer,
    (count(*) filter (where t.status = 'completed' and t.transaction_type = 'cash_out'))::integer,
    (count(*) filter (where t.status = 'voided'))::integer,
    coalesce(sum(t.fee_amount) filter (where t.status = 'completed'), 0)::numeric
  from public.transactions t
  where t.business_date between p_from and p_to
    and (p_type is null or t.transaction_type = p_type)
    and (p_status is null or t.status = p_status)
    and (p_staff is null or t.created_by = p_staff)
    and (v_search is null
         or (v_key <> '' and t.reference_key like '%' || v_key || '%')
         or lower(coalesce(t.sender_receiver_name, '')) like '%' || v_like || '%');
end;
$$;
revoke execute on function public.transaction_summary(date, date, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.transaction_summary(date, date, text, text, uuid, text) to authenticated;

drop function if exists public.search_transactions(date, date, text, text, uuid, text, text, integer, integer);

create or replace function public.search_transactions(
  p_from date,
  p_to date,
  p_type text default null,
  p_status text default null,
  p_staff uuid default null,
  p_search text default null,
  p_sort text default 'newest',
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id uuid,
  reference_number text,
  transaction_type text,
  amount numeric,
  sender_receiver_name text,
  notes text,
  transaction_timestamp timestamptz,
  business_date date,
  status text,
  void_reason text,
  created_by uuid,
  staff_name text,
  created_at timestamptz,
  updated_at timestamptz,
  fee_amount numeric,
  total_amount numeric
)
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_key    text := upper(regexp_replace(coalesce(v_search, ''), '[^A-Za-z0-9]', '', 'g'));
  v_like   text := lower(replace(replace(replace(coalesce(v_search, ''), '\', '\\'), '%', '\%'), '_', '\_'));
  v_limit  integer := least(greatest(coalesce(p_limit, 10), 1), 1000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a valid date range.';
  end if;
  if p_to - p_from > 91 then
    raise exception 'Choose a date range of 92 days or less.';
  end if;
  if p_type is not null and p_type not in ('cash_in', 'cash_out') then
    raise exception 'Invalid transaction type.';
  end if;
  if p_status is not null and p_status not in ('completed', 'voided') then
    raise exception 'Invalid status.';
  end if;

  return query
  select t.id, t.reference_number, t.transaction_type, t.amount, t.sender_receiver_name, t.notes,
         t.transaction_timestamp, t.business_date, t.status, t.void_reason,
         t.created_by, p.full_name, t.created_at, t.updated_at,
         t.fee_amount, t.total_amount
  from public.transactions t
  join public.profiles p on p.id = t.created_by
  where t.business_date between p_from and p_to
    and (p_type is null or t.transaction_type = p_type)
    and (p_status is null or t.status = p_status)
    and (p_staff is null or t.created_by = p_staff)
    and (v_search is null
         or (v_key <> '' and t.reference_key like '%' || v_key || '%')
         or lower(coalesce(t.sender_receiver_name, '')) like '%' || v_like || '%')
  order by
    case when p_sort = 'oldest' then t.transaction_timestamp end asc,
    t.transaction_timestamp desc,
    t.id
  limit v_limit offset v_offset;
end;
$$;
revoke execute on function public.search_transactions(date, date, text, text, uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_transactions(date, date, text, text, uuid, text, text, integer, integer)
  to authenticated;
