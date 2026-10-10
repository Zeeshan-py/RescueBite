-- Individual recipients and direct collection. Earlier migrations stay immutable.
-- Whole-donation allocation: every acceptance serializes on donations.id.
alter table public.users add column account_status text not null default 'ACTIVE'
  check (account_status in ('ACTIVE','RESTRICTED'));
alter table public.ngos add column verification_status text not null default 'PENDING'
  check (verification_status in ('PENDING','VERIFIED','REJECTED'));
alter table public.ngos add column service_area text check (length(service_area) <= 300);
alter table public.ngos add column registration_reference text check (length(registration_reference) <= 100);
grant insert (service_area, registration_reference), update (service_area, registration_reference) on public.ngos to authenticated;
create function private.reset_ngo_verification_on_identity_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and private.current_user_role()='NGO'
    and (new.organization_name is distinct from old.organization_name or new.registration_reference is distinct from old.registration_reference) then
    new.verification_status:='PENDING';
  end if;
  return new;
end; $$;
revoke all on function private.reset_ngo_verification_on_identity_change() from public,anon,authenticated;
create trigger ngos_identity_reverification before update of organization_name,registration_reference on public.ngos
  for each row execute function private.reset_ngo_verification_on_identity_change();

create table public.donor_profiles (
  user_id uuid primary key references public.users(id) on delete restrict,
  business_name text not null check (length(btrim(business_name)) between 2 and 200),
  business_type text not null check (business_type in ('RESTAURANT','BAKERY','CATERER','GROCERY','OTHER')),
  pickup_address text not null check (length(btrim(pickup_address)) between 3 and 1000),
  general_area text not null check (length(btrim(general_area)) between 2 and 200),
  pickup_hours text not null check (length(btrim(pickup_hours)) between 2 and 300),
  description text check (length(description) <= 2000),
  latitude numeric, longitude numeric,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180))
);
create table public.recipient_profiles (
  user_id uuid primary key references public.users(id) on delete restrict,
  general_area text not null check (length(btrim(general_area)) between 2 and 200),
  preferred_contact text not null default 'EMAIL' check (preferred_contact in ('EMAIL','PHONE')),
  latitude numeric, longitude numeric,
  daily_request_limit integer not null default 5 check (daily_request_limit between 0 and 20),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180))
);
-- No dietary/medical data is collected. A general area is sufficient; no home address.
alter table public.donor_profiles enable row level security;
alter table public.recipient_profiles enable row level security;
create policy donor_profile_private on public.donor_profiles for select to authenticated using (user_id=auth.uid() or private.is_admin());
create policy donor_profile_insert on public.donor_profiles for insert to authenticated with check (user_id=auth.uid() and private.current_user_role()='DONOR');
create policy donor_profile_update on public.donor_profiles for update to authenticated using (user_id=auth.uid() and private.current_user_role()='DONOR') with check (user_id=auth.uid());
create policy recipient_profile_private on public.recipient_profiles for select to authenticated using (user_id=auth.uid() or private.is_admin());
create policy recipient_profile_insert on public.recipient_profiles for insert to authenticated with check (user_id=auth.uid() and private.current_user_role()='RECIPIENT');
create policy recipient_profile_update on public.recipient_profiles for update to authenticated using (user_id=auth.uid() and private.current_user_role()='RECIPIENT') with check (user_id=auth.uid());
grant select on public.donor_profiles, public.recipient_profiles to authenticated;
grant insert(user_id,business_name,business_type,pickup_address,general_area,pickup_hours,description,latitude,longitude),
  update(business_name,business_type,pickup_address,general_area,pickup_hours,description,latitude,longitude) on public.donor_profiles to authenticated;
grant insert(user_id,general_area,preferred_contact,latitude,longitude), update(general_area,preferred_contact,latitude,longitude) on public.recipient_profiles to authenticated;
grant all on public.donor_profiles, public.recipient_profiles to service_role;
create trigger donor_profile_updated before update on public.donor_profiles for each row execute function public.set_updated_at();
create trigger recipient_profile_updated before update on public.recipient_profiles for each row execute function public.set_updated_at();

