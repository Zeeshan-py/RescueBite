-- Phase 11: database aggregates and read-only administration.
-- Invoker functions retain RLS and derive authorization from the trusted profile.
create or replace function public.get_dashboard_summary()
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := private.current_user_role();
  counts jsonb;
  statuses jsonb;
begin
  if actor is null or actor_role is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if actor_role = 'ADMIN' then
    select jsonb_build_object(
      'total_users', count(*), 'donors', count(*) filter(where role = 'DONOR'),
      'ngo_users', count(*) filter(where role = 'NGO'),
      'volunteers', count(*) filter(where role = 'VOLUNTEER')
    ) into counts from public.users;
    counts := counts || jsonb_build_object('organizations', (select count(*) from public.ngos));
    select counts || jsonb_build_object(
      'total_donations', count(*),
      'active', count(*) filter(where status in ('POSTED','MATCHED','ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED')),
      'completed', count(*) filter(where status = 'COMPLETED'),
      'closed', count(*) filter(where status in ('CANCELLED','EXPIRED')),
      'exceptions', count(*) filter(where status = 'EXCEPTION')
    ) into counts from public.donations;
    select coalesce(jsonb_object_agg(status, total), '{}'::jsonb) into statuses
      from (select status, count(*) total from public.donations group by status) s;
    select counts || jsonb_build_object(
      'active_pickups', count(*) filter(where status in ('AVAILABLE','ASSIGNED','COLLECTED')),
      'delivered_pickups', count(*) filter(where status = 'DELIVERED')
    ) into counts from public.pickup_tasks;
  elsif actor_role = 'DONOR' then
    select jsonb_build_object(
      'total_donations', count(*),
      'active', count(*) filter(where status in ('POSTED','MATCHED','ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED')),
      'completed', count(*) filter(where status = 'COMPLETED'),
      'closed', count(*) filter(where status in ('CANCELLED','EXPIRED')),
      'awaiting_acceptance', count(*) filter(where status in ('POSTED','MATCHED')),
      'awaiting_pickup', count(*) filter(where status in ('ACCEPTED','PICKUP_ASSIGNED')),
      'delivered', count(*) filter(where status in ('DELIVERED','COMPLETED')),
      'exceptions', count(*) filter(where status = 'EXCEPTION')
    ) into counts from public.donations where donor_id = actor;
  elsif actor_role = 'NGO' then
    select jsonb_build_object(
      'suggested', count(*) filter(where m.status in ('SUGGESTED','VIEWED') and d.status = 'MATCHED' and d.collection_deadline > now()),
      'accepted', count(*) filter(where m.status = 'ACCEPTED'),
      'awaiting_pickup', count(*) filter(where m.status = 'ACCEPTED' and d.status in ('ACCEPTED','PICKUP_ASSIGNED')),
      'collected', count(*) filter(where m.status = 'ACCEPTED' and d.status = 'COLLECTED'),
      'awaiting_confirmation', count(*) filter(where m.status = 'ACCEPTED' and d.status = 'DELIVERED'),
      'completed', count(*) filter(where m.status = 'ACCEPTED' and d.status = 'COMPLETED')
    ) into counts from public.matches m join public.ngos n on n.id = m.ngo_id
      join public.donations d on d.id = m.donation_id where n.user_id = actor;
  elsif actor_role = 'VOLUNTEER' then
    select jsonb_build_object(
      'available', count(*) filter(where p.status = 'AVAILABLE' and d.status = 'ACCEPTED' and d.collection_deadline > now()),
      'assigned', count(*) filter(where p.volunteer_id = actor and p.status = 'ASSIGNED'),
      'collected', count(*) filter(where p.volunteer_id = actor and p.status = 'COLLECTED'),
      'delivered', count(*) filter(where p.volunteer_id = actor and p.status = 'DELIVERED'),
      'completed', count(*) filter(where p.volunteer_id = actor and d.status = 'COMPLETED'),
      'history', count(*) filter(where p.volunteer_id = actor and p.status in ('DELIVERED','CANCELLED'))
    ) into counts from public.pickup_tasks p join public.donations d on d.id = p.donation_id
      where p.volunteer_id = actor or p.status = 'AVAILABLE';
  end if;
  return jsonb_build_object('role', actor_role, 'counts', counts, 'statuses', coalesce(statuses, '{}'::jsonb));
