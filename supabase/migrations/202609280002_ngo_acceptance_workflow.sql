-- Phase 6: atomic NGO acceptance/decline and guarded donation transitions.

create or replace function public.enforce_match_status_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Match status changes are reserved for narrowly scoped SECURITY DEFINER workflows.
  if current_user in ('postgres', 'service_role') then return new; end if;
  raise exception 'Match status must be changed through an authorized workflow';
end;
$$;

drop trigger if exists matches_enforce_status_workflow on public.matches;
create trigger matches_enforce_status_workflow
before update of status on public.matches
for each row execute function public.enforce_match_status_workflow();

create or replace function public.enforce_donor_donation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transition_allowed boolean;
begin
  transition_allowed := old.status = new.status or (old.status, new.status) in (
    ('POSTED', 'MATCHED'), ('POSTED', 'CANCELLED'), ('POSTED', 'EXPIRED'),
    ('MATCHED', 'ACCEPTED'), ('MATCHED', 'CANCELLED'), ('MATCHED', 'EXCEPTION'), ('MATCHED', 'POSTED'),
    ('ACCEPTED', 'CANCELLED')
  );
  if not transition_allowed then
    raise exception 'Invalid donation status transition: % to %', old.status, new.status;
  end if;

  if current_setting('app.matching_engine', true) = 'active' then
    if new.status = 'MATCHED' and not exists (
      select 1 from public.matches
      where donation_id = new.id and status in ('SUGGESTED', 'VIEWED')
    ) then new.status := 'POSTED'; end if;
    return new;
  end if;

  if current_setting('app.ngo_workflow', true) = 'active'
    or current_setting('app.expiry_workflow', true) = 'active'
    or current_setting('app.cancel_workflow', true) = 'active'
    or (select auth.uid()) is null
    or (select private.is_admin()) then
    return new;
  end if;

  if old.donor_id <> (select auth.uid()) or new.donor_id <> old.donor_id then
    raise exception 'A donor may update only their own donation';
  end if;
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
returns table (
  result_match_id uuid,
  result_match_status public.match_status,
  result_donation_id uuid,
  result_donation_status public.donation_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_match public.matches%rowtype;
  target_donation public.donations%rowtype;
  normalized_decision text := upper(btrim(decision));
begin
  if (select private.current_user_role()) <> 'NGO' then raise exception 'Only NGO users can respond to matches'; end if;
  if normalized_decision not in ('ACCEPT', 'DECLINE') then raise exception 'Decision must be ACCEPT or DECLINE'; end if;

  -- Resolve ownership first, then lock the shared donation before any match row.
  -- A consistent lock order prevents two NGOs from deadlocking each other.
  select m.* into target_match
  from public.matches m join public.ngos n on n.id = m.ngo_id
  where m.id = target_match_id and n.user_id = (select auth.uid());
  if not found then raise exception 'Match not found or not authorized'; end if;

  select * into target_donation from public.donations where id = target_match.donation_id for update;
  if not found then raise exception 'Donation not found'; end if;
  select m.* into target_match
  from public.matches m join public.ngos n on n.id = m.ngo_id
  where m.id = target_match_id and n.user_id = (select auth.uid())
  for update of m;
  if not found then raise exception 'Match not found or not authorized'; end if;
  if target_match.status not in ('SUGGESTED', 'VIEWED') then raise exception 'Match is no longer actionable'; end if;
  if target_donation.status <> 'MATCHED' then raise exception 'Donation is no longer available'; end if;
  if target_donation.collection_deadline <= now() then raise exception 'Donation collection deadline has passed'; end if;

  perform set_config('app.ngo_workflow', 'active', true);
  if normalized_decision = 'ACCEPT' then
    update public.matches set status = 'ACCEPTED' where id = target_match.id;
    update public.matches set status = 'EXPIRED'
      where donation_id = target_donation.id and id <> target_match.id and status in ('SUGGESTED', 'VIEWED');
    update public.donations set status = 'ACCEPTED' where id = target_donation.id;
    insert into public.activity_logs (user_id, action, entity_type, entity_id)
      values ((select auth.uid()), 'NGO_ACCEPTED_DONATION', 'DONATION', target_donation.id);
  else
    update public.matches set status = 'REJECTED' where id = target_match.id;
    if not exists (
      select 1 from public.matches
      where donation_id = target_donation.id and status in ('SUGGESTED', 'VIEWED')
    ) then
      update public.donations set status = 'POSTED' where id = target_donation.id;
    end if;
    insert into public.activity_logs (user_id, action, entity_type, entity_id)
      values ((select auth.uid()), 'NGO_DECLINED_DONATION', 'MATCH', target_match.id);
  end if;

  return query
  select m.id, m.status, d.id, d.status
  from public.matches m join public.donations d on d.id = m.donation_id
  where m.id = target_match.id;
end;
$$;

create or replace function public.expire_overdue_donations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  perform set_config('app.expiry_workflow', 'active', true);
  with expired as (
    update public.donations set status = 'EXPIRED'
    where status in ('POSTED', 'MATCHED') and collection_deadline <= now()
    returning id
  )
  update public.matches set status = 'EXPIRED'
  where donation_id in (select id from expired) and status in ('SUGGESTED', 'VIEWED');
  get diagnostics affected = row_count;
  return affected;
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
  update public.matches set status = 'EXPIRED'
    where donation_id = target.id and status in ('SUGGESTED', 'VIEWED');
  insert into public.activity_logs (user_id, action, entity_type, entity_id)
    values ((select auth.uid()), 'DONOR_CANCELLED_DONATION', 'DONATION', target.id);
  return target;
end;
$$;

revoke all on function public.respond_to_donation_match(uuid, text) from public, anon;
revoke all on function public.expire_overdue_donations() from public, anon;
revoke all on function public.cancel_my_donation(uuid) from public, anon;
grant execute on function public.respond_to_donation_match(uuid, text) to authenticated;
grant execute on function public.expire_overdue_donations() to authenticated;
grant execute on function public.cancel_my_donation(uuid) to authenticated;

comment on function public.respond_to_donation_match(uuid, text) is
  'Atomically accepts or declines an NGO-owned actionable match and records the action.';
