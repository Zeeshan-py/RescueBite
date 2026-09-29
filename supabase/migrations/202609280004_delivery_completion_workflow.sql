-- Phase 8: volunteer delivery and NGO receipt confirmation.

alter table public.donations
  add column if not exists completed_at timestamptz;

alter table public.donations
  drop constraint if exists donations_completed_at_state;

alter table public.donations
  add constraint donations_completed_at_state check (
    (status = 'COMPLETED' and completed_at is not null)
    or (status <> 'COMPLETED' and completed_at is null)
  );

alter table public.pickup_tasks
  drop constraint if exists pickup_tasks_delivered_at_state;

alter table public.pickup_tasks
  add constraint pickup_tasks_delivered_at_state check (
    (status = 'DELIVERED' and collected_at is not null and delivered_at is not null)
    or (status <> 'DELIVERED' and delivered_at is null)
  );

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
    ('PICKUP_ASSIGNED', 'COLLECTED'), ('COLLECTED', 'DELIVERED'),
    ('DELIVERED', 'COMPLETED')
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
    or current_setting('app.delivery_workflow', true) = 'active'
    or current_setting('app.completion_workflow', true) = 'active'
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

create or replace function public.mark_pickup_delivered(target_task_id uuid)
returns public.pickup_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.pickup_tasks%rowtype;
  donation public.donations%rowtype;
begin
  if (select private.current_user_role()) is distinct from 'VOLUNTEER' then
    raise exception 'Only volunteers can mark pickup tasks delivered';
  end if;

  select * into task from public.pickup_tasks where id = target_task_id for update;
  if not found then raise exception 'Pickup task not found'; end if;
  if task.volunteer_id is distinct from (select auth.uid()) then
    raise exception 'Pickup task is assigned to another volunteer';
  end if;
  if task.status <> 'COLLECTED' then
    raise exception 'Only a collected pickup can be marked delivered';
  end if;

  select * into donation from public.donations where id = task.donation_id for update;
  if not found then raise exception 'Donation not found'; end if;
  if donation.status <> 'COLLECTED' then
    raise exception 'Donation is not in collected state';
  end if;

  perform set_config('app.delivery_workflow', 'active', true);
  update public.pickup_tasks
    set delivered_at = now(), status = 'DELIVERED'
    where id = task.id
    returning * into task;
  update public.donations set status = 'DELIVERED' where id = donation.id;
  insert into public.activity_logs (user_id, action, entity_type, entity_id)
    values ((select auth.uid()), 'FOOD_DELIVERED', 'PICKUP_TASK', task.id);
  return task;
end;
$$;

create or replace function public.confirm_donation_receipt(target_donation_id uuid)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare
  donation public.donations%rowtype;
begin
  if (select private.current_user_role()) is distinct from 'NGO' then
    raise exception 'Only NGO users can confirm donation receipt';
  end if;

  select * into donation from public.donations where id = target_donation_id for update;
  if not found then raise exception 'Donation not found'; end if;
  if not exists (
    select 1
    from public.matches m
    join public.ngos n on n.id = m.ngo_id
    where m.donation_id = donation.id
      and m.status = 'ACCEPTED'
      and n.user_id = (select auth.uid())
  ) then raise exception 'Donation is not assigned to this NGO'; end if;
  if donation.status <> 'DELIVERED' then
    raise exception 'Only a delivered donation can be confirmed';
  end if;
  if not exists (
    select 1 from public.pickup_tasks p
    where p.donation_id = donation.id
      and p.status = 'DELIVERED'
      and p.delivered_at is not null
  ) then raise exception 'Delivered pickup task not found'; end if;

  perform set_config('app.completion_workflow', 'active', true);
  update public.donations
    set status = 'COMPLETED', completed_at = now()
    where id = donation.id
    returning * into donation;
  insert into public.activity_logs (user_id, action, entity_type, entity_id)
    values
      ((select auth.uid()), 'NGO_CONFIRMED_DELIVERY', 'DONATION', donation.id),
      ((select auth.uid()), 'DONATION_COMPLETED', 'DONATION', donation.id);
  return donation;
end;
$$;

revoke all on function public.mark_pickup_delivered(uuid) from public, anon;
revoke all on function public.confirm_donation_receipt(uuid) from public, anon;
grant execute on function public.mark_pickup_delivered(uuid) to authenticated;
grant execute on function public.confirm_donation_receipt(uuid) to authenticated;

comment on function public.mark_pickup_delivered(uuid) is
  'Atomically moves the assigned volunteer pickup and donation from COLLECTED to DELIVERED.';
comment on function public.confirm_donation_receipt(uuid) is
  'Atomically lets the accepted NGO move a delivered donation to COMPLETED.';
