-- Phase 13: verified privacy, write-privilege and input/state integrity gaps.
-- Keep prior migrations immutable. Workflow row locking is unchanged.

create function private.donor_has_ngo_match(target_ngo_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.matches m join public.donations d on d.id = m.donation_id
    where m.ngo_id = target_ngo_id and d.donor_id = (select auth.uid()));
$$;
revoke all on function private.donor_has_ngo_match(uuid) from public, anon;
grant execute on function private.donor_has_ngo_match(uuid) to authenticated;

alter policy ngos_select_workflow_participants on public.ngos using (
  user_id = (select auth.uid()) or (select private.is_admin())
  or ((select private.current_user_role()) = 'DONOR' and (select private.donor_has_ngo_match(id)))
);
alter policy notifications_select_own_or_admin on public.notifications using (user_id = (select auth.uid()));
alter policy notifications_update_own_or_admin on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Matching needs organization eligibility/location, never contact details or descriptions.
create function public.get_matching_ngos(target_donation_id uuid)
returns table (id uuid, user_id uuid, organization_name text, location text, capacity integer,
  accepted_food_types text[], latitude numeric, longitude numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.donations d where d.id = target_donation_id
    and d.donor_id = (select auth.uid()) and (select private.current_user_role()) = 'DONOR'
    and d.status in ('POSTED', 'MATCHED') and d.collection_deadline > now()) then
    raise exception 'Not authorized to match this donation' using errcode = '42501';
  end if;
  return query select n.id, n.user_id, n.organization_name, n.location, n.capacity,
    n.accepted_food_types, n.latitude, n.longitude from public.ngos n where n.capacity > 0;
end;
$$;
revoke all on function public.get_matching_ngos(uuid) from public, anon;
grant execute on function public.get_matching_ngos(uuid) to authenticated;

-- IDs, historical timestamps and statuses are server-owned. RLS still scopes editable fields.
alter policy donations_insert_own_or_admin on public.donations with check (
  status = 'POSTED' and (donor_id = (select auth.uid()) or (select private.is_admin()))
);
revoke insert, update on public.donations from authenticated;
grant insert (donor_id, food_type, quantity, meal_portions, location, latitude, longitude,
  available_from, collection_deadline, safety_information, description, status) on public.donations to authenticated;
grant update (food_type, quantity, meal_portions, location, latitude, longitude,
  available_from, collection_deadline, safety_information, description) on public.donations to authenticated;
revoke insert, update on public.ngos from authenticated;
grant insert (user_id, organization_name, description, location, latitude, longitude,
  capacity, accepted_food_types, contact_information) on public.ngos to authenticated;
grant update (organization_name, description, location, latitude, longitude,
  capacity, accepted_food_types, contact_information) on public.ngos to authenticated;

-- NaN/infinite dates otherwise pass ordinary comparison checks and break rendering/analytics.
alter table public.donations add constraint donations_finite_values check (
  quantity <> 'NaN'::numeric and isfinite(available_from) and isfinite(collection_deadline)
  and isfinite(created_at) and isfinite(updated_at) and (completed_at is null or isfinite(completed_at))
);
alter table public.pickup_tasks add constraint pickup_tasks_collection_state check (
  (status not in ('ASSIGNED','COLLECTED','DELIVERED') or pickup_time is not null)
  and (status not in ('COLLECTED','DELIVERED') or collected_at is not null)
  and (status <> 'AVAILABLE' or (volunteer_id is null and pickup_time is null and collected_at is null and delivered_at is null))
  and (collected_at is null or (pickup_time is not null and collected_at >= pickup_time))
  and (pickup_time is null or isfinite(pickup_time)) and (collected_at is null or isfinite(collected_at))
  and (delivered_at is null or isfinite(delivered_at)) and isfinite(created_at)
);

-- Generous field limits bound stored user input, without altering food categories or quantities.
alter table public.users add constraint users_text_limits check (
  char_length(name) <= 200 and char_length(email) <= 320 and char_length(phone) <= 100 and char_length(location) <= 1000
);
alter table public.donations add constraint donations_text_limits check (
  char_length(food_type) <= 200 and char_length(location) <= 1000
  and char_length(safety_information) <= 10000 and char_length(description) <= 10000
);
alter table public.ngos add constraint ngos_text_limits check (
  char_length(organization_name) <= 200 and char_length(location) <= 1000
  and char_length(description) <= 10000 and char_length(contact_information) <= 2000
  and cardinality(accepted_food_types) between 1 and 100
  and array_position(accepted_food_types, null) is null
  and char_length(array_to_string(accepted_food_types, ',')) <= 10000
);

CREATE OR REPLACE FUNCTION public.store_donation_matches(target_donation_id uuid, match_candidates jsonb)
 RETURNS SETOF matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if match_candidates is null or jsonb_typeof(match_candidates) is distinct from 'array' then raise exception 'Match candidates must be an array'; end if;

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

    if submitted_distance_value is null or urgency_value is null or compatibility_value is null
      or capacity_value is null or availability_value is null or total_value is null
      or submitted_distance_value not between 0 and 100 or urgency_value not between 0 and 100
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
$function$
;

CREATE OR REPLACE FUNCTION public.respond_to_donation_match(target_match_id uuid, decision text)
 RETURNS TABLE(result_match_id uuid, result_match_status match_status, result_donation_id uuid, result_donation_status donation_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_match public.matches%rowtype;
  target_donation public.donations%rowtype;
  normalized_decision text := upper(btrim(decision));
  new_pickup_id uuid;
begin
  if (select private.current_user_role()) is distinct from 'NGO' then raise exception 'Only NGO users can respond to matches'; end if;
  if normalized_decision is null or normalized_decision not in ('ACCEPT', 'DECLINE') then raise exception 'Decision must be ACCEPT or DECLINE'; end if;
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
$function$
;

-- Trigger functions are not public RPCs; revoke their redundant default EXECUTE grants.
revoke execute on function public.set_updated_at(), public.validate_ngo_user_role(),
  public.validate_donor_user_role(), public.validate_volunteer_user_role(),
  public.enforce_match_status_workflow(), public.enforce_pickup_task_workflow(),
  public.validate_pickup_task_donation() from public, anon, authenticated;
notify pgrst, 'reload schema';