-- Migrate account capabilities, not historical pickup records or foreign keys.
insert into public.activity_logs(user_id,action,entity_type,entity_id)
  select id,'LEGACY_VOLUNTEER_MIGRATED','USER',id from public.users where role='VOLUNTEER';
update public.users set role='RECIPIENT' where role='VOLUNTEER';
-- Recipients explicitly provide a general area at onboarding. Never copy an old
-- address into a new field that might have different privacy expectations.

create or replace function private.current_user_role() returns public.app_role
language sql stable security definer set search_path='' as $$
  select role from public.users where id=auth.uid() and account_status='ACTIVE' and role<>'VOLUNTEER';
$$;
create function private.require_actor(expected public.app_role default null) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actual public.app_role:=private.current_user_role();
begin
  if actor is null or actual is null or (expected is not null and actual<>expected) then
    raise exception 'Not authorized or account restricted' using errcode='42501';
  end if;
  return actor;
end; $$;
revoke all on function private.require_actor(public.app_role) from public,anon,authenticated;

-- Public roles are a server allowlist. Metadata never authorizes an administrator
-- and subsequent Auth metadata updates never change an application's role.
create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
declare chosen text:=upper(coalesce(new.raw_user_meta_data->>'role','')); full_name text;
begin
  if chosen='' then return new; end if;
  if chosen not in ('DONOR','NGO','RECIPIENT') then raise exception 'Invalid public registration role'; end if;
  full_name:=btrim(coalesce(new.raw_user_meta_data->>'name',new.raw_user_meta_data->>'full_name',''));
  if length(full_name) not between 1 and 200 then raise exception 'Name is required (maximum 200 characters)'; end if;
  insert into public.users(id,name,email,phone,role) values(new.id,full_name,new.email,nullif(new.raw_user_meta_data->>'phone',''),chosen::public.app_role);
  return new;
end; $$;
revoke insert on public.users from authenticated;
revoke insert(id,name,email,phone,role,location) on public.users from authenticated;
drop policy users_insert_own_profile on public.users;
create function public.complete_registration(selected_role text, display_name text) returns public.users
language plpgsql security definer set search_path='' as $$
declare identity auth.users%rowtype; result public.users;
begin
  select * into identity from auth.users where id=auth.uid() for update;
  if not found or identity.email is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into result from public.users where id=identity.id;
  if found then return result; end if;
  if selected_role is null or selected_role not in ('DONOR','NGO','RECIPIENT') or length(btrim(display_name)) not between 1 and 200 or display_name is null then raise exception 'Invalid registration details'; end if;
  insert into public.users(id,name,email,role) values(identity.id,btrim(display_name),identity.email,selected_role::public.app_role) returning * into result;
  return result;
end; $$;
create function public.get_profile_verification() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_actor();
  select jsonb_build_object('phone_verified',coalesce(a.phone_confirmed_at is not null and a.phone is not null and regexp_replace(u.phone,'[^0-9]','','g')=regexp_replace(a.phone,'[^0-9]','','g'),false),
    'email_verified',a.email_confirmed_at is not null,'account_status',u.account_status,
    'daily_request_limit',r.daily_request_limit) into result from public.users u join auth.users a on a.id=u.id left join public.recipient_profiles r on r.user_id=u.id where u.id=auth.uid();
  return result;
end; $$;

