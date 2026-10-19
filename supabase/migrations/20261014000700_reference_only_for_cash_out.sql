-- =====================================================================
-- GCash Monitor - Migration 7: the reference number is for CASH-OUT only
--
-- Store workflow:
--   Cash-in : the customer gives their number, the staff sends the money and
--             photographs the receipt. There is no reference number to record.
--   Cash-out: the customer sends GCash to the store; the staff copies the
--             reference number from the receipt. It is REQUIRED.
--
-- Run this ONCE in the SQL Editor if you already ran migrations 1-6.
-- (Fresh projects get it through setup_all.sql.)
-- Old cash-in records that already have a reference keep it.
-- =====================================================================

alter table public.transactions alter column reference_number drop not null;

alter table public.transactions drop constraint if exists transactions_reference_check;
alter table public.transactions add constraint transactions_reference_check
  check (
    reference_number is null
    or (reference_number = btrim(reference_number) and reference_key ~ '^[A-Z0-9]{8,20}$')
  );

-- A cash-out can never be saved without its reference number.
alter table public.transactions drop constraint if exists transactions_cash_out_reference_check;
alter table public.transactions add constraint transactions_cash_out_reference_check
  check (transaction_type <> 'cash_out' or reference_number is not null);

-- ---------- Validation helper (replaces validate_transaction_fields) ----------
drop function if exists public.validate_transaction_fields(text, numeric, text, text);

create or replace function public.validate_transaction_input(
  p_type text,
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
  if p_type = 'cash_out'
     and upper(regexp_replace(coalesce(p_reference, ''), '\s+', '', 'g')) !~ '^[A-Z0-9]{8,20}$' then
    raise exception 'Enter the reference number from the GCash receipt (8 to 20 letters or numbers).';
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

-- New functions are runnable by everyone by default. This one is internal.
revoke execute on function public.validate_transaction_input(text, text, numeric, text, text)
  from public, anon, authenticated;

-- ---------- create_transaction: cash-in ignores any reference ----------
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
  v_ref   text := case when p_transaction_type = 'cash_out'
                       then public.normalize_reference(p_reference_number) end;
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

  perform public.validate_transaction_input(p_transaction_type, v_ref, p_amount, v_name, v_notes);

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

-- ---------- update_transaction: a cash-in keeps whatever reference it had ----------
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
  v_ref    text;
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

  -- Only a cash-out has a reference to edit. A cash-in is left exactly as it was.
  v_ref := case when v_old.transaction_type = 'cash_out'
                then public.normalize_reference(p_reference_number)
                else v_old.reference_number end;

  perform public.validate_transaction_input(v_old.transaction_type, v_ref, p_amount, v_name, v_notes);

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