end;
$$;

-- A separate admin entry point rejects non-admin callers instead of returning
-- their personal dashboard when platform statistics were requested.
create or replace function public.get_admin_dashboard()
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return public.get_dashboard_summary();
end;
$$;

create or replace function public.get_admin_records(
  view_name text, search_text text default '', status_filter text default '',
  role_filter text default '', food_filter text default '', action_filter text default '',
  entity_filter text default '', from_date date default null, to_date date default null,
  page_number integer default 1
)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb; term text; offset_rows integer;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if page_number is null or page_number < 1 or page_number > 100000 then raise exception 'Invalid page'; end if;
  if from_date > to_date then raise exception 'Invalid date range'; end if;
  -- Treat wildcards as literal search characters; no dynamic SQL is used.
  term := '%' || replace(replace(replace(left(coalesce(btrim(search_text), ''), 200), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  offset_rows := (page_number - 1) * 20;
  if view_name = 'users' then
    with filtered as not materialized (
      select id, name, email, role, created_at from public.users
      where (role_filter = '' or role::text = role_filter)
        and (name ilike term or email ilike term)
    ), page as (select * from filtered order by created_at desc, id desc limit 20 offset offset_rows)
    select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc, id desc) from page p), '[]'::jsonb),
      'total', (select count(*) from filtered)) into result;
  elsif view_name = 'donations' then
    with filtered as not materialized (
      select d.id, d.food_type, d.quantity, d.meal_portions, d.location, d.status, d.created_at, d.collection_deadline,
        u.name donor_name, n.organization_name, p.status pickup_status
      from public.donations d join public.users u on u.id = d.donor_id
      left join public.matches m on m.donation_id = d.id and m.status = 'ACCEPTED'
      left join public.ngos n on n.id = m.ngo_id
      left join lateral (select status from public.pickup_tasks where donation_id = d.id order by created_at desc, id desc limit 1) p on true
      where (status_filter = '' or d.status::text = status_filter)
        and (food_filter = '' or d.food_type = food_filter)
        and (from_date is null or d.created_at >= from_date::timestamptz)
        and (to_date is null or d.created_at < (to_date + 1)::timestamptz)
        and (d.food_type ilike term or d.location ilike term or u.name ilike term or n.organization_name ilike term)
    ), page as (select * from filtered order by created_at desc, id desc limit 20 offset offset_rows)
    select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc, id desc) from page p), '[]'::jsonb),
      'total', (select count(*) from filtered)) into result;
  elsif view_name = 'ngos' then
    with filtered as not materialized (
      select n.id, n.organization_name, u.name user_name, n.accepted_food_types, n.capacity, n.location,
        (n.latitude is not null and n.longitude is not null) has_coordinates, n.created_at,
        (select count(*) from public.matches m where m.ngo_id = n.id and m.status = 'ACCEPTED') accepted_count
      from public.ngos n join public.users u on u.id = n.user_id
      where n.organization_name ilike term or n.location ilike term or u.name ilike term
    ), page as (select * from filtered order by created_at desc, id desc limit 20 offset offset_rows)
    select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc, id desc) from page p), '[]'::jsonb),
      'total', (select count(*) from filtered)) into result;
  elsif view_name = 'volunteers' then
    with filtered as not materialized (
      select u.id, u.name, u.created_at,
        (select count(*) from public.pickup_tasks p where p.volunteer_id = u.id) pickup_count,
        (select count(*) from public.pickup_tasks p where p.volunteer_id = u.id and p.status in ('ASSIGNED','COLLECTED')) active_count,
        (select count(*) from public.pickup_tasks p where p.volunteer_id = u.id and p.collected_at is not null) collected_count,
        (select count(*) from public.pickup_tasks p where p.volunteer_id = u.id and p.status = 'DELIVERED') delivered_count
      from public.users u where u.role = 'VOLUNTEER' and u.name ilike term
    ), page as (select * from filtered order by created_at desc, id desc limit 20 offset offset_rows)
    select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc, id desc) from page p), '[]'::jsonb),
      'total', (select count(*) from filtered)) into result;
  elsif view_name = 'activity' then
    with filtered as not materialized (
      select a.id, a.action, a.entity_type, a.entity_id, a.created_at, u.name actor_name
      from public.activity_logs a left join public.users u on u.id = a.user_id
      where (action_filter = '' or a.action = action_filter)
        and (entity_filter = '' or a.entity_type = entity_filter)
        and (from_date is null or a.created_at >= from_date::timestamptz)
        and (to_date is null or a.created_at < (to_date + 1)::timestamptz)
        and (a.action ilike term or a.entity_id::text ilike term or u.name ilike term)
    ), page as (select * from filtered order by created_at desc, id desc limit 20 offset offset_rows)
    select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc, id desc) from page p), '[]'::jsonb),
      'total', (select count(*) from filtered)) into result;
  else raise exception 'Unknown administration view';
  end if;
  return result || jsonb_build_object('page', page_number, 'page_size', 20);
