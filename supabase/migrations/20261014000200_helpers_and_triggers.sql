-- =====================================================================
-- GCash Monitor - Migration 2 of 5: helper functions and triggers
-- All functions use "set search_path = ''" and fully-qualified names.
-- That is the Supabase-recommended way to stop search-path tricks.
-- =====================================================================

-- ---------- Who is calling? (used by security policies) ----------

create or replace function public.is_active_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin'
  );
$$;

-- Internal: stop with a clear error unless the caller is the owner.
create or replace function public.assert_admin()
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the owner can do this.' using errcode = '42501';
  end if;
end;
$$;

-- ---------- Store time (Asia/Manila) ----------

create or replace function public.store_timezone()
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select s.timezone from public.store_settings s where s.id), 'Asia/Manila');
$$;

-- Today's business date in the store's timezone.
create or replace function public.current_business_date()
returns date
language sql stable security definer
set search_path = ''
as $$
  select (now() at time zone public.store_timezone())::date;
$$;

create or replace function public.staff_history_days()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select s.staff_history_days from public.store_settings s where s.id), 0);
$$;

-- ---------- Text helpers ----------

-- Trim, collapse spaces, and show 13-digit numbers GCash-style: 0143 872 590316
create or replace function public.normalize_reference(p_value text)
returns text
language sql immutable
set search_path = ''
as $$
  select case
           when s.t ~ '^[0-9]{13}$'
             then substr(s.t, 1, 4) || ' ' || substr(s.t, 5, 3) || ' ' || substr(s.t, 8)
           else s.t
         end
  from (select btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g')) as t) s;
$$;

-- ---------- Audit log writer (internal only) ----------

create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_reason text default null,
  p_previous jsonb default null,
  p_new jsonb default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select p.full_name into v_name from public.profiles p where p.id = auth.uid();

  insert into public.audit_logs
    (actor_id, actor_name, action, entity_type, entity_id, reason, previous_values, new_values)
  values
    (auth.uid(), v_name, p_action, p_entity_type, p_entity_id, p_reason, p_previous, p_new);
end;
$$;

-- ---------- Generic triggers ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_90_updated_at       before update on public.profiles       for each row execute function public.set_updated_at();
create trigger store_settings_90_updated_at before update on public.store_settings for each row execute function public.set_updated_at();
create trigger daily_closings_90_updated_at before update on public.daily_closings for each row execute function public.set_updated_at();
create trigger transactions_90_updated_at   before update on public.transactions   for each row execute function public.set_updated_at();

-- Nothing here may ever be deleted or wiped.
create or replace function public.prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% on % is not allowed. Financial records are never deleted; void them instead.',
    tg_op, tg_table_name using errcode = '42501';
end;
$$;

create trigger transactions_no_delete
  before delete on public.transactions
  for each row execute function public.prevent_modification();
create trigger transactions_no_truncate
  before truncate on public.transactions
  for each statement execute function public.prevent_modification();

-- audit_logs is append-only: no update, delete, or truncate for anyone.
create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.prevent_modification();
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.prevent_modification();

-- ---------- New login -> new profile ----------
-- The profile is ALWAYS created as an inactive staff member. Only the owner
-- (through admin_update_profile) can activate it or change the role.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ), 80),
    'staff',
    false
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Logins that already existed before this migration.
insert into public.profiles (id, full_name, role, is_active)
select u.id,
       left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                     nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                     'New user'), 80),
       'staff',
       false
from auth.users u
on conflict (id) do nothing;

-- ---------- Profiles: nobody can promote themselves ----------
-- Second lock behind the column permissions in migration 3. Role and access
-- can only change through admin_update_profile(), or from the Supabase
-- dashboard / SQL editor (where auth.uid() is null).

create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.id is distinct from old.id)
     and auth.uid() is not null
     and coalesce(current_setting('app.admin_profile_change', true), '') <> 'on'
  then
    raise exception 'Role and access can only be changed by the owner.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_10_guard
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- ---------- Transactions: business rules inside the database ----------

-- 1) business_date always comes from the timestamp, in Manila time.
--    11:30 pm Manila belongs to THAT Manila day, not the next UTC day.
create or replace function public.set_business_date()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.business_date := (new.transaction_timestamp at time zone public.store_timezone())::date;
  return new;
end;
$$;

create trigger transactions_10_set_business_date
  before insert or update of transaction_timestamp on public.transactions
  for each row execute function public.set_business_date();

-- 2) Protect fields that must never change, and freeze voided records.
create or replace function public.protect_transaction_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'voided' then
    raise exception 'Voided transactions cannot be changed.' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.transaction_type is distinct from old.transaction_type
     or new.client_request_id is distinct from old.client_request_id
  then
    raise exception 'Owner, type, original creation time, and request id of a transaction cannot be changed.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger transactions_20_protect_fields
  before update on public.transactions
  for each row execute function public.protect_transaction_fields();

-- 3) A closed business date is locked until the owner reopens it.
create or replace function public.enforce_open_business_day()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.daily_closings c
             where c.business_date = new.business_date and c.status = 'closed') then
    raise exception 'Business date % is closed. Reopen the day before changing its transactions.', new.business_date;
  end if;

  if tg_op = 'UPDATE' and old.business_date <> new.business_date then
    if exists (select 1 from public.daily_closings c
               where c.business_date = old.business_date and c.status = 'closed') then
      raise exception 'Business date % is closed. Reopen the day before changing its transactions.', old.business_date;
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_30_enforce_open_day
  before insert or update on public.transactions
  for each row execute function public.enforce_open_business_day();
