-- Phase 5: secure, transactional storage for deterministic match suggestions.

create or replace function public.enforce_donor_donation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only the validated matching RPC may perform POSTED/MATCHED transitions.
  if current_setting('app.matching_engine', true) = 'active'
    or (select auth.uid()) is null
    or (select private.is_admin()) then
    return new;
  end if;

  if old.donor_id <> (select auth.uid()) or new.donor_id <> old.donor_id then
    raise exception 'A donor may update only their own donation';
  end if;

  if old.status <> 'POSTED' then
    raise exception 'A donation can only be edited or cancelled while POSTED';
  end if;

  if new.status not in ('POSTED', 'CANCELLED') then
    raise exception 'Donors may only keep a donation POSTED or cancel it';
  end if;

  return new;
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
  candidate_ngo_id uuid;
  candidate_ids uuid[] := '{}'::uuid[];
  distance_value numeric;
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
  if target.status not in ('POSTED', 'MATCHED') then
    raise exception 'Donation must be POSTED or MATCHED';
  end if;
  if target.collection_deadline <= now() then raise exception 'Donation collection deadline has passed'; end if;
  if jsonb_typeof(match_candidates) <> 'array' then raise exception 'Match candidates must be an array'; end if;

  normalized_food := regexp_replace(lower(btrim(split_part(target.food_type, ':', 1))), '\s+food$', '');
  for candidate in select value from jsonb_array_elements(match_candidates)
  loop
    candidate_ngo_id := (candidate ->> 'ngo_id')::uuid;
    if candidate_ngo_id = any(candidate_ids) then raise exception 'Duplicate NGO candidate'; end if;
    candidate_ids := array_append(candidate_ids, candidate_ngo_id);
    distance_value := (candidate ->> 'distance_score')::numeric;
    urgency_value := (candidate ->> 'urgency_score')::numeric;
    compatibility_value := (candidate ->> 'compatibility_score')::numeric;
    capacity_value := (candidate ->> 'capacity_score')::numeric;
    availability_value := (candidate ->> 'availability_score')::numeric;
    total_value := (candidate ->> 'matching_score')::numeric;
    if distance_value not between 0 and 100 or urgency_value not between 0 and 100
      or compatibility_value not between 0 and 100 or capacity_value not between 0 and 100
      or availability_value not between 0 and 100 or total_value not between 0 and 100 then
      raise exception 'Match scores must be between 0 and 100';
    end if;
    expected_total := distance_value * 0.30 + urgency_value * 0.25
      + compatibility_value * 0.20 + capacity_value * 0.15 + availability_value * 0.10;
    if abs(total_value - expected_total) > 0.02 then raise exception 'Invalid weighted matching score'; end if;
    if not exists (
      select 1 from public.ngos n
      where n.id = candidate_ngo_id and n.user_id <> target.donor_id
        and n.capacity >= target.meal_portions and n.capacity > 0
        and exists (
          select 1 from unnest(n.accepted_food_types) accepted(value)
          where regexp_replace(lower(btrim(accepted.value)), '\s+food$', '') = normalized_food
             or lower(btrim(accepted.value)) in ('all', 'any', 'all types', 'all food types')
        )
    ) then raise exception 'NGO candidate is not eligible'; end if;

    insert into public.matches as existing (
      donation_id, ngo_id, matching_score, distance_score, urgency_score,
      compatibility_score, capacity_score, availability_score, status
    ) values (
      target_donation_id, candidate_ngo_id, total_value, distance_value, urgency_value,
      compatibility_value, capacity_value, availability_value, 'SUGGESTED'
    )
    on conflict (donation_id, ngo_id) do update set
      matching_score = excluded.matching_score,
      distance_score = excluded.distance_score,
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

revoke all on function public.store_donation_matches(uuid, jsonb) from public, anon;
grant execute on function public.store_donation_matches(uuid, jsonb) to authenticated;

comment on function public.store_donation_matches(uuid, jsonb) is
  'Validates donor ownership, candidates, scores, deduplication, and POSTED/MATCHED transitions.';

