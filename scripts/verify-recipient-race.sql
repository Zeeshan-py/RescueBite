-- Run after verify-recipient-schema.sql in the same disposable database.
\set ON_ERROR_STOP on
insert into public.donations(id,donor_id,food_type,quantity,meal_portions,location,available_from,collection_deadline,recipient_scope,public_area)
values ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Bakery',6,6,'Private pickup',now()-interval '1 hour',now()+interval '2 hours','BOTH','Lahore');
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select public.store_donation_matches('30000000-0000-0000-0000-000000000006',jsonb_build_array(jsonb_build_object('ngo_id','20000000-0000-0000-0000-000000000001','distance_score',50,'urgency_score',100,'compatibility_score',100,'capacity_score',100,'availability_score',100,'matching_score',85)));
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
select public.request_food('30000000-0000-0000-0000-000000000006');