alter table public.donations add column recipient_scope text not null default 'NGO_ONLY' check(recipient_scope in ('NGO_ONLY','INDIVIDUAL_ONLY','BOTH'));
alter table public.donations add column public_area text not null default '' check(length(public_area)<=200);
grant insert(recipient_scope,public_area),update(recipient_scope,public_area) on public.donations to authenticated;
create table public.food_requests (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete restrict,
  recipient_id uuid not null references public.users(id) on delete restrict,
  status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','REJECTED','CANCELLED','EXPIRED','COMPLETED')),
  requested_portions integer not null check(requested_portions>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(donation_id,recipient_id)
);
create unique index food_requests_one_allocation on public.food_requests(donation_id) where status in ('ACCEPTED','COMPLETED');
create index food_requests_recipient_created on public.food_requests(recipient_id,created_at desc);
create index food_requests_donation_status on public.food_requests(donation_id,status);
alter table public.food_requests enable row level security;
create policy food_requests_participants on public.food_requests for select to authenticated using (
  private.current_user_role() is not null and (recipient_id=auth.uid() or private.is_donation_owner(donation_id) or private.is_admin())
);
grant select on public.food_requests to authenticated;
grant all on public.food_requests to service_role;
create trigger food_requests_updated before update on public.food_requests for each row execute function public.set_updated_at();

create table public.collection_arrangements (
  donation_id uuid primary key references public.donations(id) on delete restrict,
  recipient_id uuid not null references public.users(id) on delete restrict,
  collection_time timestamptz,
  instructions text not null default '' check(length(instructions)<=2000),
  version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.collection_arrangements enable row level security;
create policy collection_participants on public.collection_arrangements for select to authenticated using (
  private.current_user_role() is not null and (recipient_id=auth.uid() or private.is_donation_owner(donation_id) or private.is_admin())
);
grant select on public.collection_arrangements to authenticated;
grant all on public.collection_arrangements to service_role;
create trigger collection_updated before update on public.collection_arrangements for each row execute function public.set_updated_at();
-- Accepted legacy rescues can now finish by direct NGO confirmation, without
-- inventing a volunteer or overwriting the historical pickup/delivery events.
insert into public.collection_arrangements(donation_id,recipient_id)
  select d.id,n.user_id from public.donations d join public.matches m on m.donation_id=d.id and m.status='ACCEPTED' join public.ngos n on n.id=m.ngo_id
  where d.status in ('ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED','COMPLETED');

create function private.recipient_has_allocation(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.food_requests where donation_id=target and recipient_id=auth.uid() and status in ('ACCEPTED','COMPLETED'));
$$;
revoke all on function private.recipient_has_allocation(uuid) from public,anon;
grant execute on function private.recipient_has_allocation(uuid) to authenticated;
create function private.validate_match_eligibility() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.donations d join public.ngos n on n.id=new.ngo_id
    where d.id=new.donation_id and d.recipient_scope in ('NGO_ONLY','BOTH') and n.verification_status='VERIFIED') then
    raise exception 'Matching requires a verified NGO and an NGO-eligible donation';
  end if;
  return new;
end; $$;
revoke all on function private.validate_match_eligibility() from public,anon,authenticated;
create trigger matches_eligibility before insert or update of donation_id,ngo_id,matching_score on public.matches
  for each row execute function private.validate_match_eligibility();
alter policy donations_select_workflow_participants on public.donations using (
  private.current_user_role() is not null and (donor_id=auth.uid() or private.is_admin()
  or (private.current_user_role()='NGO' and private.ngo_has_match(id))
  or (private.current_user_role()='RECIPIENT' and private.recipient_has_allocation(id)))
);
-- Retired rider APIs cannot be used by any active client. Records remain auditable.
revoke execute on function public.claim_pickup_task(uuid), public.mark_pickup_collected(uuid), public.mark_pickup_delivered(uuid), public.get_pickup_destination(uuid) from public,anon,authenticated;
revoke update on public.pickup_tasks from authenticated;
revoke update(volunteer_id,pickup_time,collected_at,delivered_at,status,notes) on public.pickup_tasks from authenticated;
alter policy pickup_tasks_select_workflow_participants on public.pickup_tasks using (
  private.current_user_role() is not null and (private.is_admin() or private.is_donation_owner(donation_id) or private.ngo_can_view_pickup(donation_id))
);
-- Remove pre-acceptance access to NGO contact data. Matching uses the sanitized RPC.
alter policy ngos_select_workflow_participants on public.ngos using (user_id=auth.uid() or private.is_admin()
  or exists(select 1 from public.matches m where m.ngo_id=ngos.id and m.status='ACCEPTED' and private.is_donation_owner(m.donation_id)));

create function public.browse_available_meals(area text default '',food text default '',page_number integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_actor('RECIPIENT');
  if page_number is null or page_number not between 1 and 10000 then raise exception 'Invalid page'; end if;
  with eligible as (
    select d.id,d.food_type,d.meal_portions,d.quantity,d.public_area,d.available_from,d.collection_deadline,
      exists(select 1 from public.food_requests r where r.donation_id=d.id and r.recipient_id=auth.uid()) as already_requested
    from public.donations d join public.users u on u.id=d.donor_id
    where d.status in ('POSTED','MATCHED') and d.collection_deadline>now() and d.recipient_scope in ('INDIVIDUAL_ONLY','BOTH') and u.account_status='ACTIVE'
      and (coalesce(area,'')='' or position(lower(left(area,200)) in lower(d.public_area))>0)
      and (coalesce(food,'')='' or d.food_type=food)
  ), page as (select * from eligible order by collection_deadline,id limit 20 offset (page_number-1)*20)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb),'total',(select count(*) from eligible),'page',page_number) into result;
  return result;
