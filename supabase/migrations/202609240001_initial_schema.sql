-- RescueBite Phase 2: initial PostgreSQL/Supabase database foundation.
-- ERD.md is the source of truth for the entities in this migration.

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('DONOR', 'NGO', 'VOLUNTEER', 'ADMIN');
create type public.donation_status as enum (
  'POSTED', 'MATCHED', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED',
  'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'EXCEPTION'
);
create type public.match_status as enum ('SUGGESTED', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
create type public.pickup_task_status as enum ('AVAILABLE', 'ASSIGNED', 'COLLECTED', 'DELIVERED', 'CANCELLED');
create type public.notification_type as enum (
  'DONATION_ACCEPTED', 'MATCH_FOUND', 'PICKUP_ASSIGNED', 'PICKUP_REMINDER',
  'FOOD_COLLECTED', 'FOOD_DELIVERED', 'DONATION_COMPLETED',
  'DONATION_EXPIRED', 'DONATION_CANCELLED'
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  email text not null unique check (btrim(email) <> ''),
  phone text,
  role public.app_role not null,
  location text,
  created_at timestamptz not null default now()
);

create table public.ngos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete restrict,
  organization_name text not null check (btrim(organization_name) <> ''),
  description text,
  location text not null check (btrim(location) <> ''),
  capacity integer not null default 0 check (capacity >= 0),
  accepted_food_types text[] not null default '{}'::text[],
  contact_information text,
  created_at timestamptz not null default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.users (id) on delete restrict,
  food_type text not null check (btrim(food_type) <> ''),
  quantity numeric(12, 2) not null check (quantity >= 0),
  meal_portions integer not null check (meal_portions >= 0),
  location text not null check (btrim(location) <> ''),
  available_from timestamptz not null,
  collection_deadline timestamptz not null,
  safety_information text,
  description text,
  status public.donation_status not null default 'POSTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donations_valid_collection_window check (collection_deadline > available_from)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations (id) on delete restrict,
  ngo_id uuid not null references public.ngos (id) on delete restrict,
  matching_score numeric(5, 2) not null check (matching_score between 0 and 100),
  distance_score numeric(5, 2) not null check (distance_score between 0 and 100),
  urgency_score numeric(5, 2) not null check (urgency_score between 0 and 100),
  compatibility_score numeric(5, 2) not null check (compatibility_score between 0 and 100),
  capacity_score numeric(5, 2) not null check (capacity_score between 0 and 100),
  availability_score numeric(5, 2) not null check (availability_score between 0 and 100),
  status public.match_status not null default 'SUGGESTED',
  created_at timestamptz not null default now(),
  constraint matches_donation_ngo_unique unique (donation_id, ngo_id)
);

