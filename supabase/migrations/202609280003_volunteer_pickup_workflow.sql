-- Phase 7: volunteer pickup workflow through collection only.

alter table public.pickup_tasks
  drop constraint if exists pickup_tasks_assignment_required;

alter table public.pickup_tasks
  add constraint pickup_tasks_assignment_required check (
    status in ('AVAILABLE', 'CANCELLED') or volunteer_id is not null
  );

create unique index if not exists pickup_tasks_one_active_per_donation_idx
  on public.pickup_tasks (donation_id)
  where status <> 'CANCELLED';

create or replace function public.validate_pickup_task_donation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.donations d
    where d.id = new.donation_id and d.status = 'ACCEPTED'
      and exists (select 1 from public.matches m where m.donation_id = d.id and m.status = 'ACCEPTED')
  ) then raise exception 'Pickup tasks require an accepted donation and NGO match'; end if;
  return new;
end;
$$;

drop trigger if exists pickup_tasks_validate_donation on public.pickup_tasks;
create trigger pickup_tasks_validate_donation
before insert on public.pickup_tasks
for each row execute function public.validate_pickup_task_donation();

create or replace function public.enforce_pickup_task_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role') then return new; end if;
  raise exception 'Pickup assignment and status must be changed through an authorized workflow';
end;
$$;

drop trigger if exists pickup_tasks_enforce_workflow on public.pickup_tasks;
create trigger pickup_tasks_enforce_workflow
before update of volunteer_id, pickup_time, collected_at, delivered_at, status on public.pickup_tasks
for each row execute function public.enforce_pickup_task_workflow();

create or replace function public.enforce_donor_donation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare transition_allowed boolean;
begin
  transition_allowed := old.status = new.status or (old.status, new.status) in (
    ('POSTED', 'MATCHED'), ('POSTED', 'CANCELLED'), ('POSTED', 'EXPIRED'),
    ('MATCHED', 'ACCEPTED'), ('MATCHED', 'CANCELLED'), ('MATCHED', 'EXCEPTION'), ('MATCHED', 'POSTED'),
    ('ACCEPTED', 'CANCELLED'), ('ACCEPTED', 'PICKUP_ASSIGNED'),
    ('PICKUP_ASSIGNED', 'COLLECTED')
  );
  if not transition_allowed then raise exception 'Invalid donation status transition: % to %', old.status, new.status; end if;

  if current_setting('app.matching_engine', true) = 'active' then
    if new.status = 'MATCHED' and not exists (
      select 1 from public.matches where donation_id = new.id and status in ('SUGGESTED', 'VIEWED')
    ) then new.status := 'POSTED'; end if;
    return new;
  end if;
  if current_setting('app.ngo_workflow', true) = 'active'
    or current_setting('app.pickup_workflow', true) = 'active'
    or current_setting('app.expiry_workflow', true) = 'active'
    or current_setting('app.cancel_workflow', true) = 'active'
    or (select auth.uid()) is null or (select private.is_admin()) then return new; end if;

  if old.donor_id <> (select auth.uid()) or new.donor_id <> old.donor_id then raise exception 'A donor may update only their own donation'; end if;
  if old.status = 'POSTED' and new.status in ('POSTED', 'CANCELLED') then return new; end if;
  if old.status in ('MATCHED', 'ACCEPTED') and new.status = 'CANCELLED'
    and new.food_type = old.food_type and new.quantity = old.quantity
    and new.meal_portions = old.meal_portions and new.location = old.location
    and new.available_from = old.available_from and new.collection_deadline = old.collection_deadline
    and new.safety_information is not distinct from old.safety_information
    and new.description is not distinct from old.description then return new; end if;
  raise exception 'This donation update is not allowed in its current state';
end;
$$;

