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
  -- Explicit ownership is narrower than workflow RLS (e.g. volunteers can see available tasks).
  with scoped as not materialized (
    select d.* from public.donations d where
      actor_role = 'ADMIN'
      or (actor_role = 'DONOR' and d.donor_id = actor)
      or (actor_role = 'NGO' and exists (select 1 from public.matches m join public.ngos n on n.id = m.ngo_id
        where m.donation_id = d.id and m.status = 'ACCEPTED' and n.user_id = actor))
      or (actor_role = 'VOLUNTEER' and exists (select 1 from public.pickup_tasks p
        where p.donation_id = d.id and p.volunteer_id = actor))
  ), cohort as materialized (
    select * from scoped where lo is null or (created_at >= lo and created_at < hi)
  ), tasks as materialized (
    select p.* from public.pickup_tasks p join scoped d on d.id = p.donation_id
    where (actor_role <> 'VOLUNTEER' or p.volunteer_id = actor)
      and (lo is null or (p.created_at >= lo and p.created_at < hi))
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
      'accepted', count(*) filter (where exists (select 1 from public.matches m where m.donation_id = cohort.id and m.status = 'ACCEPTED'))
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
    'participation', case when actor_role = 'ADMIN' then jsonb_build_object(
      'donors', (select count(*) from public.users where role = 'DONOR' and (lo is null or (created_at >= lo and created_at < hi))),
      'ngos', (select count(*) from public.ngos where lo is null or (created_at >= lo and created_at < hi)),
      'volunteers', (select count(*) from public.users where role = 'VOLUNTEER' and (lo is null or (created_at >= lo and created_at < hi))),
      'participating_donors', (select count(distinct donor_id) from cohort),
      'receiving_ngos', (select count(distinct m.ngo_id) from public.matches m join scoped d on d.id = m.donation_id
        where m.status = 'ACCEPTED' and d.status = 'COMPLETED' and (lo is null or (d.completed_at >= lo and d.completed_at < hi))),
      'delivering_volunteers', (select count(distinct volunteer_id) from public.pickup_tasks
        where status = 'DELIVERED' and (lo is null or (delivered_at >= lo and delivered_at < hi)))
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
      or (actor_role = 'VOLUNTEER' and exists (select 1 from public.pickup_tasks p where p.donation_id=d.id and p.volunteer_id=actor))
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
      where p.collected_at is not null and (actor_role<>'VOLUNTEER' or p.volunteer_id=actor)
        and (lo is null or (p.collected_at>=lo and p.collected_at<hi))
    union all select date_trunc(bucket,p.delivered_at at time zone 'UTC'),0,0,0,0,0,0,1
      from public.pickup_tasks p join scoped d on d.id=p.donation_id
      where p.status='DELIVERED' and (actor_role<>'VOLUNTEER' or p.volunteer_id=actor)
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