end; $$;

create function public.request_food(target_donation_id uuid) returns public.food_requests
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor('RECIPIENT'); d public.donations; r public.food_requests; request_limit integer;
begin
  -- Serializes the same user's daily quota across different donations.
  select daily_request_limit into request_limit from public.recipient_profiles where user_id=actor for update;
  if not found then raise exception 'Complete your recipient profile first'; end if;
  if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verify your email before requesting food'; end if;
  if (select count(*) from public.food_requests where recipient_id=actor and created_at>now()-interval '24 hours')>=request_limit then raise exception 'Daily request limit reached'; end if;
  select * into d from public.donations where id=target_donation_id for update;
  if not found or d.status not in ('POSTED','MATCHED') or d.collection_deadline<=now() or d.recipient_scope not in ('INDIVIDUAL_ONLY','BOTH') or d.donor_id=actor
    or not exists(select 1 from public.users where id=d.donor_id and account_status='ACTIVE') then raise exception 'Donation is no longer available'; end if;
  insert into public.food_requests(donation_id,recipient_id,requested_portions) values(d.id,actor,d.meal_portions) returning * into r;
  return r;
end; $$;

create function public.respond_to_food_request(target_request_id uuid,decision text) returns public.food_requests
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor('DONOR'); d public.donations; r public.food_requests;
begin
  if decision is null or decision not in ('ACCEPT','REJECT') then raise exception 'Invalid request decision'; end if;
  select * into r from public.food_requests where id=target_request_id;
  if not found then raise exception 'Request not found or not authorized' using errcode='42501'; end if;
  select * into d from public.donations where id=r.donation_id and donor_id=actor for update;
  if not found then raise exception 'Request not found or not authorized' using errcode='42501'; end if;
  select * into r from public.food_requests where id=target_request_id for update;
  if r.status<>'PENDING' or d.status not in ('POSTED','MATCHED') or d.collection_deadline<=now() then raise exception 'Request is no longer actionable'; end if;
  if decision='ACCEPT' then
    if not exists(select 1 from public.users where id=r.recipient_id and account_status='ACTIVE') then raise exception 'Recipient account is restricted'; end if;
    update public.food_requests set status='ACCEPTED' where id=r.id returning * into r;
    update public.food_requests set status='REJECTED' where donation_id=d.id and id<>r.id and status='PENDING';
    update public.matches set status='EXPIRED' where donation_id=d.id and status in ('SUGGESTED','VIEWED');
    perform set_config('app.collection_workflow','active',true);
    update public.donations set status='ACCEPTED' where id=d.id;
    insert into public.collection_arrangements(donation_id,recipient_id) values(d.id,r.recipient_id);
  else update public.food_requests set status='REJECTED' where id=r.id returning * into r;
  end if;
  return r;
