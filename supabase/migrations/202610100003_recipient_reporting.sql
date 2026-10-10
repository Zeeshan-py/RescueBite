-- Reporting, matching and notifications for both recipient pathways.

create or replace function public.get_matching_ngos(target_donation_id uuid)
returns table (id uuid, user_id uuid, organization_name text, location text, capacity integer,
  accepted_food_types text[], latitude numeric, longitude numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.donations d where d.id = target_donation_id
    and d.donor_id = (select auth.uid()) and (select private.current_user_role()) = 'DONOR'
    and d.status in ('POSTED', 'MATCHED') and d.recipient_scope in ('NGO_ONLY','BOTH') and d.collection_deadline > now()) then
    raise exception 'Not authorized to match this donation' using errcode = '42501';
  end if;
  return query select n.id, n.user_id, n.organization_name, n.location, n.capacity,
    n.accepted_food_types, n.latitude, n.longitude from public.ngos n where n.verification_status='VERIFIED' and n.capacity > 0;
end;
$$;
revoke all on function public.get_matching_ngos(uuid) from public, anon;
grant execute on function public.get_matching_ngos(uuid) to authenticated;


create or replace function public.cancel_my_donation(target_donation_id uuid)
returns public.donations
language plpgsql
security definer
set search_path = ''
as $$
declare target public.donations%rowtype;
begin
  perform private.require_actor('DONOR');
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


