-- =====================================================================
-- Run these in the Supabase SQL Editor (NOT a migration).
-- New logins start as INACTIVE staff. This is how you make the first
-- owner, and how you activate staff until the Staff page exists (Phase 4).
-- =====================================================================

-- STEP 1. Create your owner login first:
--   Dashboard -> Authentication -> Users -> Add user -> Create new user
--   (tick "Auto Confirm User").
-- STEP 2. Put the SAME email below, then run only this block.
update public.profiles
set role = 'admin', is_active = true, full_name = 'Your Name Here'
where id = (select id from auth.users where email = 'owner@yourstore.com')
returning id, full_name, role, is_active;
-- It must show ONE row. If it shows none, the email does not match.


-- STEP 3 (for each staff member). Create their login the same way, then:
update public.profiles
set is_active = true, full_name = 'Staff Name Here'
where id = (select id from auth.users where email = 'staff1@yourstore.com')
returning id, full_name, role, is_active;


-- To switch a staff member off (do not delete users who have transactions):
-- update public.profiles set is_active = false
-- where id = (select id from auth.users where email = 'staff1@yourstore.com');


-- Optional: set your store name (shown on reports).
-- update public.store_settings set store_name = 'Your Store Name';
