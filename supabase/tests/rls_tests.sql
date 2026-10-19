-- =====================================================================
-- GCash Monitor - database security self-test
--
-- HOW TO RUN
--   1. Create an owner login AND a staff login (see supabase/README.md).
--   2. Replace OWNER_EMAIL_HERE and STAFF_EMAIL_HERE below (2 places).
--   3. Paste the whole file into the SQL Editor and click Run.
--
-- The script ends with an intentional "error". Its text is your test
-- report, and the error cancels everything the test did, so NOTHING is
-- saved. Run it on a development/new project, not on real store data.
-- =====================================================================

-- Test helpers (temporary, vanish when the session ends)
create or replace function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  set local role authenticated;
end;
$$;

-- Runs SQL as a user (NULL = logged-out visitor). Returns the error text, or NULL if it worked.
create or replace function pg_temp.try_as(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare
  v_err text;
begin
  if p_uid is null then
    set local role anon;
  else
    perform pg_temp.act_as(p_uid);
  end if;
  begin
    execute p_sql;
    v_err := null;
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return v_err;
end;
$$;

-- How many rows can this user see? (-1 = not allowed at all)
create or replace function pg_temp.count_as(p_uid uuid, p_sql text) returns integer
language plpgsql as $$
declare
  v_n integer;
begin
  if p_uid is null then
    set local role anon;
  else
    perform pg_temp.act_as(p_uid);
  end if;
  begin
    execute 'select count(*) from (' || p_sql || ') q' into v_n;
  exception when others then
    v_n := -1;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return v_n;
end;
$$;

-- Returns one number from a query run as a user (NULL if it failed).
create or replace function pg_temp.num_as(p_uid uuid, p_sql text) returns numeric
language plpgsql as $$
declare
  v_n numeric;
begin
  perform pg_temp.act_as(p_uid);
  begin
    execute p_sql into v_n;
  exception when others then
    v_n := null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return v_n;
end;
$$;

create or replace function pg_temp.line(p_ok boolean, p_name text, p_detail text) returns text
language sql as $$
  select format(E'%s  %s\n        %s\n',
    case when coalesce(p_ok, false) then 'PASS' else '*** FAIL' end, p_name, coalesce(p_detail, ''));
$$;

do $test$
declare
  v_admin  uuid;
  v_staff  uuid;
  v_report text := '';
  v_err    text;
  v_n      integer;
  v_role   text;
  v_amt    numeric;
  v_req    uuid := gen_random_uuid();
  v_req2   uuid := gen_random_uuid();
  v_req3   uuid := gen_random_uuid();
  v_tx     public.transactions;
  v_tx2    public.transactions;
  v_old    public.transactions;
  v_x      public.transactions;
  v_close  public.daily_closings;
  v_before numeric;
  v_after  numeric;
  v_fails  integer;
  v_today  date := public.current_business_date();
  v_create text := 'select public.create_transaction(%L, %L, %s, %L, null, null, %L)';
begin
  select id into v_admin from auth.users where email = 'OWNER_EMAIL_HERE';
  select id into v_staff from auth.users where email = 'STAFF_EMAIL_HERE';
  if v_admin is null or v_staff is null then
    raise exception 'Edit the two email addresses at the top of the script, then run it again.';
  end if;

  update public.profiles set role = 'admin', is_active = true where id = v_admin;
  update public.profiles set role = 'staff', is_active = true where id = v_staff;

  -- ---------------- STAFF: allowed things ----------------
  v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_in', '0143872590316', '1500.50', 'JU**** DE**', v_req));
  select * into v_tx from public.transactions where client_request_id = v_req;
  v_report := v_report || pg_temp.line(
    v_err is null and v_tx.reference_number = '0143 872 590316' and v_tx.amount = 1500.50
      and v_tx.business_date = v_today and v_tx.created_by = v_staff and v_tx.status = 'completed',
    '1. Staff can record a cash-in (leading zero kept, business date = today in Manila)',
    coalesce(v_err, format('reference=%s amount=%s date=%s', v_tx.reference_number, v_tx.amount, v_tx.business_date)));

  v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_in', '0143872590316', '1500.50', 'JU**** DE**', v_req));
  select count(*) into v_n from public.transactions where client_request_id = v_req;
  v_report := v_report || pg_temp.line(v_err is null and v_n = 1,
    '2. Saving the same form twice creates only ONE record', coalesce(v_err, format('%s record(s)', v_n)));

  v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_out', '5890214773045', '300', null, gen_random_uuid()));
  v_report := v_report || pg_temp.line(v_err is null, '3. A blank name is accepted', coalesce(v_err, 'saved'));

  -- ---------------- STAFF: rejected inputs ----------------
  foreach v_amt in array array[0, -5, 10.123, 1000000]::numeric[] loop
    v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_in', '5555666677778', v_amt::text, null, null));
    v_report := v_report || pg_temp.line(v_err is not null, format('4. Amount %s is rejected', v_amt),
      coalesce(v_err, 'it was ACCEPTED'));
  end loop;

  v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_in', '123', '100', null, null));
  v_report := v_report || pg_temp.line(v_err is not null, '5. A too-short reference number is rejected', coalesce(v_err, 'it was ACCEPTED'));

  v_err := pg_temp.try_as(v_staff, format(v_create, 'transfer', '5555666677778', '100', null, null));
  v_report := v_report || pg_temp.line(v_err is not null, '6. An invalid transaction type is rejected', coalesce(v_err, 'it was ACCEPTED'));

  -- ---------------- STAFF: forbidden things ----------------
  v_err := pg_temp.try_as(v_staff, format('select public.void_transaction(%L, %L)', v_tx.id, 'trying to void it'));
  v_report := v_report || pg_temp.line(v_err is not null, '7. Staff cannot void a transaction', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_staff, format('select public.update_transaction(%L, %L, 1, null, null, now(), %L)', v_tx.id, '0143 872 590316', 'sneaky edit'));
  v_report := v_report || pg_temp.line(v_err is not null, '8. Staff cannot edit a transaction', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_staff, format('update public.profiles set role = %L where id = %L', 'admin', v_staff));
  select role into v_role from public.profiles where id = v_staff;
  v_report := v_report || pg_temp.line(v_err is not null and v_role = 'staff', '9. Staff cannot make themselves an admin',
    coalesce(v_err, 'it was ALLOWED') || ' (role is still ' || v_role || ')');

  v_err := pg_temp.try_as(v_staff, format('update public.profiles set is_active = true, role = %L where id = %L', 'admin', v_staff));
  v_report := v_report || pg_temp.line(v_err is not null, '10. Staff cannot change role and access together', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_staff, format(
    'insert into public.transactions (reference_number, transaction_type, amount, business_date, created_by) values (%L, %L, 10, current_date, %L)',
    '1111222233334', 'cash_in', v_staff));
  v_report := v_report || pg_temp.line(v_err is not null, '11. Staff cannot insert into the table directly', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_staff, format('update public.transactions set amount = 1 where id = %L', v_tx.id));
  v_report := v_report || pg_temp.line(v_err is not null, '12. Staff cannot update a transaction directly', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_staff, format('delete from public.transactions where id = %L', v_tx.id));
  v_report := v_report || pg_temp.line(v_err is not null, '13. Staff cannot delete a transaction', coalesce(v_err, 'it was ALLOWED'));

  v_n := pg_temp.count_as(v_staff, 'select * from public.audit_logs');
  v_report := v_report || pg_temp.line(v_n = 0, '14. Staff cannot read the audit log', format('rows visible: %s', v_n));

  v_err := pg_temp.try_as(v_staff, format('select public.save_daily_closing(%L, 100, 100, null, false)', v_today));
  v_report := v_report || pg_temp.line(v_err is not null, '15. Staff cannot save a daily closing', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_staff, format('select public.admin_update_profile(%L, %L, true, null)', v_staff, 'admin'));
  v_report := v_report || pg_temp.line(v_err is not null, '16. Staff cannot use the staff-management function', coalesce(v_err, 'it was ALLOWED'));

  -- ---------------- LOGGED-OUT VISITOR ----------------
  v_n := pg_temp.count_as(null, 'select * from public.transactions');
  v_report := v_report || pg_temp.line(v_n = -1, '17. A logged-out visitor cannot read transactions', format('result: %s (-1 = blocked)', v_n));
  v_n := pg_temp.count_as(null, 'select * from public.profiles');
  v_report := v_report || pg_temp.line(v_n = -1, '18. A logged-out visitor cannot read profiles', format('result: %s (-1 = blocked)', v_n));
  v_err := pg_temp.try_as(null, format(v_create, 'cash_in', '5555666677778', '100', null, null));
  v_report := v_report || pg_temp.line(v_err is not null, '19. A logged-out visitor cannot record a transaction', coalesce(v_err, 'it was ALLOWED'));

  -- ---------------- OWNER: edit, void, totals ----------------
  v_err := pg_temp.try_as(v_admin, format('select public.update_transaction(%L, %L, 2000, %L, null, %L, %L)',
    v_tx.id, v_tx.reference_number, v_tx.sender_receiver_name, v_tx.transaction_timestamp, 'Typo in the amount'));
  select * into v_x from public.transactions where id = v_tx.id;
  v_report := v_report || pg_temp.line(v_err is null and v_x.amount = 2000 and v_x.updated_by = v_admin,
    '20. Owner can edit with a reason', coalesce(v_err, format('amount is now %s', v_x.amount)));

  v_err := pg_temp.try_as(v_admin, format('select public.update_transaction(%L, %L, 2500, %L, null, %L, %L)',
    v_tx.id, v_tx.reference_number, v_tx.sender_receiver_name, v_tx.transaction_timestamp, ''));
  v_report := v_report || pg_temp.line(v_err is not null, '21. Editing WITHOUT a reason is rejected', coalesce(v_err, 'it was ALLOWED'));

  select count(*) into v_n from public.audit_logs where entity_id = v_tx.id and action in ('transaction.created', 'transaction.updated');
  v_report := v_report || pg_temp.line(v_n = 2, '22. Creating and editing were both written to the audit log', format('%s entries', v_n));

  v_before := pg_temp.num_as(v_admin, format('select cash_out_total from public.daily_totals(%L, %L)', v_today, v_today));

  v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_out', '0000111122223', '700', null, v_req2));
  select * into v_tx2 from public.transactions where client_request_id = v_req2;

  v_after := pg_temp.num_as(v_admin, format('select cash_out_total from public.daily_totals(%L, %L)', v_today, v_today));
  v_report := v_report || pg_temp.line(v_after = v_before + 700, '23. Dashboard totals include a new cash-out',
    format('cash-out total %s -> %s', v_before, v_after));

  v_err := pg_temp.try_as(v_admin, format('select public.void_transaction(%L, %L)', v_tx2.id, ''));
  v_report := v_report || pg_temp.line(v_err is not null, '24. Voiding WITHOUT a reason is rejected', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_admin, format('select public.void_transaction(%L, %L)', v_tx2.id, 'Wrong amount entered'));
  select * into v_x from public.transactions where id = v_tx2.id;
  v_report := v_report || pg_temp.line(v_err is null and v_x.status = 'voided' and v_x.void_reason = 'Wrong amount entered',
    '25. Owner can void with a reason (record is kept)', coalesce(v_err, 'status=' || v_x.status));

  v_after := pg_temp.num_as(v_admin, format('select cash_out_total from public.daily_totals(%L, %L)', v_today, v_today));
  v_report := v_report || pg_temp.line(v_after = v_before, '26. A voided transaction is NOT counted in totals',
    format('cash-out total back to %s', v_after));

  v_err := pg_temp.try_as(v_admin, format('select public.update_transaction(%L, %L, 800, null, null, now(), %L)', v_tx2.id, '0000 111 122223', 'edit after void'));
  v_report := v_report || pg_temp.line(v_err is not null, '27. A voided transaction cannot be edited', coalesce(v_err, 'it was ALLOWED'));

  -- ---------------- VISIBILITY AND TIME ----------------
  insert into public.transactions (reference_number, transaction_type, amount, transaction_timestamp, created_by)
  values ('9999 888 777666', 'cash_in', 100, now() - interval '3 days', v_admin) returning * into v_old;

  v_n := pg_temp.count_as(v_staff, format('select * from public.transactions where id = %L', v_old.id));
  v_report := v_report || pg_temp.line(v_n = 0, '28. Staff cannot see a transaction from 3 days ago', format('rows visible: %s', v_n));
  v_n := pg_temp.count_as(v_admin, format('select * from public.transactions where id = %L', v_old.id));
  v_report := v_report || pg_temp.line(v_n = 1, '29. Owner can see it', format('rows visible: %s', v_n));

  insert into public.transactions (reference_number, transaction_type, amount, transaction_timestamp, created_by)
  values ('1000 000 000001', 'cash_in', 1, timestamptz '2026-01-01 23:30:00+08', v_admin) returning * into v_x;
  v_report := v_report || pg_temp.line(v_x.business_date = date '2026-01-01',
    '30. 11:30 pm Manila time belongs to that Manila day', format('business_date = %s', v_x.business_date));

  insert into public.transactions (reference_number, transaction_type, amount, transaction_timestamp, created_by)
  values ('1000 000 000002', 'cash_in', 1, timestamptz '2026-01-01 00:30:00+08', v_admin) returning * into v_x;
  v_report := v_report || pg_temp.line(v_x.business_date = date '2026-01-01',
    '31. 12:30 am Manila time is Jan 1 (it is still Dec 31 in UTC)', format('business_date = %s', v_x.business_date));

  -- ---------------- DAILY CLOSING ----------------
  v_err := pg_temp.try_as(v_admin, format('select public.save_daily_closing(%L, 5000, 4900, %L, true)', v_today, 'test close'));
  select * into v_close from public.daily_closings where business_date = v_today;
  v_report := v_report || pg_temp.line(v_err is null and v_close.status = 'closed' and v_close.shortage_overage = 100,
    '32. Owner can close the day (overage is calculated by the database)',
    coalesce(v_err, format('status=%s shortage_overage=%s', v_close.status, v_close.shortage_overage)));

  v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_in', '7777888899990', '100', null, gen_random_uuid()));
  v_report := v_report || pg_temp.line(v_err is not null and v_err ilike '%closed%', '33. A closed day blocks new transactions', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_admin, format('select public.void_transaction(%L, %L)', v_tx.id, 'void on a closed day'));
  v_report := v_report || pg_temp.line(v_err is not null and v_err ilike '%closed%', '34. A closed day blocks voiding too', coalesce(v_err, 'it was ALLOWED'));

  v_n := pg_temp.count_as(v_staff, 'select * from public.daily_closings');
  v_report := v_report || pg_temp.line(v_n = 0, '35. Staff cannot read daily closings', format('rows visible: %s', v_n));

  v_err := pg_temp.try_as(v_admin, format('select public.reopen_business_day(%L, %L)', v_today, ''));
  v_report := v_report || pg_temp.line(v_err is not null, '36. Reopening WITHOUT a reason is rejected', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_admin, format('select public.reopen_business_day(%L, %L)', v_today, 'Forgot one transaction'));
  select * into v_close from public.daily_closings where business_date = v_today;
  v_report := v_report || pg_temp.line(v_err is null and v_close.status = 'open' and v_close.reopened_by = v_admin,
    '37. Owner can reopen with a reason', coalesce(v_err, 'status=' || v_close.status));

  v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_in', '7777888899990', '100', null, v_req3));
  v_report := v_report || pg_temp.line(v_err is null, '38. After reopening, recording works again', coalesce(v_err, 'saved'));

  select count(*) into v_n from public.audit_logs where action in ('closing.closed', 'closing.reopened');
  v_report := v_report || pg_temp.line(v_n = 2, '39. Closing and reopening were audited', format('%s entries', v_n));

  -- ---------------- AUDIT AND DELETE PROTECTION ----------------
  v_err := pg_temp.try_as(v_admin, 'update public.audit_logs set action = ''hacked''');
  v_report := v_report || pg_temp.line(v_err is not null, '40. Even the owner cannot rewrite the audit log', coalesce(v_err, 'it was ALLOWED'));

  begin
    delete from public.audit_logs;
    v_err := null;
  exception when others then
    v_err := sqlerrm;
  end;
  v_report := v_report || pg_temp.line(v_err is not null, '41. The audit log cannot be deleted (not even by the database admin role)', coalesce(v_err, 'it was ALLOWED'));

  begin
    delete from public.transactions;
    v_err := null;
  exception when others then
    v_err := sqlerrm;
  end;
  v_report := v_report || pg_temp.line(v_err is not null, '42. Transactions cannot be deleted (not even by the database admin role)', coalesce(v_err, 'it was ALLOWED'));

  -- ---------------- ACCOUNTS ----------------
  v_err := pg_temp.try_as(v_admin, format('select public.admin_update_profile(%L, %L, null, null)', v_admin, 'staff'));
  v_report := v_report || pg_temp.line(v_err is not null, '43. The owner cannot remove their own owner access', coalesce(v_err, 'it was ALLOWED'));

  update public.profiles set is_active = false where id = v_staff;
  v_err := pg_temp.try_as(v_staff, format(v_create, 'cash_in', '4444555566667', '100', null, null));
  v_n := pg_temp.count_as(v_staff, 'select * from public.transactions');
  v_report := v_report || pg_temp.line(v_err is not null and v_n = 0, '44. A deactivated staff account can do and see nothing',
    coalesce(v_err, 'it was ALLOWED') || format(' (rows visible: %s)', v_n));
  update public.profiles set is_active = true where id = v_staff;

  v_err := pg_temp.try_as(v_admin, format('select public.admin_update_profile(%L, null, false, null)', v_staff));
  select role into v_role from public.profiles where id = v_staff and is_active = false;
  v_report := v_report || pg_temp.line(v_err is null and v_role = 'staff', '45. Owner can deactivate a staff account', coalesce(v_err, 'done'));

  -- ---------------- PHASE 4 FUNCTIONS (needs migration 6) ----------------
  v_err := pg_temp.try_as(v_staff, 'select * from public.admin_list_profiles()');
  v_report := v_report || pg_temp.line(v_err is not null, '46. Staff cannot list accounts with emails', coalesce(v_err, 'it was ALLOWED'));

  v_err := pg_temp.try_as(v_staff, 'select email from public.profiles');
  v_report := v_report || pg_temp.line(v_err is not null, '47. Staff cannot read the email column', coalesce(v_err, 'it was ALLOWED'));

  v_n := pg_temp.count_as(v_staff, format('select * from public.search_transactions(%L, %L) where id = %L', v_today - 5, v_today, v_old.id));
  v_report := v_report || pg_temp.line(v_n = 0, '48. Staff search cannot reach old records', format('rows visible: %s', v_n));

  v_n := pg_temp.count_as(v_admin, format('select * from public.search_transactions(%L, %L) where id = %L', v_today - 5, v_today, v_old.id));
  v_report := v_report || pg_temp.line(v_n = 1, '49. Owner search finds the old record', format('rows visible: %s', v_n));

  v_n := pg_temp.count_as(null, format('select * from public.search_transactions(%L, %L)', v_today, v_today));
  v_report := v_report || pg_temp.line(v_n = -1, '50. A logged-out visitor cannot use search', format('result: %s (-1 = blocked)', v_n));

  -- ---------------- REPORT ----------------
  v_fails := (length(v_report) - length(replace(v_report, '*** FAIL', ''))) / length('*** FAIL');
  raise exception E'\n\nTEST REPORT - % FAILED\n(This "error" is intentional. It cancels the test data so nothing is saved.)\n\n%',
    v_fails, v_report;
end;
$test$;