create table public.pickup_tasks (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations (id) on delete restrict,
  volunteer_id uuid references public.users (id) on delete set null,
  pickup_location text not null check (btrim(pickup_location) <> ''),
  delivery_location text not null check (btrim(delivery_location) <> ''),
  pickup_time timestamptz,
  collected_at timestamptz,
  delivered_at timestamptz,
  status public.pickup_task_status not null default 'AVAILABLE',
  notes text,
  created_at timestamptz not null default now(),
  constraint pickup_tasks_delivery_order check (
    delivered_at is null or collected_at is null or delivered_at >= collected_at
  ),
  constraint pickup_tasks_assignment_required check (
    status = 'AVAILABLE' or volunteer_id is not null
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  message text not null check (btrim(message) <> ''),
  type public.notification_type not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  action text not null check (btrim(action) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id uuid not null,
  created_at timestamptz not null default now()
);

-- Indexes support the workflow's common filtering and relationship lookups.
create index donations_status_idx on public.donations (status);
create index donations_donor_id_idx on public.donations (donor_id);
create index donations_collection_deadline_idx on public.donations (collection_deadline);
create index donations_created_at_idx on public.donations (created_at desc);
create index matches_donation_id_idx on public.matches (donation_id);
create index matches_ngo_id_idx on public.matches (ngo_id);
create index matches_created_at_idx on public.matches (created_at desc);
create unique index matches_one_accepted_per_donation_idx
  on public.matches (donation_id) where status = 'ACCEPTED';
create index pickup_tasks_donation_id_idx on public.pickup_tasks (donation_id);
create index pickup_tasks_volunteer_id_idx on public.pickup_tasks (volunteer_id);
create index pickup_tasks_status_idx on public.pickup_tasks (status);
create index notifications_user_created_at_idx on public.notifications (user_id, created_at desc);
create index activity_logs_user_created_at_idx on public.activity_logs (user_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger donations_set_updated_at
before update on public.donations
for each row execute function public.set_updated_at();

-- Role guards prevent records from being assigned to the wrong profile type.
create or replace function public.validate_ngo_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.users where id = new.user_id and role = 'NGO'
  ) then
    raise exception 'NGO profiles require a user with the NGO role';
  end if;
  return new;
end;
$$;

create or replace function public.validate_donor_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.users where id = new.donor_id and role = 'DONOR'
  ) then
    raise exception 'Donations require a user with the DONOR role';
  end if;
  return new;
end;
$$;

create or replace function public.validate_volunteer_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.volunteer_id is not null and not exists (
    select 1 from public.users where id = new.volunteer_id and role = 'VOLUNTEER'
  ) then
    raise exception 'Pickup assignments require a user with the VOLUNTEER role';
  end if;
  return new;
end;
$$;

create trigger ngos_validate_user_role
before insert or update of user_id on public.ngos
for each row execute function public.validate_ngo_user_role();

create trigger donations_validate_donor_role
before insert or update of donor_id on public.donations
for each row execute function public.validate_donor_user_role();

create trigger pickup_tasks_validate_volunteer_role
before insert or update of volunteer_id on public.pickup_tasks
for each row execute function public.validate_volunteer_user_role();

-- Private SECURITY DEFINER helpers read authorization data without recursive RLS.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'ADMIN', false);
$$;

create or replace function private.is_donation_owner(target_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.donations
    where id = target_donation_id and donor_id = (select auth.uid())
  );
$$;

create or replace function private.is_ngo_owner(target_ngo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ngos
    where id = target_ngo_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.ngo_has_match(target_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    join public.ngos n on n.id = m.ngo_id
    where m.donation_id = target_donation_id
      and n.user_id = (select auth.uid())
  );
$$;

create or replace function private.volunteer_can_view_donation(target_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pickup_tasks
    where donation_id = target_donation_id
      and (status = 'AVAILABLE' or volunteer_id = (select auth.uid()))
  );
$$;

create or replace function private.ngo_can_view_pickup(target_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    join public.ngos n on n.id = m.ngo_id
    where m.donation_id = target_donation_id
      and m.status = 'ACCEPTED'
      and n.user_id = (select auth.uid())
  );
$$;

revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_donation_owner(uuid) to authenticated;
grant execute on function private.is_ngo_owner(uuid) to authenticated;
grant execute on function private.ngo_has_match(uuid) to authenticated;
grant execute on function private.volunteer_can_view_donation(uuid) to authenticated;
grant execute on function private.ngo_can_view_pickup(uuid) to authenticated;

alter table public.users enable row level security;
alter table public.ngos enable row level security;
alter table public.donations enable row level security;
alter table public.matches enable row level security;
alter table public.pickup_tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

-- Remove broad API access, then grant only operations backed by policies.
revoke all on table public.users, public.ngos, public.donations, public.matches,
  public.pickup_tasks, public.notifications, public.activity_logs from anon, authenticated;

grant select on table public.users, public.ngos, public.donations, public.matches,
  public.pickup_tasks, public.notifications to authenticated;
grant insert (id, name, email, phone, role, location) on public.users to authenticated;
grant update (name, phone, location) on public.users to authenticated;
grant insert on public.ngos, public.donations to authenticated;
grant update on public.ngos, public.donations to authenticated;
grant update (status) on public.matches to authenticated;
grant update (volunteer_id, pickup_time, collected_at, delivered_at, status, notes)
  on public.pickup_tasks to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant select on table public.activity_logs to authenticated;

create policy users_select_own_or_admin on public.users
for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

create policy users_insert_own_profile on public.users
for insert to authenticated
with check (
  id = (select auth.uid())
  and role <> 'ADMIN'
  and email = (select auth.jwt() ->> 'email')
);

create policy users_update_own_or_admin on public.users
for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

create policy ngos_select_workflow_participants on public.ngos
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
  or (select private.current_user_role()) in ('DONOR', 'NGO')
);

