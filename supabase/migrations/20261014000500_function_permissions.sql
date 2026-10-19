-- =====================================================================
-- GCash Monitor - Migration 5 of 5: who may run which function
-- By default Supabase lets everyone (even logged-out visitors) run new
-- functions. This removes that, then grants back only what the app needs.
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
  end loop;
end;
$$;

-- Future functions you create in the SQL editor: run the same revoke for them
-- (Postgres gives PUBLIC execute rights to every new function by default).
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Used inside security policies (evaluated as the logged-in user).
grant execute on function public.is_active_user()          to authenticated;
grant execute on function public.is_admin()                to authenticated;
grant execute on function public.current_business_date()   to authenticated;
grant execute on function public.staff_history_days()      to authenticated;

-- Approved actions the app can call. Logged-out visitors (anon) get nothing.
grant execute on function public.create_transaction(text, text, numeric, text, text, timestamptz, uuid) to authenticated;
grant execute on function public.update_transaction(uuid, text, numeric, text, text, timestamptz, text) to authenticated;
grant execute on function public.void_transaction(uuid, text)                                           to authenticated;
grant execute on function public.find_duplicate_references(text, uuid)                                  to authenticated;
grant execute on function public.daily_totals(date, date, text)                                         to authenticated;
grant execute on function public.staff_totals(date)                                                     to authenticated;
grant execute on function public.save_daily_closing(date, numeric, numeric, text, boolean)              to authenticated;
grant execute on function public.reopen_business_day(date, text)                                        to authenticated;
grant execute on function public.admin_update_profile(uuid, text, boolean, text)                        to authenticated;
grant execute on function public.update_store_settings(text, integer)                                   to authenticated;

-- Deliberately NOT granted (internal only): assert_admin, write_audit_log,
-- validate_transaction_fields, normalize_reference, store_timezone, and all
-- trigger functions.
