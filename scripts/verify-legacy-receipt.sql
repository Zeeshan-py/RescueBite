-- Run after verify-recipient-schema.sql in a disposable local superuser-owned database.
-- A historical delivered pickup may be confirmed without retroactively
-- inventing a new collection time or erasing its volunteer record.
\set ON_ERROR_STOP on
insert into auth.users(id,email,raw_user_meta_data) values
('10000000-0000-0000-0000-000000000006','former-rider@example.test','{}');
insert into public.users(id,name,email,role) values
('10000000-0000-0000-0000-000000000006','Former Rider','former-rider@example.test','VOLUNTEER');
insert into public.donations(id,donor_id,food_type,quantity,meal_portions,location,available_from,collection_deadline,status)
values ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','Bakery',7,7,'Private pickup',now()-interval '3 hours',now()+interval '1 hour','ACCEPTED');
insert into public.matches(donation_id,ngo_id,matching_score,distance_score,urgency_score,compatibility_score,capacity_score,availability_score,status)
values ('30000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000001',85,50,100,100,100,100,'ACCEPTED');
insert into public.pickup_tasks(donation_id,volunteer_id,pickup_location,delivery_location,pickup_time,collected_at,delivered_at,status)
values ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000006','Private pickup','Test NGO',now()-interval '30 minutes',now()-interval '20 minutes',now()-interval '10 minutes','DELIVERED');
insert into public.collection_arrangements(donation_id,recipient_id) values
('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000002');
-- Reconstruct a pre-migration DELIVERED state without re-enabling the retired
-- rider transition APIs. Never use session_replication_role in Supabase.
set session_replication_role='replica';
update public.donations set status='DELIVERED' where id='30000000-0000-0000-0000-000000000007';
reset session_replication_role;
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
select public.confirm_donation_receipt('30000000-0000-0000-0000-000000000007');
reset role;
do $$ begin
  if (select status from public.donations where id='30000000-0000-0000-0000-000000000007')<>'COMPLETED'
    or (select volunteer_id from public.pickup_tasks where donation_id='30000000-0000-0000-0000-000000000007')<>'10000000-0000-0000-0000-000000000006' then
    raise exception 'Legacy receipt or pickup history failed';
  end if;
end $$;