create or replace function private.notify_donation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if tg_op = 'INSERT' then
    perform private.create_notification(
      new.donor_id, 'DONATION_CREATED', 'Donation posted',
      'Your donation was posted successfully and is ready for matching.',
      'DONATION', new.id, 'donation-created:' || new.id || ':' || new.donor_id
    );
    return new;
  end if;

  if new.status is not distinct from old.status then return new; end if;

  if new.status = 'COMPLETED' then
    perform private.create_notification(
      new.donor_id, 'RECEIPT_CONFIRMED', 'Receipt confirmed',
      'The recipient confirmed collection of your food donation.',
      'DONATION', new.id, 'receipt-confirmed:' || new.id || ':' || new.donor_id
    );
    perform private.create_notification(
      new.donor_id, 'DONATION_COMPLETED', 'Donation completed',
      'Your food rescue is complete. Thank you for helping your community.',
      'DONATION', new.id, 'donation-completed:' || new.id || ':' || new.donor_id
    );

    for recipient in
      select n.user_id from public.matches m join public.ngos n on n.id = m.ngo_id
      where m.donation_id = new.id and m.status = 'ACCEPTED'
      union
      select p.volunteer_id from public.pickup_tasks p
      where p.donation_id = new.id and p.volunteer_id is not null
    loop
      perform private.create_notification(
        recipient, 'DONATION_COMPLETED', 'Donation completed',
        'The donation workflow has been completed successfully.',
        'DONATION', new.id, 'donation-completed:' || new.id || ':' || recipient
      );
    end loop;
  elsif new.status in ('CANCELLED', 'EXPIRED', 'EXCEPTION') then
    for recipient in
      select new.donor_id
      union
      select n.user_id from public.matches m join public.ngos n on n.id = m.ngo_id
      where m.donation_id = new.id
      union
      select p.volunteer_id from public.pickup_tasks p
      where p.donation_id = new.id and p.volunteer_id is not null
    loop
      if new.status = 'CANCELLED' then
        perform private.create_notification(
          recipient, 'DONATION_CANCELLED', 'Donation cancelled',
          'This donation has been cancelled and is no longer active.',
          'DONATION', new.id, 'donation-cancelled:' || new.id || ':' || recipient
        );
      elsif new.status = 'EXPIRED' then
        perform private.create_notification(
          recipient, 'DONATION_EXPIRED', 'Donation expired',
          'The collection deadline passed before this donation was completed.',
          'DONATION', new.id, 'donation-expired:' || new.id || ':' || recipient
        );
      else
        perform private.create_notification(
          recipient, 'DONATION_EXCEPTION', 'Donation needs attention',
          'An exception was recorded for this donation. Please review its current status.',
          'DONATION', new.id, 'donation-exception:' || new.id || ':' || recipient
        );
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function private.notify_match_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare donor uuid; ngo_user uuid;
begin
  select d.donor_id, n.user_id into donor, ngo_user
  from public.donations d, public.ngos n
  where d.id = new.donation_id and n.id = new.ngo_id;

  if tg_op = 'INSERT' and new.status = 'SUGGESTED' then
    perform private.create_notification(
      donor, 'MATCH_FOUND', 'Suitable NGO match found',
      'A suitable NGO has been matched with your donation.',
      'MATCH', new.id, 'match-found:' || new.id || ':' || donor
    );
    perform private.create_notification(
      ngo_user, 'MATCH_FOUND', 'New donation match',
      'A suitable donation is available for your organization to review.',
      'MATCH', new.id, 'match-found:' || new.id || ':' || ngo_user
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'ACCEPTED' then
      perform private.create_notification(
        donor, 'DONATION_ACCEPTED', 'Donation accepted',
        'An NGO accepted your donation. Arrange collection with the organization.',
        'DONATION', new.donation_id, 'donation-accepted:' || new.donation_id || ':' || donor
      );
      perform private.create_notification(
        ngo_user, 'DONATION_ACCEPTED', 'Donation accepted',
        'Your organization successfully accepted this donation.',
        'DONATION', new.donation_id, 'donation-accepted:' || new.donation_id || ':' || ngo_user
      );
    elsif new.status = 'REJECTED' then
      perform private.create_notification(
        donor, 'DONATION_REJECTED', 'Match declined',
        'An NGO declined this match. Other suitable matches may still be available.',
        'MATCH', new.id, 'match-rejected:' || new.id || ':' || donor
      );
      perform private.create_notification(
        ngo_user, 'DONATION_REJECTED', 'Match declined',
        'Your organization declined this donation match.',
        'MATCH', new.id, 'match-rejected:' || new.id || ':' || ngo_user
      );
    end if;
  end if;
  return new;
end;
$$;


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
      'recipients', count(*) filter(where role = 'RECIPIENT')
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
    counts := counts || jsonb_build_object(
      'active_pickups', (select count(*) from public.donations where status='ACCEPTED'),
      'delivered_pickups', (select count(*) from public.donations where status='COMPLETED')
    );
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
      'awaiting_confirmation', count(*) filter(where m.status = 'ACCEPTED' and d.status in ('ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED')),
      'completed', count(*) filter(where m.status = 'ACCEPTED' and d.status = 'COMPLETED')
    ) into counts from public.matches m join public.ngos n on n.id = m.ngo_id
      join public.donations d on d.id = m.donation_id where n.user_id = actor;
  elsif actor_role = 'RECIPIENT' then
    select jsonb_build_object('total_requests',count(*),'pending',count(*) filter(where status='PENDING'),
      'accepted',count(*) filter(where status='ACCEPTED'),'completed',count(*) filter(where status='COMPLETED'),
      'closed',count(*) filter(where status in ('CANCELLED','EXPIRED','REJECTED'))) into counts
      from public.food_requests where recipient_id=actor;
    counts:=counts || jsonb_build_object('available',(public.browse_available_meals()->>'total')::integer);
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
      select id, name, email, role, account_status, created_at from public.users
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
      select n.id, n.organization_name, n.verification_status, n.service_area, n.registration_reference, u.name user_name, n.accepted_food_types, n.capacity, n.location,
        (n.latitude is not null and n.longitude is not null) has_coordinates, n.created_at,
        (select count(*) from public.matches m where m.ngo_id = n.id and m.status = 'ACCEPTED') accepted_count
      from public.ngos n join public.users u on u.id = n.user_id
      where n.organization_name ilike term or n.location ilike term or u.name ilike term
    ), page as (select * from filtered order by created_at desc, id desc limit 20 offset offset_rows)
    select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc, id desc) from page p), '[]'::jsonb),
      'total', (select count(*) from filtered)) into result;
  elsif view_name = 'recipients' then
    with filtered as not materialized (
      select u.id,u.name,u.account_status,u.created_at,
        (select count(*) from public.food_requests r where r.recipient_id=u.id) request_count,
        (select count(*) from public.food_requests r where r.recipient_id=u.id and r.status='ACCEPTED') active_count,
        (select count(*) from public.food_requests r where r.recipient_id=u.id and r.status='COMPLETED') completed_count
      from public.users u where u.role='RECIPIENT' and u.name ilike term
    ), page as (select * from filtered order by created_at desc,id desc limit 20 offset offset_rows)
    select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from page p),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
  elsif view_name = 'activity' then
    with filtered as not materialized (
      select a.id, a.action, a.details, a.entity_type, a.entity_id, a.created_at, u.name actor_name
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


-- Phase 12: read-only analytics. No new data, workflow, or RLS policies.
create or replace function public.get_my_impact(from_date date default null, to_date date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role();
  lo timestamptz; hi timestamptz; first_day date; last_day date;
  bucket text; result jsonb;
begin
  if actor is null or actor_role is null then
    raise exception 'Authenticated profile required' using errcode = '42501';
  end if;
  if (from_date is null) <> (to_date is null) or from_date > to_date
    or to_date > (now() at time zone 'UTC')::date
    or to_date - from_date > 3660 then
    raise exception 'Use both UTC dates, in order, ending no later than today (maximum 3660 days)' using errcode = '22023';
  end if;
  lo := from_date::timestamp at time zone 'UTC';
  hi := (to_date + 1)::timestamp at time zone 'UTC';
  last_day := coalesce(to_date, (now() at time zone 'UTC')::date);
  -- Only donations owned by or allocated to this actor contribute to their report.
  with scoped as not materialized (
    select d.* from public.donations d where
      actor_role = 'ADMIN'
      or (actor_role = 'DONOR' and d.donor_id = actor)
      or (actor_role = 'NGO' and exists (select 1 from public.matches m join public.ngos n on n.id = m.ngo_id
        where m.donation_id = d.id and m.status = 'ACCEPTED' and n.user_id = actor))
      or (actor_role = 'RECIPIENT' and exists (select 1 from public.food_requests r where r.donation_id=d.id and r.recipient_id=actor and r.status in ('ACCEPTED','COMPLETED')))
  ), cohort as materialized (
    select * from scoped where lo is null or (created_at >= lo and created_at < hi)
  ), tasks as materialized (
    select p.* from public.pickup_tasks p join scoped d on d.id = p.donation_id
    where actor_role <> 'RECIPIENT' and (lo is null or (p.created_at >= lo and p.created_at < hi))
  ), impact as (
    select count(*) as completed, coalesce(sum(coalesce(meal_portions,0)),0) as portions
    from scoped where status = 'COMPLETED' and (lo is null or (completed_at >= lo and completed_at < hi))
  )
  select jsonb_build_object(
    'role', actor_role, 'from', from_date, 'to', to_date,
    'donations', (select jsonb_build_object(
      'total', count(*), 'active', count(*) filter (where status in ('POSTED','MATCHED','ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED')),
      'completed', count(*) filter (where status = 'COMPLETED'),
      'cancelled', count(*) filter (where status = 'CANCELLED'), 'expired', count(*) filter (where status = 'EXPIRED'),
      'portions_donated', coalesce(sum(coalesce(meal_portions,0)),0),
      'portions_redistributed', coalesce(sum(coalesce(meal_portions,0)) filter (where status = 'COMPLETED'),0),
      'matched', count(*) filter (where exists (select 1 from public.matches m where m.donation_id = cohort.id)),
      'accepted', count(*) filter (where exists (select 1 from public.collection_arrangements c where c.donation_id=cohort.id))
    ) from cohort),
    'statuses', (select coalesce(jsonb_object_agg(status, amount),'{}'::jsonb) from (select status,count(*) amount from cohort group by status) s),
    'impact', (select jsonb_build_object('completed',completed,'portions',portions) from impact),
    'tasks', (select jsonb_build_object('total',count(*), 'claimed',count(*) filter(where volunteer_id is not null),
      'active', count(*) filter(where status in ('ASSIGNED','COLLECTED')),
      'collected',count(*) filter(where collected_at is not null),
      'delivered',count(*) filter(where status = 'DELIVERED' and delivered_at is not null)) from tasks),
    'pending_matches', case when actor_role = 'NGO' then (select count(*) from public.matches m
      join public.ngos n on n.id = m.ngo_id join public.donations d on d.id = m.donation_id
      where n.user_id = actor and m.status in ('SUGGESTED','VIEWED') and d.status = 'MATCHED'
        and d.collection_deadline > now() and (lo is null or (d.created_at >= lo and d.created_at < hi))) else 0 end,
    'requests', (select jsonb_build_object('total',count(*), 'pending',count(*) filter(where status='PENDING'),
      'accepted',count(*) filter(where status='ACCEPTED'), 'completed',count(*) filter(where status='COMPLETED'),
      'closed',count(*) filter(where status in ('REJECTED','CANCELLED','EXPIRED')))
      from public.food_requests where recipient_id=actor and actor_role='RECIPIENT'
        and (lo is null or (created_at>=lo and created_at<hi))),
    'participation', case when actor_role = 'ADMIN' then jsonb_build_object(
      'donors', (select count(*) from public.users where role = 'DONOR' and (lo is null or (created_at >= lo and created_at < hi))),
      'ngos', (select count(*) from public.ngos where lo is null or (created_at >= lo and created_at < hi)),
      'recipients', (select count(*) from public.users where role = 'RECIPIENT' and (lo is null or (created_at >= lo and created_at < hi))),
      'participating_donors', (select count(distinct donor_id) from cohort),
      'receiving_ngos', (select count(distinct m.ngo_id) from public.matches m join scoped d on d.id = m.donation_id
        where m.status = 'ACCEPTED' and d.status = 'COMPLETED' and (lo is null or (d.completed_at >= lo and d.completed_at < hi))),
      'receiving_individuals', (select count(distinct recipient_id) from public.food_requests r join scoped d on d.id=r.donation_id where r.status='COMPLETED' and (lo is null or (d.completed_at>=lo and d.completed_at<hi)))
    ) else '{}'::jsonb end
  ), coalesce(from_date, (select min(created_at at time zone 'UTC')::date from scoped), last_day)
  into result, first_day;
  first_day := least(first_day,last_day);
  -- At most 91 daily / 121 monthly / annual buckets for long history; real event timestamps only.
  if actor_role = 'ADMIN' and from_date is null then
    select least(first_day, coalesce(min(created_at at time zone 'UTC')::date, first_day)) into first_day from public.users;
  end if;
  bucket := case when last_day - first_day <= 90 then 'day' when last_day - first_day <= 3660 then 'month' else 'year' end;
  with scoped as not materialized (
    select d.* from public.donations d where actor_role = 'ADMIN'
      or (actor_role = 'DONOR' and d.donor_id = actor)
      or (actor_role = 'NGO' and exists (select 1 from public.matches m join public.ngos n on n.id=m.ngo_id where m.donation_id=d.id and m.status='ACCEPTED' and n.user_id=actor))
      or (actor_role = 'RECIPIENT' and exists (select 1 from public.food_requests r where r.donation_id=d.id and r.recipient_id=actor and r.status in ('ACCEPTED','COMPLETED')))
  ), events as (
    select date_trunc(bucket,created_at at time zone 'UTC') as at, 1::bigint as posted, 0::bigint as completed, 0::bigint as portions,
      0::bigint as donors, 0::bigint as ngos, 0::bigint as collected, 0::bigint as delivered
      from scoped where lo is null or (created_at>=lo and created_at<hi)
    union all select date_trunc(bucket,completed_at at time zone 'UTC'),0,1,coalesce(meal_portions,0),0,0,0,0
      from scoped where status='COMPLETED' and (lo is null or (completed_at>=lo and completed_at<hi))
    union all select date_trunc(bucket,created_at at time zone 'UTC'),0,0,0,1,0,0,0
      from public.users where actor_role='ADMIN' and role='DONOR' and (lo is null or (created_at>=lo and created_at<hi))
    union all select date_trunc(bucket,created_at at time zone 'UTC'),0,0,0,0,1,0,0
      from public.ngos where actor_role='ADMIN' and (lo is null or (created_at>=lo and created_at<hi))
    union all select date_trunc(bucket,p.collected_at at time zone 'UTC'),0,0,0,0,0,1,0
      from public.pickup_tasks p join scoped d on d.id=p.donation_id
      where p.collected_at is not null and actor_role<>'RECIPIENT'
        and (lo is null or (p.collected_at>=lo and p.collected_at<hi))
    union all select date_trunc(bucket,p.delivered_at at time zone 'UTC'),0,0,0,0,0,0,1
      from public.pickup_tasks p join scoped d on d.id=p.donation_id
      where p.status='DELIVERED' and actor_role<>'RECIPIENT'
        and (lo is null or (p.delivered_at>=lo and p.delivered_at<hi))
  ), series as (
    select generate_series(date_trunc(bucket, first_day::timestamp), date_trunc(bucket,last_day::timestamp), ('1 '||bucket)::interval) as at
  ), grouped as (
    select s.at,coalesce(sum(e.posted),0) posted,coalesce(sum(e.completed),0) completed,coalesce(sum(e.portions),0) portions,
      coalesce(sum(e.donors),0) donors,coalesce(sum(e.ngos),0) ngos,coalesce(sum(e.collected),0) collected,coalesce(sum(e.delivered),0) delivered
    from series s left join events e on e.at=s.at group by s.at
  )
  select result || jsonb_build_object('bucket',bucket,'trends',coalesce(jsonb_agg(jsonb_build_object(
    'date',at::date,'posted',posted,'completed',completed,'portions',portions,'donors',donors,'ngos',ngos,'collected',collected,'delivered',delivered) order by at),'[]'::jsonb)) into result from grouped;
  return result;
end;
$$;

create or replace function public.get_platform_impact(from_date date default null, to_date date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not coalesce(private.is_admin(),false) then raise exception 'Admin required' using errcode = '42501'; end if;
  return public.get_my_impact(from_date,to_date);
end;
$$;
revoke all on function public.get_my_impact(date,date), public.get_platform_impact(date,date) from public, anon;
grant execute on function public.get_my_impact(date,date), public.get_platform_impact(date,date) to authenticated;
create index if not exists donations_completed_at_idx on public.donations(completed_at) where status='COMPLETED';
comment on function public.get_my_impact(date,date) is 'Trusted role/ownership plus RLS. UTC creation cohorts and separate actual completion event totals. No identifiers accepted.';

notify pgrst,'reload schema';