end;
$$;

revoke all on function public.get_dashboard_summary() from public, anon;
revoke all on function public.get_admin_dashboard() from public, anon;
revoke all on function public.get_admin_records(text,text,text,text,text,text,text,date,date,integer) from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;
grant execute on function public.get_admin_dashboard() to authenticated;
grant execute on function public.get_admin_records(text,text,text,text,text,text,text,date,date,integer) to authenticated;

-- Oversight does not authorize raw workflow editing. Other roles retain their
-- existing policies and secured transition functions are unchanged.
create policy donations_admin_read_only on public.donations as restrictive
  for update to authenticated using (not (select private.is_admin())) with check (not (select private.is_admin()));
create policy matches_admin_read_only on public.matches as restrictive
  for update to authenticated using (not (select private.is_admin())) with check (not (select private.is_admin()));
create policy pickups_admin_read_only on public.pickup_tasks as restrictive
  for update to authenticated using (not (select private.is_admin())) with check (not (select private.is_admin()));

-- Fill missing audit events in the existing log, without duplicating events
-- already recorded by the acceptance/pickup/delivery RPCs.
create or replace function private.log_dashboard_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare event_action text; related_type text;
begin
  if tg_table_name = 'matches' then event_action := 'MATCH_CREATED'; related_type := 'MATCH';
  else
    related_type := 'DONATION';
    if tg_op = 'INSERT' then event_action := 'DONATION_CREATED';
    elsif old.status is distinct from new.status and new.status = 'EXPIRED' then event_action := 'DONATION_EXPIRED';
    elsif old.status is distinct from new.status and new.status = 'EXCEPTION' then event_action := 'DONATION_EXCEPTION';
    end if;
  end if;
  if event_action is not null then
    insert into public.activity_logs(user_id, action, entity_type, entity_id)
      values (auth.uid(), event_action, related_type, new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.log_dashboard_event() from public, anon, authenticated;
create trigger donations_dashboard_audit after insert or update of status on public.donations
  for each row execute function private.log_dashboard_event();
create trigger matches_dashboard_audit after insert on public.matches
  for each row execute function private.log_dashboard_event();

-- Global recent audit ordering was not covered by the actor-scoped index.
create index activity_logs_created_at_idx on public.activity_logs(created_at desc, id desc);
comment on function public.get_admin_dashboard() is 'Read-only platform aggregates; verified ADMIN profile required.';
comment on function public.get_admin_records(text,text,text,text,text,text,text,date,date,integer) is 'RLS-protected admin lists with database filtering and fixed 20-row pages.';
