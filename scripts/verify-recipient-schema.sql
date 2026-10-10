-- Run against an isolated PostgreSQL database after applying all migrations.
-- The local auth schema stub is used only by this test, never in Supabase.
\set ON_ERROR_STOP on

do $$ begin
  begin
    insert into auth.users(id,email,raw_user_meta_data) values
      ('10000000-0000-0000-0000-000000000099','self-admin@example.test','{"role":"ADMIN","name":"Self Admin"}');
    raise exception 'Public admin registration was accepted';
  exception when others then
    if sqlerrm <> 'Invalid public registration role' then raise; end if;
  end;
end $$;

insert into auth.users(id,email,phone,email_confirmed_at,phone_confirmed_at,raw_user_meta_data) values
('10000000-0000-0000-0000-000000000001','donor@example.test','+15550000001',now(),now(),'{"role":"DONOR","name":"Test Donor"}'),
('10000000-0000-0000-0000-000000000002','ngo@example.test',null,now(),null,'{"role":"NGO","name":"Test NGO"}'),
('10000000-0000-0000-0000-000000000003','recipient@example.test',null,now(),null,'{"role":"RECIPIENT","name":"Test Recipient"}'),
('10000000-0000-0000-0000-000000000004','other@example.test',null,now(),null,'{"role":"RECIPIENT","name":"Other Recipient"}'),
('10000000-0000-0000-0000-000000000005','admin@example.test',null,now(),null,'{}');
insert into public.users(id,name,email,role) values ('10000000-0000-0000-0000-000000000005','Test Admin','admin@example.test','ADMIN');
update public.users set phone='+15550000001' where id='10000000-0000-0000-0000-000000000001';
insert into public.donor_profiles(user_id,business_name,business_type,pickup_address,general_area,pickup_hours) values
('10000000-0000-0000-0000-000000000001','Test Bakery','BAKERY','10 Private Street, Lahore','Lahore','09:00-18:00');
insert into public.recipient_profiles(user_id,general_area) values
('10000000-0000-0000-0000-000000000003','Lahore'),('10000000-0000-0000-0000-000000000004','Lahore');
insert into public.ngos(id,user_id,organization_name,location,capacity,accepted_food_types,verification_status) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Test NGO','Lahore',100,array['Bakery'],'VERIFIED');

set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
do $$ begin if (public.get_profile_verification()->>'phone_verified')::boolean is not true then raise exception 'Donor phone not verified'; end if; end $$;
insert into public.donations(donor_id,food_type,quantity,meal_portions,location,available_from,collection_deadline,recipient_scope,public_area)
values ('10000000-0000-0000-0000-000000000001','Bakery',1,1,'10 Private Street, Lahore',now()-interval '1 hour',now()+interval '2 hours','NGO_ONLY','');
reset role;
insert into public.donations(id,donor_id,food_type,quantity,meal_portions,location,available_from,collection_deadline,recipient_scope,public_area)
values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Bakery',10,10,'10 Private Street, Lahore',now()-interval '1 hour',now()+interval '2 hours','BOTH','Lahore'),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Bakery',12,12,'10 Private Street, Lahore',now()-interval '1 hour',now()+interval '2 hours','NGO_ONLY','Lahore');

set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
do $$ declare payload jsonb; begin
  payload:=public.browse_available_meals();
  if (payload->>'total')::int<>1 or (payload->'rows'->0 ? 'location') then raise exception 'Browse result leaked pickup data or NGO-only food'; end if;
  begin perform public.get_collection_details('30000000-0000-0000-0000-000000000001'); raise exception 'Unaccepted recipient saw private data'; exception when sqlstate '42501' then null; end;
  begin perform public.admin_moderate('USER','10000000-0000-0000-0000-000000000004','RESTRICTED','Unauthorized moderation'); raise exception 'Recipient moderated a user'; exception when sqlstate '42501' then null; end;
end $$;
select public.request_food('30000000-0000-0000-0000-000000000001');
do $$ begin
  begin perform public.request_food('30000000-0000-0000-0000-000000000001'); raise exception 'Duplicate request accepted'; exception when unique_violation then null; end;
  begin perform public.request_food('30000000-0000-0000-0000-000000000002'); raise exception 'NGO-only food request accepted'; exception when others then if sqlerrm='NGO-only food request accepted' then raise; end if; end;
end $$;

set request.jwt.claim.sub='10000000-0000-0000-0000-000000000004';
select public.request_food('30000000-0000-0000-0000-000000000001');
do $$ begin
  if exists(select 1 from public.food_requests where recipient_id='10000000-0000-0000-0000-000000000003') then raise exception 'Another recipient request visible'; end if;
  begin update public.users set role='ADMIN' where id='10000000-0000-0000-0000-000000000004'; raise exception 'Self-assigned admin role';
  exception when sqlstate '42501' then null; end;
end $$;

set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select public.respond_to_food_request((select id from public.food_requests where recipient_id='10000000-0000-0000-0000-000000000003'),'ACCEPT');
do $$ begin if (select count(*) from public.food_requests where donation_id='30000000-0000-0000-0000-000000000001' and status='ACCEPTED')<>1 or
  (select status from public.food_requests where recipient_id='10000000-0000-0000-0000-000000000004')<>'REJECTED' then raise exception 'Whole donation was allocated more than once'; end if; end $$;
