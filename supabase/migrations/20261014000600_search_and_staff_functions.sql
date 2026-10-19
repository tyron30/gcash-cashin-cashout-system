-- =====================================================================
-- GCash Monitor - Migration 6 (Phase 4): search, summary, staff list
-- Run this ONCE in the SQL Editor after migrations 1-5.
--   * search_transactions / transaction_summary: the History page and
--     reports use these, so filters are passed as safe parameters (no
--     text-built filters) and totals are correct across ALL matching rows.
--   * profiles.email + admin_list_profiles: lets the owner see which
--     login is which. Staff cannot read other people's emails.
-- =====================================================================

-- ---------- Email on profiles (owner-visible only) ----------
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ), 80),
    new.email,
    'staff',
    false
  );
  return new;
end;
$$;

-- Logged-in users may read every profile column EXCEPT email.
-- (So the app must always name its columns instead of using select '*'.)
revoke select on public.profiles from authenticated;
grant select (id, full_name, role, is_active, created_at, updated_at) on public.profiles to authenticated;

-- Owner-only list that includes email and last login.
create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  return query
  select p.id,
         coalesce(p.email, u.email::text),
         p.full_name,
         p.role,
         p.is_active,
         p.created_at,
         u.last_sign_in_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.is_active asc, p.role asc, lower(p.full_name);
end;
$$;

-- ---------- Transaction search ----------
-- security invoker: Row Level Security still applies (staff only get today).
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
  updated_at timestamptz
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
         t.created_by, p.full_name, t.created_at, t.updated_at
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

-- Same filters, one row of totals (voided records are never counted in money).
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
  voided_count integer
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
    (count(*) filter (where t.status = 'voided'))::integer
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

-- ---------- Permissions ----------
revoke execute on function public.admin_list_profiles()
  from public, anon, authenticated;
revoke execute on function public.search_transactions(date, date, text, text, uuid, text, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.transaction_summary(date, date, text, text, uuid, text)
  from public, anon, authenticated;

grant execute on function public.admin_list_profiles() to authenticated;
grant execute on function public.search_transactions(date, date, text, text, uuid, text, text, integer, integer) to authenticated;
grant execute on function public.transaction_summary(date, date, text, text, uuid, text) to authenticated;