create or replace function public.respond_to_donation_match(target_match_id uuid, decision text)
returns table (result_match_id uuid, result_match_status public.match_status, result_donation_id uuid, result_donation_status public.donation_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_match public.matches%rowtype;
  target_donation public.donations%rowtype;
  normalized_decision text := upper(btrim(decision));
  new_pickup_id uuid;
begin
  if (select private.current_user_role()) <> 'NGO' then raise exception 'Only NGO users can respond to matches'; end if;
  if normalized_decision not in ('ACCEPT', 'DECLINE') then raise exception 'Decision must be ACCEPT or DECLINE'; end if;
  select m.* into target_match from public.matches m join public.ngos n on n.id = m.ngo_id
    where m.id = target_match_id and n.user_id = (select auth.uid());
  if not found then raise exception 'Match not found or not authorized'; end if;
  select * into target_donation from public.donations where id = target_match.donation_id for update;
  if not found then raise exception 'Donation not found'; end if;
  select m.* into target_match from public.matches m join public.ngos n on n.id = m.ngo_id
    where m.id = target_match_id and n.user_id = (select auth.uid()) for update of m;
  if not found then raise exception 'Match not found or not authorized'; end if;
  if target_match.status not in ('SUGGESTED', 'VIEWED') then raise exception 'Match is no longer actionable'; end if;
  if target_donation.status <> 'MATCHED' then raise exception 'Donation is no longer available'; end if;
  if target_donation.collection_deadline <= now() then raise exception 'Donation collection deadline has passed'; end if;

  perform set_config('app.ngo_workflow', 'active', true);
  if normalized_decision = 'ACCEPT' then
    update public.matches set status = 'ACCEPTED' where id = target_match.id;
    update public.matches set status = 'EXPIRED' where donation_id = target_donation.id and id <> target_match.id and status in ('SUGGESTED', 'VIEWED');
    update public.donations set status = 'ACCEPTED' where id = target_donation.id;
    insert into public.activity_logs (user_id, action, entity_type, entity_id)
      values ((select auth.uid()), 'NGO_ACCEPTED_DONATION', 'DONATION', target_donation.id);
    insert into public.pickup_tasks (donation_id, pickup_location, delivery_location, status)
      select target_donation.id, target_donation.location, n.location, 'AVAILABLE'
      from public.ngos n where n.id = target_match.ngo_id
        and not exists (select 1 from public.pickup_tasks p where p.donation_id = target_donation.id and p.status <> 'CANCELLED')
      returning id into new_pickup_id;
    if new_pickup_id is not null then
      insert into public.activity_logs (user_id, action, entity_type, entity_id)
        values ((select auth.uid()), 'PICKUP_TASK_CREATED', 'PICKUP_TASK', new_pickup_id);
    end if;
  else
    update public.matches set status = 'REJECTED' where id = target_match.id;
    if not exists (select 1 from public.matches where donation_id = target_donation.id and status in ('SUGGESTED', 'VIEWED')) then
      update public.donations set status = 'POSTED' where id = target_donation.id;
    end if;
    insert into public.activity_logs (user_id, action, entity_type, entity_id)
      values ((select auth.uid()), 'NGO_DECLINED_DONATION', 'MATCH', target_match.id);
  end if;
  return query select m.id, m.status, d.id, d.status from public.matches m join public.donations d on d.id = m.donation_id where m.id = target_match.id;
end;
$$;

create or replace function public.claim_pickup_task(target_task_id uuid)
returns public.pickup_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare task public.pickup_tasks%rowtype; donation public.donations%rowtype;
begin
  if (select private.current_user_role()) <> 'VOLUNTEER' then raise exception 'Only volunteers can claim pickup tasks'; end if;
  select * into task from public.pickup_tasks where id = target_task_id for update;
  if not found then raise exception 'Pickup task not found'; end if;
  select * into donation from public.donations where id = task.donation_id for update;
  if task.status <> 'AVAILABLE' or task.volunteer_id is not null then raise exception 'Pickup task is no longer available'; end if;
  if donation.status <> 'ACCEPTED' then raise exception 'Donation is not ready for pickup assignment'; end if;
  if donation.collection_deadline <= now() then raise exception 'Donation collection deadline has passed'; end if;
  perform set_config('app.pickup_workflow', 'active', true);
  update public.pickup_tasks set volunteer_id = (select auth.uid()), pickup_time = now(), status = 'ASSIGNED'
    where id = task.id returning * into task;
  update public.donations set status = 'PICKUP_ASSIGNED' where id = donation.id;
  insert into public.activity_logs (user_id, action, entity_type, entity_id)
    values ((select auth.uid()), 'VOLUNTEER_CLAIMED_PICKUP', 'PICKUP_TASK', task.id);
  return task;
end;
$$;

create or replace function public.mark_pickup_collected(target_task_id uuid)
returns public.pickup_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare task public.pickup_tasks%rowtype; donation public.donations%rowtype;
begin
  if (select private.current_user_role()) <> 'VOLUNTEER' then raise exception 'Only volunteers can collect pickup tasks'; end if;
  select * into task from public.pickup_tasks where id = target_task_id for update;
  if not found then raise exception 'Pickup task not found'; end if;
  if task.volunteer_id <> (select auth.uid()) then raise exception 'Pickup task is assigned to another volunteer'; end if;
  if task.status <> 'ASSIGNED' then raise exception 'Only an assigned pickup can be marked collected'; end if;
  select * into donation from public.donations where id = task.donation_id for update;
  if donation.status <> 'PICKUP_ASSIGNED' then raise exception 'Donation is not in pickup-assigned state'; end if;
  perform set_config('app.pickup_workflow', 'active', true);
  update public.pickup_tasks set collected_at = now(), status = 'COLLECTED' where id = task.id returning * into task;
  update public.donations set status = 'COLLECTED' where id = donation.id;
  insert into public.activity_logs (user_id, action, entity_type, entity_id)
    values ((select auth.uid()), 'VOLUNTEER_COLLECTED_PICKUP', 'PICKUP_TASK', task.id);
  return task;
end;
$$;

create or replace function public.cancel_my_donation(target_donation_id uuid)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare target public.donations%rowtype;
begin
  select * into target from public.donations where id = target_donation_id for update;
  if not found or target.donor_id <> (select auth.uid()) then raise exception 'Donation not found or not authorized'; end if;
  if target.status not in ('POSTED', 'MATCHED', 'ACCEPTED') then raise exception 'Donation cannot be cancelled in its current state'; end if;
  perform set_config('app.cancel_workflow', 'active', true);
  update public.donations set status = 'CANCELLED' where id = target.id returning * into target;
  update public.matches set status = 'EXPIRED' where donation_id = target.id and status in ('SUGGESTED', 'VIEWED');
  update public.pickup_tasks set status = 'CANCELLED' where donation_id = target.id and status = 'AVAILABLE';
  insert into public.activity_logs (user_id, action, entity_type, entity_id)
    values ((select auth.uid()), 'DONOR_CANCELLED_DONATION', 'DONATION', target.id);
  return target;
end;
$$;

revoke all on function public.claim_pickup_task(uuid) from public, anon;
revoke all on function public.mark_pickup_collected(uuid) from public, anon;
grant execute on function public.claim_pickup_task(uuid) to authenticated;
grant execute on function public.mark_pickup_collected(uuid) to authenticated;

comment on function public.claim_pickup_task(uuid) is 'Atomically assigns one AVAILABLE pickup to the authenticated volunteer.';
comment on function public.mark_pickup_collected(uuid) is 'Moves the authenticated volunteer own ASSIGNED pickup to COLLECTED.';
