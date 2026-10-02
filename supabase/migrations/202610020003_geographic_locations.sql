-- Phase 10: validated geographic coordinates and server-verified distance matching.

alter table public.donations
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add constraint donations_coordinate_pair_valid check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
  );

alter table public.ngos
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add constraint ngos_coordinate_pair_valid check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
  );

alter table public.matches
  add column distance_km numeric(10, 3),
  add constraint matches_distance_km_nonnegative check (distance_km is null or distance_km >= 0);

comment on column public.donations.latitude is 'Optional donor-selected pickup latitude.';
comment on column public.donations.longitude is 'Optional donor-selected pickup longitude.';
comment on column public.ngos.latitude is 'Optional organization destination latitude.';
comment on column public.ngos.longitude is 'Optional organization destination longitude.';
comment on column public.matches.distance_km is 'Great-circle distance at the time this match was generated; null when either coordinate pair was unavailable.';

create or replace function public.geographic_distance_km(
  latitude_one numeric, longitude_one numeric, latitude_two numeric, longitude_two numeric
)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select 6371 * 2 * atan2(
    sqrt(least(1::double precision,
      power(sin(radians((latitude_two - latitude_one)::double precision) / 2), 2)
      + cos(radians(latitude_one::double precision)) * cos(radians(latitude_two::double precision))
      * power(sin(radians((longitude_two - longitude_one)::double precision) / 2), 2)
    )),
    sqrt(greatest(0::double precision, 1 - least(1::double precision,
      power(sin(radians((latitude_two - latitude_one)::double precision) / 2), 2)
      + cos(radians(latitude_one::double precision)) * cos(radians(latitude_two::double precision))
      * power(sin(radians((longitude_two - longitude_one)::double precision) / 2), 2)
    )))
  )::numeric;
$$;

create or replace function public.distance_score_from_km(distance_km numeric)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when distance_km < 0 then null
    when distance_km <= 2 then 100
    when distance_km <= 5 then 90
    when distance_km <= 10 then 75
    when distance_km <= 20 then 50
    when distance_km <= 30 then 25
    else 0
  end::numeric;
$$;

