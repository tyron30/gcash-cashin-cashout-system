-- =====================================================================
-- DEVELOPMENT ONLY. Do NOT run this on your real (production) project.
-- Adds fake sample transactions for the last 3 days so you can try the
-- app. It refuses to run if there is no active owner yet, or if any
-- transactions already exist (so it can never mix with real records).
-- =====================================================================
do $seed$
declare
  v_admin   uuid;
  v_day     integer;
  v_i       integer;
  v_ts      timestamptz;
  v_voided  boolean;
  v_amounts numeric[] := array[200, 500, 1000, 1500, 2000, 3000, 750, 2500];
  v_names   text[]    := array['JU**** DE**', null, 'MA*** SA****', 'RO** CR**', null, 'LI** TA****', 'AN** BA******', null];
begin
  select p.id into v_admin
  from public.profiles p
  where p.role = 'admin' and p.is_active
  order by p.created_at
  limit 1;

  if v_admin is null then
    raise notice 'Seed skipped: create and activate an owner account first (see bootstrap_owner.sql).';
    return;
  end if;

  if exists (select 1 from public.transactions) then
    raise notice 'Seed skipped: transactions already exist.';
    return;
  end if;

  for v_day in 0..2 loop
    for v_i in 1..8 loop
      v_ts := ((public.current_business_date() - v_day)::timestamp
               + make_interval(hours => 8 + v_i, mins => v_i * 7))
              at time zone public.store_timezone();

      continue when v_ts > now();

      v_voided := (v_day = 1 and v_i = 3);

      insert into public.transactions
        (reference_number, transaction_type, amount, sender_receiver_name,
         transaction_timestamp, status, void_reason, voided_at, voided_by, created_by)
      values (
        public.normalize_reference((5000000000000 + v_day * 100000000 + v_i * 7919)::text),
        case when v_i % 2 = 1 then 'cash_in' else 'cash_out' end,
        v_amounts[v_i],
        v_names[v_i],
        v_ts,
        case when v_voided then 'voided' else 'completed' end,
        case when v_voided then 'Sample voided entry' end,
        case when v_voided then now() end,
        case when v_voided then v_admin end,
        v_admin
      );
    end loop;
  end loop;

  raise notice 'Sample data added.';
end;
$seed$;