end; $$;
create function public.cancel_food_request(target_request_id uuid) returns public.food_requests
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor('RECIPIENT'); r public.food_requests;
begin
  select * into r from public.food_requests where id=target_request_id and recipient_id=actor;
  if not found then raise exception 'Request not found or not authorized' using errcode='42501'; end if;
  perform 1 from public.donations where id=r.donation_id for update;
  update public.food_requests set status='CANCELLED' where id=r.id and status='PENDING' returning * into r;
  if not found then raise exception 'Only pending requests may be cancelled'; end if;
  return r;
end; $$;

create function public.get_food_requests(target_donation_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'donation_id',r.donation_id,'status',r.status,'requested_portions',r.requested_portions,
    'created_at',r.created_at,'food_type',d.food_type,'public_area',d.public_area,'collection_deadline',d.collection_deadline,
    'recipient_name',u.name,'donation_status',d.status) order by r.created_at desc),'[]'::jsonb) into result
    from public.food_requests r join public.donations d on d.id=r.donation_id join public.users u on u.id=r.recipient_id
    where (target_donation_id is null or r.donation_id=target_donation_id) and (r.recipient_id=actor or d.donor_id=actor or private.is_admin());
  return result;
end; $$;

create function public.get_collection_details(target_donation_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); result jsonb;
begin
  select jsonb_build_object('donation_id',d.id,'recipient_id',c.recipient_id,'collection_time',c.collection_time,'instructions',c.instructions,
    'pickup_address',d.location,'latitude',d.latitude,'longitude',d.longitude,'available_from',d.available_from,'collection_deadline',d.collection_deadline,
    'donor_name',u.name,'business_name',p.business_name,'contact_phone',u.phone,'contact_email',u.email,'pickup_hours',p.pickup_hours,
    'status',d.status,'completed_at',d.completed_at) into result
    from public.collection_arrangements c join public.donations d on d.id=c.donation_id join public.users u on u.id=d.donor_id left join public.donor_profiles p on p.user_id=u.id
    where c.donation_id=target_donation_id and d.status in ('ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED','COMPLETED')
      and (c.recipient_id=actor or d.donor_id=actor or private.is_admin());
  if result is null then raise exception 'Collection details unavailable or not authorized' using errcode='42501'; end if;
  return result;