create policy ngos_insert_own_or_admin on public.ngos
for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));

create policy ngos_update_own_or_admin on public.ngos
for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

create policy donations_select_workflow_participants on public.donations
for select to authenticated
using (
  donor_id = (select auth.uid())
  or (select private.is_admin())
  or (
    (select private.current_user_role()) = 'NGO'
    and (select private.ngo_has_match(id))
  )
  or (
    (select private.current_user_role()) = 'VOLUNTEER'
    and (select private.volunteer_can_view_donation(id))
  )
);

create policy donations_insert_own_or_admin on public.donations
for insert to authenticated
with check (donor_id = (select auth.uid()) or (select private.is_admin()));

create policy donations_update_own_or_admin on public.donations
for update to authenticated
using (donor_id = (select auth.uid()) or (select private.is_admin()))
with check (donor_id = (select auth.uid()) or (select private.is_admin()));

create policy matches_select_participants_or_admin on public.matches
for select to authenticated
using (
  (select private.is_admin())
  or (select private.is_donation_owner(donation_id))
  or (select private.is_ngo_owner(ngo_id))
);

create policy matches_update_own_ngo_or_admin on public.matches
for update to authenticated
using ((select private.is_ngo_owner(ngo_id)) or (select private.is_admin()))
with check ((select private.is_ngo_owner(ngo_id)) or (select private.is_admin()));

create policy pickup_tasks_select_workflow_participants on public.pickup_tasks
for select to authenticated
using (
  (select private.is_admin())
  or (select private.is_donation_owner(donation_id))
  or (
    (select private.current_user_role()) = 'NGO'
    and (select private.ngo_can_view_pickup(donation_id))
  )
  or (
    (select private.current_user_role()) = 'VOLUNTEER'
    and (status = 'AVAILABLE' or volunteer_id = (select auth.uid()))
  )
);

create policy pickup_tasks_update_authorized_volunteer_or_admin on public.pickup_tasks
for update to authenticated
using (
  (select private.is_admin())
  or (
    (select private.current_user_role()) = 'VOLUNTEER'
    and (status = 'AVAILABLE' or volunteer_id = (select auth.uid()))
  )
)
with check (
  (select private.is_admin())
  or (
    (select private.current_user_role()) = 'VOLUNTEER'
    and volunteer_id = (select auth.uid())
    and status in ('ASSIGNED', 'COLLECTED', 'DELIVERED', 'CANCELLED')
  )
);

create policy notifications_select_own_or_admin on public.notifications
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy notifications_update_own_or_admin on public.notifications
for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

create policy activity_logs_select_admin_only on public.activity_logs
for select to authenticated
using ((select private.is_admin()));

-- Backend jobs use service_role to create matches, tasks, notifications, and logs.
grant all on table public.users, public.ngos, public.donations, public.matches,
  public.pickup_tasks, public.notifications, public.activity_logs to service_role;

comment on table public.users is 'Application profiles keyed by auth.users.id; contains no credentials.';
comment on schema private is 'Authorization helpers excluded from the Supabase Data API.';