select public.arrange_collection('30000000-0000-0000-0000-000000000001',now()+interval '1 second','Bring your confirmation message.');

set request.jwt.claim.sub='10000000-0000-0000-0000-000000000004';
do $$ begin begin perform public.get_collection_details('30000000-0000-0000-0000-000000000001'); raise exception 'Rejected recipient saw private data'; exception when sqlstate '42501' then null; end; end $$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
do $$ begin if (public.get_collection_details('30000000-0000-0000-0000-000000000001')->>'pickup_address')<>'10 Private Street, Lahore' then raise exception 'Accepted recipient lacks collection details'; end if; end $$;
select pg_sleep(1.1);
select public.confirm_donation_receipt('30000000-0000-0000-0000-000000000001');
do $$ begin if (select status from public.donations where id='30000000-0000-0000-0000-000000000001')<>'COMPLETED' then raise exception 'Recipient confirmation failed'; end if; end $$;
do $$ declare report jsonb; begin report:=public.get_my_impact(); if (report->>'role')<>'RECIPIENT' or (report->'requests'->>'completed')::int<>1 then raise exception 'Recipient impact report failed'; end if; end $$;

set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select public.store_donation_matches('30000000-0000-0000-0000-000000000002',jsonb_build_array(jsonb_build_object('ngo_id','20000000-0000-0000-0000-000000000001','distance_score',50,'urgency_score',100,'compatibility_score',100,'capacity_score',100,'availability_score',100,'matching_score',85)));
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
select public.respond_to_donation_match((select id from public.matches where donation_id='30000000-0000-0000-0000-000000000002'),'ACCEPT');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select public.arrange_collection('30000000-0000-0000-0000-000000000002',now()+interval '1 second','Collect at reception.');
select pg_sleep(1.1);
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
select public.confirm_donation_receipt('30000000-0000-0000-0000-000000000002');
do $$ begin if (select status from public.donations where id='30000000-0000-0000-0000-000000000002')<>'COMPLETED' then raise exception 'NGO confirmation failed'; end if; end $$;
update public.ngos set organization_name='Test NGO Updated' where id='20000000-0000-0000-0000-000000000001';
do $$ begin if (select verification_status from public.ngos where id='20000000-0000-0000-0000-000000000001')<>'PENDING' then raise exception 'NGO identity change retained verification'; end if; end $$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000005';
select public.admin_moderate('NGO','20000000-0000-0000-0000-000000000001','VERIFIED','Reviewed updated organization profile');

reset role;
reset request.jwt.claim.sub;
insert into public.donations(id,donor_id,food_type,quantity,meal_portions,location,available_from,collection_deadline,recipient_scope,public_area) values
('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Bakery',4,4,'Private pickup',now()-interval '1 hour',now()+interval '2 hours','INDIVIDUAL_ONLY','Lahore'),
('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Bakery',4,4,'Private pickup',now()-interval '3 hours',now()-interval '1 hour','INDIVIDUAL_ONLY','Lahore');
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000004';
-- The previous request was rejected, so create a fresh pending request to cancel.
select public.request_food('30000000-0000-0000-0000-000000000004');
select public.cancel_food_request((select id from public.food_requests where donation_id='30000000-0000-0000-0000-000000000004'));
do $$ begin if (select status from public.food_requests where donation_id='30000000-0000-0000-0000-000000000004')<>'CANCELLED' then raise exception 'Pending cancellation failed'; end if; end $$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
do $$ begin
  begin update public.donations set status='COMPLETED' where id='30000000-0000-0000-0000-000000000004'; raise exception 'Direct status change succeeded';
  exception when sqlstate '42501' then null; end;
end $$;
select public.expire_overdue_donations();
do $$ begin if (select status from public.donations where id='30000000-0000-0000-0000-000000000005')<>'EXPIRED' then raise exception 'Expiry failed'; end if; end $$;
do $$ declare report jsonb; begin report:=public.get_my_impact(); if (report->>'role')<>'DONOR' or (report->'requests'->>'total')::int<>0 then raise exception 'Donor reporting failed'; end if; end $$;

set request.jwt.claim.sub='10000000-0000-0000-0000-000000000005';
do $$ declare report jsonb; begin report:=public.get_platform_impact(); if (report->>'role')<>'ADMIN' then raise exception 'Admin reporting failed'; end if; end $$;
select public.admin_moderate('USER','10000000-0000-0000-0000-000000000004','RESTRICTED','Repeated abusive requests');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000004';
do $$ begin begin perform public.browse_available_meals(); raise exception 'Restricted account retained access'; exception when sqlstate '42501' then null; end; end $$;
reset role;
do $$ begin if not exists(select 1 from public.notifications where type='REQUEST_UPDATED') or not exists(select 1 from public.activity_logs where action='RECIPIENT_CONFIRMED_COLLECTION') then raise exception 'Missing notifications or audit records'; end if; end $$;