end; $$;
create function public.arrange_collection(target_donation_id uuid,pickup_at timestamptz,collection_instructions text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor('DONOR'); d public.donations; c public.collection_arrangements;
begin
  select * into d from public.donations where id=target_donation_id and donor_id=actor for update;
  if not found then raise exception 'Not authorized' using errcode='42501'; end if;
  if d.status<>'ACCEPTED' or pickup_at is null or not isfinite(pickup_at) or pickup_at<greatest(d.available_from,now()) or pickup_at>=d.collection_deadline
    or collection_instructions is null or length(btrim(collection_instructions)) not between 1 and 2000 then raise exception 'Use a future collection time within the donation window and clear instructions'; end if;
  update public.collection_arrangements set collection_time=pickup_at,instructions=btrim(collection_instructions),version=version+1 where donation_id=d.id returning * into c;
  if not found then raise exception 'An accepted recipient is required'; end if;
  perform private.create_notification(c.recipient_id,'COLLECTION_ARRANGED','Collection details updated','Your collection time and instructions are ready. Open Collection Details.','DONATION',d.id,'collection:'||d.id||':'||c.version);
  insert into public.activity_logs(user_id,action,entity_type,entity_id) values(actor,'COLLECTION_ARRANGED','DONATION',d.id);
end; $$;

create or replace function public.respond_to_donation_match(target_match_id uuid,decision text)
returns table(result_match_id uuid,result_match_status public.match_status,result_donation_id uuid,result_donation_status public.donation_status)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor('NGO'); m public.matches; d public.donations; n public.ngos;
begin
  if decision is null or decision not in ('ACCEPT','DECLINE') then raise exception 'Decision must be ACCEPT or DECLINE'; end if;
  select * into n from public.ngos where user_id=actor;
  select * into m from public.matches where id=target_match_id and ngo_id=n.id;
  if not found then raise exception 'Match not found or not authorized' using errcode='42501'; end if;
  select * into d from public.donations where id=m.donation_id for update;
  select * into m from public.matches where id=m.id for update;
  if m.status not in ('SUGGESTED','VIEWED') or d.status<>'MATCHED' or d.collection_deadline<=now() or d.recipient_scope='INDIVIDUAL_ONLY' then raise exception 'Donation is no longer available'; end if;
  perform set_config('app.collection_workflow','active',true);
  if decision='ACCEPT' then
    if n.verification_status<>'VERIFIED' then raise exception 'NGO verification is required before acceptance'; end if;
    if not exists(select 1 from public.users where id=d.donor_id and account_status='ACTIVE') then raise exception 'Donor account is restricted'; end if;
    update public.matches set status='ACCEPTED' where id=m.id;
    update public.matches set status='EXPIRED' where donation_id=d.id and id<>m.id and status in ('SUGGESTED','VIEWED');
    update public.food_requests set status='REJECTED' where donation_id=d.id and status='PENDING';
    update public.donations set status='ACCEPTED' where id=d.id;
    insert into public.collection_arrangements(donation_id,recipient_id) values(d.id,actor);
    insert into public.activity_logs(user_id,action,entity_type,entity_id) values(actor,'NGO_ACCEPTED_DONATION','DONATION',d.id);
  else
    update public.matches set status='REJECTED' where id=m.id;
    if not exists(select 1 from public.matches where donation_id=d.id and status in ('SUGGESTED','VIEWED')) then update public.donations set status='POSTED' where id=d.id; end if;
    insert into public.activity_logs(user_id,action,entity_type,entity_id) values(actor,'NGO_DECLINED_DONATION','MATCH',m.id);
  end if;
  return query select x.id,x.status,y.id,y.status from public.matches x join public.donations y on y.id=x.donation_id where x.id=m.id;
end; $$;
create or replace function public.confirm_donation_receipt(target_donation_id uuid) returns public.donations
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); d public.donations; arranged public.collection_arrangements;
begin
  select * into d from public.donations where id=target_donation_id for update;
  if not found then raise exception 'Donation unavailable' using errcode='42501'; end if;
  select * into arranged from public.collection_arrangements where donation_id=d.id and recipient_id=actor;
  if not found then raise exception 'Not authorized to confirm this collection' using errcode='42501'; end if;
  if (arranged.collection_time is null or arranged.collection_time>now())
    and not exists(select 1 from public.pickup_tasks p where p.donation_id=d.id and p.status='DELIVERED' and p.delivered_at is not null) then
    raise exception 'Collection must be arranged and its scheduled time reached';
  end if;
  if d.status not in ('ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED') or now()<d.available_from or (d.status='ACCEPTED' and d.collection_deadline<=now()) then raise exception 'Donation cannot be confirmed in its current state or time window'; end if;
  perform set_config('app.collection_workflow','active',true);
  update public.donations set status='COMPLETED',completed_at=now() where id=d.id returning * into d;
  update public.food_requests set status='COMPLETED' where donation_id=d.id and status='ACCEPTED' and recipient_id=actor;
  insert into public.activity_logs(user_id,action,entity_type,entity_id) values(actor,'RECIPIENT_CONFIRMED_COLLECTION','DONATION',d.id);
  return d;
end; $$;

