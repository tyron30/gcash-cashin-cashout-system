-- =====================================================================
-- GCash Monitor - Migration 3 of 5: Row Level Security policies
-- RLS decides WHICH ROWS a logged-in user can read. Writes to money
-- tables are not allowed directly at all: they go through the approved
-- functions in migration 4.
-- "(select ...)" wrappers make Postgres evaluate each check once per
-- query instead of once per row (faster).
-- =====================================================================

-- ---------- profiles ----------
-- Everyone active can see names (needed to show "recorded by").
-- A person can always read their own profile, even if inactive, so the
-- app can tell them "your account is not active yet".
create policy profiles_select
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_active_user()));

-- People may edit only their own full_name (column permission below).
-- Role and is_active are protected by column permissions AND a trigger.
create policy profiles_update_own_name
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------- store_settings ----------
create policy store_settings_select
  on public.store_settings for select to authenticated
  using ((select public.is_active_user()));

-- ---------- transactions ----------
-- Owner: every transaction.
-- Staff: only recent days (default = today only, set in store_settings).
create policy transactions_select
  on public.transactions for select to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_user())
      and business_date >= (select public.current_business_date()) - (select public.staff_history_days())
    )
  );

-- ---------- daily_closings and audit_logs: owner only ----------
create policy daily_closings_select
  on public.daily_closings for select to authenticated
  using ((select public.is_admin()));

create policy audit_logs_select
  on public.audit_logs for select to authenticated
  using ((select public.is_admin()));

-- No INSERT / UPDATE / DELETE policies exist on purpose for transactions,
-- daily_closings, audit_logs, and store_settings. With RLS on, that means
-- "denied", even if a permission were granted by mistake later.

-- ---------- Table permissions (second layer) ----------
-- Supabase gives anon/authenticated broad permissions on new tables by
-- default. Take everything away, then give back only what is needed.
revoke all on public.profiles       from anon, authenticated;
revoke all on public.store_settings from anon, authenticated;
revoke all on public.transactions   from anon, authenticated;
revoke all on public.daily_closings from anon, authenticated;
revoke all on public.audit_logs     from anon, authenticated;

grant select on public.profiles       to authenticated;
grant select on public.store_settings to authenticated;
grant select on public.transactions   to authenticated;
grant select on public.daily_closings to authenticated;
grant select on public.audit_logs     to authenticated;

-- Only the name column of profiles can be edited directly.
grant update (full_name) on public.profiles to authenticated;

-- Any table created in future starts with no access for anon/authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;