revoke all on function public.geographic_distance_km(numeric, numeric, numeric, numeric) from public, anon;
revoke all on function public.distance_score_from_km(numeric) from public, anon;
grant execute on function public.geographic_distance_km(numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.distance_score_from_km(numeric) to authenticated;

-- Return only destination fields to the assigned volunteer; do not grant access
-- to NGO contact details or unrelated matches.
create or replace function public.get_pickup_destination(target_donation_id uuid)
returns table (id uuid, organization_name text, location text, latitude numeric, longitude numeric)
language sql stable security definer set search_path = ''
as $$
  select n.id, n.organization_name, n.location, n.latitude, n.longitude
  from public.ngos n join public.matches m on m.ngo_id = n.id
  where m.donation_id = target_donation_id and m.status = 'ACCEPTED'
    and exists (select 1 from public.pickup_tasks p
      where p.donation_id = target_donation_id and p.volunteer_id = (select auth.uid()))
    and (select private.current_user_role()) = 'VOLUNTEER';
$$;
revoke all on function public.get_pickup_destination(uuid) from public, anon;
grant execute on function public.get_pickup_destination(uuid) to authenticated;

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
    and new.latitude is not distinct from old.latitude and new.longitude is not distinct from old.longitude
    and new.available_from = old.available_from and new.collection_deadline = old.collection_deadline
    and new.safety_information is not distinct from old.safety_information
    and new.description is not distinct from old.description then return new; end if;
  raise exception 'This donation update is not allowed in its current state';
end;
$$;

create or replace function public.store_donation_matches(
  target_donation_id uuid,
  match_candidates jsonb
)
returns setof public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.donations%rowtype;
  candidate jsonb;
  candidate_ngo public.ngos%rowtype;
  candidate_ngo_id uuid;
  candidate_ids uuid[] := '{}'::uuid[];
  submitted_distance_value numeric;
  distance_value numeric;
  distance_km_value numeric;
  urgency_value numeric;
  compatibility_value numeric;
  capacity_value numeric;
  availability_value numeric;
  total_value numeric;
  expected_total numeric;
  normalized_food text;
begin
  select * into target from public.donations where id = target_donation_id for update;
  if not found then raise exception 'Donation not found'; end if;
  if target.donor_id <> (select auth.uid()) and not (select private.is_admin()) then
    raise exception 'Not authorized to match this donation';
  end if;
  if target.status not in ('POSTED', 'MATCHED') then raise exception 'Donation must be POSTED or MATCHED'; end if;
  if target.collection_deadline <= now() then raise exception 'Donation collection deadline has passed'; end if;
  if jsonb_typeof(match_candidates) <> 'array' then raise exception 'Match candidates must be an array'; end if;

  normalized_food := regexp_replace(lower(btrim(split_part(target.food_type, ':', 1))), '\s+food$', '');
  for candidate in select value from jsonb_array_elements(match_candidates)
  loop
    candidate_ngo_id := (candidate ->> 'ngo_id')::uuid;
    if candidate_ngo_id = any(candidate_ids) then raise exception 'Duplicate NGO candidate'; end if;
    candidate_ids := array_append(candidate_ids, candidate_ngo_id);
    select * into candidate_ngo from public.ngos where id = candidate_ngo_id;
    if not found or candidate_ngo.user_id = target.donor_id
      or candidate_ngo.capacity < target.meal_portions or candidate_ngo.capacity <= 0
      or not exists (
        select 1 from unnest(candidate_ngo.accepted_food_types) accepted(value)
        where regexp_replace(lower(btrim(accepted.value)), '\s+food$', '') = normalized_food
           or lower(btrim(accepted.value)) in ('all', 'any', 'all types', 'all food types')
      ) then raise exception 'NGO candidate is not eligible'; end if;

    submitted_distance_value := (candidate ->> 'distance_score')::numeric;
    urgency_value := (candidate ->> 'urgency_score')::numeric;
    compatibility_value := (candidate ->> 'compatibility_score')::numeric;
    capacity_value := (candidate ->> 'capacity_score')::numeric;
    availability_value := (candidate ->> 'availability_score')::numeric;
    total_value := (candidate ->> 'matching_score')::numeric;

    if target.latitude is not null and target.longitude is not null
      and candidate_ngo.latitude is not null and candidate_ngo.longitude is not null then
      distance_km_value := public.geographic_distance_km(
        target.latitude, target.longitude, candidate_ngo.latitude, candidate_ngo.longitude
      );
      distance_value := public.distance_score_from_km(distance_km_value);
    else
      distance_km_value := null;
      distance_value := case
        when btrim(regexp_replace(lower(btrim(target.location)), '[^a-z0-9]+', ' ', 'g'))
          = btrim(regexp_replace(lower(btrim(candidate_ngo.location)), '[^a-z0-9]+', ' ', 'g')) then 100
        else 50
      end;
    end if;

    if submitted_distance_value not between 0 and 100 or urgency_value not between 0 and 100
      or compatibility_value not between 0 and 100 or capacity_value not between 0 and 100
      or availability_value not between 0 and 100 or total_value not between 0 and 100 then
      raise exception 'Match scores must be between 0 and 100';
    end if;
    if abs(submitted_distance_value - distance_value) > 0.02 then raise exception 'Invalid distance score'; end if;
    expected_total := distance_value * 0.30 + urgency_value * 0.25
      + compatibility_value * 0.20 + capacity_value * 0.15 + availability_value * 0.10;
    if abs(total_value - expected_total) > 0.02 then raise exception 'Invalid weighted matching score'; end if;

    insert into public.matches as existing (
      donation_id, ngo_id, matching_score, distance_score, distance_km, urgency_score,
      compatibility_score, capacity_score, availability_score, status
    ) values (
      target_donation_id, candidate_ngo_id, total_value, distance_value, round(distance_km_value, 3), urgency_value,
      compatibility_value, capacity_value, availability_value, 'SUGGESTED'
    )
    on conflict (donation_id, ngo_id) do update set
      matching_score = excluded.matching_score,
      distance_score = excluded.distance_score,
      distance_km = excluded.distance_km,
      urgency_score = excluded.urgency_score,
      compatibility_score = excluded.compatibility_score,
      capacity_score = excluded.capacity_score,
      availability_score = excluded.availability_score,
      status = case when existing.status in ('SUGGESTED', 'VIEWED') then 'SUGGESTED' else existing.status end;
  end loop;

  delete from public.matches
  where donation_id = target_donation_id and status in ('SUGGESTED', 'VIEWED')
    and not (ngo_id = any(candidate_ids));

  perform set_config('app.matching_engine', 'active', true);
  update public.donations
  set status = case when cardinality(candidate_ids) > 0 then 'MATCHED'::public.donation_status else 'POSTED'::public.donation_status end
  where id = target_donation_id;

  return query select m.* from public.matches m
    where m.donation_id = target_donation_id
    order by m.matching_score desc, m.created_at;
end;
$$;

comment on function public.distance_score_from_km(numeric) is
  'Phase 10 project assumption: <=2 km 100, <=5 km 90, <=10 km 75, <=20 km 50, <=30 km 25, otherwise 0.';