-- State transitions are authorized RPC operations, never client-editable flags.
create or replace function public.enforce_donor_donation_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status<>new.status then
    if not ((old.status,new.status) in (('POSTED','MATCHED'),('MATCHED','POSTED'),('POSTED','ACCEPTED'),('MATCHED','ACCEPTED'),
      ('POSTED','CANCELLED'),('MATCHED','CANCELLED'),('ACCEPTED','CANCELLED'),('PICKUP_ASSIGNED','CANCELLED'),
      ('POSTED','EXPIRED'),('MATCHED','EXPIRED'),('ACCEPTED','EXPIRED'),('MATCHED','EXCEPTION'),
      ('ACCEPTED','COMPLETED'),('PICKUP_ASSIGNED','COMPLETED'),('COLLECTED','COMPLETED'),('DELIVERED','COMPLETED'))) then raise exception 'Invalid donation status transition'; end if;
    if current_setting('app.collection_workflow',true)='active' or current_setting('app.matching_engine',true)='active' or current_setting('app.cancel_workflow',true)='active' or current_setting('app.expiry_workflow',true)='active' then return new; end if;
    raise exception 'Use an authorized workflow to change status';
  end if;
  if auth.uid() is null then return new; end if;
  if private.current_user_role() is distinct from 'DONOR' or old.donor_id<>auth.uid() or new.donor_id<>old.donor_id or old.status<>'POSTED' then raise exception 'Donation edits require its donor and POSTED state'; end if;
  if exists(select 1 from public.food_requests where donation_id=old.id and status='PENDING') then raise exception 'Resolve pending requests or cancel before changing this donation'; end if;
  return new;
end; $$;
create function private.validate_distribution() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.recipient_scope<>'NGO_ONLY' and length(btrim(new.public_area))<2 then raise exception 'A general area is required for individual meals'; end if;
  if tg_op='INSERT' and auth.uid() is not null then
    perform private.require_actor('DONOR');
    if not exists(select 1 from public.donor_profiles where user_id=auth.uid()) then raise exception 'Complete your donor business profile first'; end if;
    if not coalesce((public.get_profile_verification()->>'phone_verified')::boolean,false) then raise exception 'Verify your contact phone in Profile before posting'; end if;
    if new.collection_deadline<=now() then raise exception 'Collection deadline must be in the future'; end if;
  end if;
  return new;
end; $$;
create trigger donations_distribution before insert or update of recipient_scope,public_area on public.donations for each row execute function private.validate_distribution();
revoke all on function private.validate_distribution() from public,anon,authenticated;

-- Withdrawal and expiry fan out to requests in the same transaction.
create function private.sync_request_state() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('CANCELLED','EXPIRED','EXCEPTION') and new.status is distinct from old.status then
    update public.food_requests set status=case when new.status='EXPIRED' then 'EXPIRED' else 'CANCELLED' end where donation_id=new.id and status in ('PENDING','ACCEPTED');
  end if;
  return new;
end; $$;
revoke all on function private.sync_request_state() from public,anon,authenticated;
create trigger donation_request_sync after update of status on public.donations for each row execute function private.sync_request_state();
create or replace function public.expire_overdue_donations() returns integer language plpgsql security definer set search_path='' as $$
declare d public.donations; total integer:=0;
begin
  -- No private rows returned. Safe for authenticated clients and scheduled jobs.
  if auth.uid() is not null then perform private.require_actor(); end if;
  perform set_config('app.expiry_workflow','active',true);
  for d in select * from public.donations where status in ('POSTED','MATCHED','ACCEPTED') and collection_deadline<=now() order by id for update skip locked loop
    update public.matches set status='EXPIRED' where donation_id=d.id and status in ('SUGGESTED','VIEWED','ACCEPTED');
    update public.pickup_tasks set status='CANCELLED' where donation_id=d.id and status='AVAILABLE';
    update public.donations set status='EXPIRED' where id=d.id;
    total:=total+1;
  end loop;
  return total;
end; $$;

