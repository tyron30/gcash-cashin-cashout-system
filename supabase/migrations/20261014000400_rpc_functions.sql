-- =====================================================================
-- GCash Monitor - Migration 4 of 5: approved database functions (RPC)
-- The app calls these instead of writing to tables. Each one:
--   * checks who is calling (auth.uid()) and their role,
--   * validates the data again (never trust the browser),
--   * writes the audit log in the same transaction.
-- "security definer" = runs with the owner's rights, so it can write to
-- tables that users cannot write to directly.
-- =====================================================================

-- ---------- Shared validation (internal) ----------
create or replace function public.validate_transaction_fields(
  p_reference text,
  p_amount numeric,
  p_name text,
  p_notes text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if upper(regexp_replace(coalesce(p_reference, ''), '\s+', '', 'g')) !~ '^[A-Z0-9]{8,20}$' then
    raise exception 'Enter a valid reference number (8 to 20 letters or numbers).';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;
  if p_amount > 999999.99 then
    raise exception 'Amount is too large. The maximum is 999,999.99.';
  end if;
  if round(p_amount, 2) <> p_amount then
    raise exception 'Amount can have at most 2 decimal places.';
  end if;

  if p_name is not null and (char_length(p_name) > 60 or p_name ~ '[[:cntrl:]]') then
    raise exception 'The name must be 60 characters or fewer.';
  end if;
  if p_notes is not null and (char_length(p_notes) > 200 or p_notes ~ '[[:cntrl:]]') then
    raise exception 'Notes must be 200 characters or fewer.';
  end if;
end;
$$;

-- ---------- create_transaction ----------
create or replace function public.create_transaction(
  p_transaction_type text,
  p_reference_number text,
  p_amount numeric,
  p_sender_receiver_name text default null,
  p_notes text default null,
  p_transaction_timestamp timestamptz default null,
  p_client_request_id uuid default null
)
returns public.transactions
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_row   public.transactions;
  v_ref   text := public.normalize_reference(p_reference_number);
  v_name  text := nullif(btrim(regexp_replace(coalesce(p_sender_receiver_name, ''), '\s+', ' ', 'g')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_ts    timestamptz;
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

  perform public.validate_transaction_fields(v_ref, p_amount, v_name, v_notes);

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
      (reference_number, transaction_type, amount, sender_receiver_name, notes,
       transaction_timestamp, created_by, client_request_id)
    values
      (v_ref, p_transaction_type, p_amount, v_name, v_notes,
       v_ts, v_uid, p_client_request_id)
    returning * into v_row;
  exception when unique_violation then
    -- Two identical requests arrived at the same moment. Keep the first.
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
      'business_date', v_row.business_date));

  return v_row;
end;
$$;

-- ---------- update_transaction (owner only) ----------
create or replace function public.update_transaction(
  p_id uuid,
  p_reference_number text,
  p_amount numeric,
  p_sender_receiver_name text,
  p_notes text,
  p_transaction_timestamp timestamptz,
  p_reason text
)
returns public.transactions
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old    public.transactions;
  v_new    public.transactions;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_ref    text := public.normalize_reference(p_reference_number);
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

  perform public.validate_transaction_fields(v_ref, p_amount, v_name, v_notes);

  if (v_old.reference_number, v_old.amount, v_old.sender_receiver_name, v_old.notes, v_old.transaction_timestamp)
     is not distinct from (v_ref, p_amount, v_name, v_notes, v_ts) then
    raise exception 'Nothing was changed.';
  end if;

  update public.transactions t
     set reference_number = v_ref,
         amount = p_amount,
         sender_receiver_name = v_name,
         notes = v_notes,
         transaction_timestamp = v_ts,
         updated_by = auth.uid()
   where t.id = p_id
  returning * into v_new;

  perform public.write_audit_log('transaction.updated', 'transaction', p_id, v_reason,
    jsonb_build_object(
      'reference_number', v_old.reference_number, 'amount', v_old.amount,
      'sender_receiver_name', v_old.sender_receiver_name, 'notes', v_old.notes,
      'transaction_timestamp', v_old.transaction_timestamp, 'business_date', v_old.business_date),
    jsonb_build_object(
      'reference_number', v_new.reference_number, 'amount', v_new.amount,
      'sender_receiver_name', v_new.sender_receiver_name, 'notes', v_new.notes,
      'transaction_timestamp', v_new.transaction_timestamp, 'business_date', v_new.business_date));

  return v_new;
end;
$$;

-- ---------- void_transaction (owner only) ----------
-- The record is kept. It is marked voided and drops out of all totals.
create or replace function public.void_transaction(p_id uuid, p_reason text)
returns public.transactions
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old    public.transactions;
  v_new    public.transactions;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform public.assert_admin();

  if char_length(v_reason) < 5 then
    raise exception 'Enter a reason (at least 5 characters).';
  end if;

  select * into v_old from public.transactions t where t.id = p_id for update;
  if not found then
    raise exception 'Transaction not found.';
  end if;
  if v_old.status = 'voided' then
    raise exception 'This transaction is already voided.';
  end if;

  update public.transactions t
     set status = 'voided',
         void_reason = v_reason,
         voided_at = now(),
         voided_by = auth.uid(),
         updated_by = auth.uid()
   where t.id = p_id
  returning * into v_new;

  perform public.write_audit_log('transaction.voided', 'transaction', p_id, v_reason,
    jsonb_build_object('status', v_old.status, 'amount', v_old.amount, 'reference_number', v_old.reference_number),
    jsonb_build_object('status', v_new.status));

  return v_new;
end;
$$;

-- ---------- Duplicate reference warning ----------
-- Staff cannot SEE old records, but they should still be warned when a
-- receipt is reused. This returns only a few safe fields, and the record id
-- only when the caller is allowed to open that record.
create or replace function public.find_duplicate_references(
  p_reference_number text,
  p_exclude_id uuid default null
)
returns table (
  id uuid,
  business_date date,
  transaction_type text,
  amount numeric,
  transaction_timestamp timestamptz,
  staff_name text
)
language sql stable security definer
set search_path = ''
as $$
  select
    case when public.is_admin()
              or t.business_date >= public.current_business_date() - public.staff_history_days()
         then t.id end,
    t.business_date,
    t.transaction_type,
    t.amount,
    t.transaction_timestamp,
    p.full_name
  from public.transactions t
  join public.profiles p on p.id = t.created_by
  where public.is_active_user()
    and t.reference_key = upper(regexp_replace(coalesce(p_reference_number, ''), '\s+', '', 'g'))
    and t.status = 'completed'
    and (p_exclude_id is null or t.id <> p_exclude_id)
  order by t.transaction_timestamp desc
  limit 10;
$$;

-- ---------- Totals ----------
-- "security invoker" = Row Level Security still applies. Staff asking for an
-- old date simply get zeros. Voided transactions are never counted.
create or replace function public.daily_totals(p_from date, p_to date, p_type text default null)
returns table (
  business_date date,
  cash_in_total numeric,
  cash_out_total numeric,
  cash_in_count integer,
  cash_out_count integer,
  voided_count integer
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
    (count(*) filter (where t.status = 'voided'))::integer
  from generate_series(0, p_to - p_from) as g
  left join public.transactions t
    on t.business_date = p_from + g
   and (p_type is null or t.transaction_type = p_type)
  group by g
  order by g;
end;
$$;

-- Totals per staff member for one day (owner only; checked inside).
create or replace function public.staff_totals(p_business_date date)
returns table (
  staff_id uuid,
  staff_name text,
  cash_in_total numeric,
  cash_out_total numeric,
  cash_in_count integer,
  cash_out_count integer,
  voided_count integer
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
    (count(*) filter (where t.status = 'voided'))::integer
  from public.transactions t
  join public.profiles p on p.id = t.created_by
  where t.business_date = p_business_date
  group by t.created_by, p.full_name
  order by p.full_name;
end;
$$;

-- ---------- Daily closing (owner only) ----------
create or replace function public.save_daily_closing(
  p_business_date date,
  p_cash_counted numeric,
  p_recorded_cash_balance numeric,
  p_closing_notes text,
  p_close boolean default false
)
returns public.daily_closings
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old   public.daily_closings;
  v_new   public.daily_closings;
  v_notes text := nullif(btrim(coalesce(p_closing_notes, '')), '');
begin
  perform public.assert_admin();

  if p_business_date is null or p_business_date > public.current_business_date() then
    raise exception 'You cannot close a future date.';
  end if;
  if p_cash_counted is not null and p_cash_counted < 0 then
    raise exception 'Cash counted cannot be negative.';
  end if;
  if p_recorded_cash_balance is not null and p_recorded_cash_balance < 0 then
    raise exception 'Recorded cash balance cannot be negative.';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Closing notes must be 500 characters or fewer.';
  end if;

  select * into v_old from public.daily_closings c
  where c.business_date = p_business_date for update;

  if found and v_old.status = 'closed' then
    raise exception 'This day is already closed. Reopen it to make changes.';
  end if;

  if not found then
    insert into public.daily_closings
      (business_date, status, cash_counted, recorded_cash_balance, closing_notes, closed_by, closed_at)
    values
      (p_business_date,
       case when p_close then 'closed' else 'open' end,
       p_cash_counted, p_recorded_cash_balance, v_notes,
       case when p_close then auth.uid() end,
       case when p_close then now() end)
    returning * into v_new;
  else
    update public.daily_closings c
       set status = case when p_close then 'closed' else 'open' end,
           cash_counted = p_cash_counted,
           recorded_cash_balance = p_recorded_cash_balance,
           closing_notes = v_notes,
           closed_by = case when p_close then auth.uid() else c.closed_by end,
           closed_at = case when p_close then now() else c.closed_at end
     where c.id = v_old.id
    returning * into v_new;
  end if;

  perform public.write_audit_log(
    case when p_close then 'closing.closed' else 'closing.draft_saved' end,
    'daily_closing', v_new.id, null,
    case when v_old.id is null then null else
      jsonb_build_object('status', v_old.status, 'cash_counted', v_old.cash_counted,
                         'recorded_cash_balance', v_old.recorded_cash_balance) end,
    jsonb_build_object('business_date', v_new.business_date, 'status', v_new.status,
                       'cash_counted', v_new.cash_counted,
                       'recorded_cash_balance', v_new.recorded_cash_balance,
                       'shortage_overage', v_new.shortage_overage));

  return v_new;
end;
$$;

create or replace function public.reopen_business_day(p_business_date date, p_reason text)
returns public.daily_closings
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old    public.daily_closings;
  v_new    public.daily_closings;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform public.assert_admin();

  if char_length(v_reason) < 5 then
    raise exception 'Enter a reason (at least 5 characters).';
  end if;

  select * into v_old from public.daily_closings c
  where c.business_date = p_business_date for update;

  if not found or v_old.status <> 'closed' then
    raise exception 'This day is not closed.';
  end if;

  update public.daily_closings c
     set status = 'open',
         reopened_by = auth.uid(),
         reopened_at = now(),
         reopen_reason = v_reason
   where c.id = v_old.id
  returning * into v_new;

  perform public.write_audit_log('closing.reopened', 'daily_closing', v_new.id, v_reason,
    jsonb_build_object('status', 'closed', 'closed_at', v_old.closed_at),
    jsonb_build_object('status', 'open', 'business_date', v_new.business_date));

  return v_new;
end;
$$;

-- ---------- Staff access (owner only) ----------
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_role text default null,
  p_is_active boolean default null,
  p_full_name text default null
)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old  public.profiles;
  v_new  public.profiles;
  v_name text := nullif(btrim(coalesce(p_full_name, '')), '');
begin
  perform public.assert_admin();

  select * into v_old from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'User not found.';
  end if;

  if p_role is not null and p_role not in ('admin', 'staff') then
    raise exception 'Role must be admin or staff.';
  end if;
  if v_name is not null and char_length(v_name) > 80 then
    raise exception 'Name must be 80 characters or fewer.';
  end if;

  -- Prevents locking everyone out of the owner account.
  if p_user_id = auth.uid()
     and ((p_role is not null and p_role <> v_old.role)
          or (p_is_active is not null and p_is_active = false)) then
    raise exception 'You cannot remove your own owner access or deactivate your own account.';
  end if;

  -- Tell the guard trigger this change is approved (lasts for this transaction).
  perform set_config('app.admin_profile_change', 'on', true);

  update public.profiles p
     set role = coalesce(p_role, p.role),
         is_active = coalesce(p_is_active, p.is_active),
         full_name = coalesce(v_name, p.full_name)
   where p.id = p_user_id
  returning * into v_new;

  perform set_config('app.admin_profile_change', 'off', true);

  perform public.write_audit_log('profile.updated', 'profile', p_user_id, null,
    jsonb_build_object('role', v_old.role, 'is_active', v_old.is_active, 'full_name', v_old.full_name),
    jsonb_build_object('role', v_new.role, 'is_active', v_new.is_active, 'full_name', v_new.full_name));

  return v_new;
end;
$$;

-- ---------- Store settings (owner only) ----------
create or replace function public.update_store_settings(
  p_store_name text,
  p_staff_history_days integer default null
)
returns public.store_settings
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old  public.store_settings;
  v_new  public.store_settings;
  v_name text := btrim(coalesce(p_store_name, ''));
begin
  perform public.assert_admin();

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Store name must be between 1 and 80 characters.';
  end if;
  if p_staff_history_days is not null and p_staff_history_days not between 0 and 31 then
    raise exception 'Staff history days must be between 0 and 31.';
  end if;

  select * into v_old from public.store_settings s where s.id for update;

  update public.store_settings s
     set store_name = v_name,
         staff_history_days = coalesce(p_staff_history_days, s.staff_history_days),
         updated_by = auth.uid()
   where s.id
  returning * into v_new;

  perform public.write_audit_log('settings.updated', 'store_settings', null, null,
    jsonb_build_object('store_name', v_old.store_name, 'staff_history_days', v_old.staff_history_days),
    jsonb_build_object('store_name', v_new.store_name, 'staff_history_days', v_new.staff_history_days));

  return v_new;
end;
$$;