create function private.notify_food_request() returns trigger language plpgsql security definer set search_path='' as $$
declare donor uuid;
begin
  select donor_id into donor from public.donations where id=new.donation_id;
  if tg_op='INSERT' then
    perform private.create_notification(donor,'FOOD_REQUESTED','New food request','An individual has requested this donation. Review the request.','FOOD_REQUEST',new.id,'request-created:'||new.id);
  elsif new.status is distinct from old.status then
    perform private.create_notification(new.recipient_id,'REQUEST_UPDATED','Food request '||lower(new.status),'Your request is now '||lower(new.status)||'. Open My Requests to review it.','FOOD_REQUEST',new.id,'request-status:'||new.id||':'||new.status);
    perform private.create_notification(donor,'REQUEST_UPDATED','Food request updated','A request is now '||lower(new.status)||'.','DONATION',new.donation_id,'request-donor:'||new.id||':'||new.status);
  end if;
  insert into public.activity_logs(user_id,action,entity_type,entity_id) values(auth.uid(),'REQUEST_'||new.status,'FOOD_REQUEST',new.id);
  return new;
end; $$;
revoke all on function private.notify_food_request() from public,anon,authenticated;
create trigger food_request_notifications after insert or update of status on public.food_requests for each row execute function private.notify_food_request();

create function public.admin_moderate(target_type text,target_id uuid,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor('ADMIN'); d public.donations;
begin
  if reason is null or length(btrim(reason)) not between 10 and 500 then raise exception 'Provide a moderation reason (10–500 characters)'; end if;
  if target_type='USER' and decision in ('ACTIVE','RESTRICTED') then
    if target_id=actor then raise exception 'Cannot moderate your own account'; end if;
    update public.users set account_status=decision where id=target_id and role<>'ADMIN';
    if not found then raise exception 'User unavailable or protected administrator'; end if;
  elsif target_type='NGO' and decision in ('VERIFIED','REJECTED') then
    update public.ngos set verification_status=decision where id=target_id;
    if not found then raise exception 'NGO not found'; end if;
  elsif target_type='DONATION' and decision='CANCEL' then
    select * into d from public.donations where id=target_id for update;
    if not found or d.status not in ('POSTED','MATCHED','ACCEPTED','PICKUP_ASSIGNED') then raise exception 'Donation cannot be cancelled in this state'; end if;
    perform set_config('app.cancel_workflow','active',true);
    update public.matches set status='EXPIRED' where donation_id=d.id and status in ('SUGGESTED','VIEWED','ACCEPTED');
    update public.pickup_tasks set status='CANCELLED' where donation_id=d.id and status in ('AVAILABLE','ASSIGNED');
    update public.donations set status='CANCELLED' where id=d.id;
  else raise exception 'Invalid moderation action'; end if;
  insert into public.activity_logs(user_id,action,entity_type,entity_id) values(actor,'ADMIN_'||decision,target_type,target_id);
  insert into public.activity_logs(user_id,action,entity_type,entity_id,details) values(actor,'MODERATION_REASON',target_type,target_id,btrim(reason));
end; $$;
alter table public.activity_logs add column details text check(length(details)<=500);

-- Block restricted accounts across direct table writes, including old grants.
create policy users_active_update on public.users as restrictive for update to authenticated using(private.current_user_role() is not null) with check(private.current_user_role() is not null);
create policy donations_active_insert on public.donations as restrictive for insert to authenticated with check(private.current_user_role()='DONOR');
create policy donations_active_update on public.donations as restrictive for update to authenticated using(private.current_user_role()='DONOR') with check(private.current_user_role()='DONOR');
create policy ngos_active_update on public.ngos as restrictive for update to authenticated using(private.current_user_role()='NGO') with check(private.current_user_role()='NGO');
create policy ngos_active_insert on public.ngos as restrictive for insert to authenticated with check(private.current_user_role()='NGO');

-- All exposed mutations have explicit grants; helper functions are never APIs.
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
    ('complete_registration','get_profile_verification','browse_available_meals','request_food','respond_to_food_request','cancel_food_request','get_food_requests','get_collection_details','arrange_collection','admin_moderate') loop
    execute format('revoke all on function %s from public,anon,authenticated',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end; $$;
alter publication supabase_realtime add table public.food_requests;
alter publication supabase_realtime add table public.collection_arrangements;
notify pgrst,'reload schema';
