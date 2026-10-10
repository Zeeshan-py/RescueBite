-- Phone numbers are optional contact details. Auth remains email based.
-- The existing users RLS policy keeps phone private to its owner and admins;
-- this RPC shares it only with participants after a donation is accepted.
alter table public.users add constraint users_contact_phone_format check (
  phone is null or (
    length(phone) <= 30
    and phone ~ '^[+0-9(). -]+$'
    and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15
  )
) not valid;

create or replace function public.get_profile_verification() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_actor();
  select jsonb_build_object(
    'email_verified', a.email_confirmed_at is not null,
    'account_status', u.account_status,
    'daily_request_limit', r.daily_request_limit
  ) into result
  from public.users u
  join auth.users a on a.id=u.id
  left join public.recipient_profiles r on r.user_id=u.id
  where u.id=auth.uid();
  return result;
end; $$;

create or replace function private.validate_distribution() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.recipient_scope<>'NGO_ONLY' and length(btrim(new.public_area))<2 then
    raise exception 'A general area is required for individual meals';
  end if;
  if tg_op='INSERT' and auth.uid() is not null then
    perform private.require_actor('DONOR');
    if not exists(select 1 from public.donor_profiles where user_id=auth.uid()) then
      raise exception 'Complete your donor business profile first';
    end if;
    if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
      raise exception 'Confirm your email before posting';
    end if;
    if new.collection_deadline<=now() then
      raise exception 'Collection deadline must be in the future';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.get_collection_details(target_donation_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); result jsonb;
begin
  select jsonb_build_object(
    'donation_id',d.id,'recipient_id',c.recipient_id,
    'collection_time',c.collection_time,'instructions',c.instructions,
    'pickup_address',d.location,'latitude',d.latitude,'longitude',d.longitude,
    'available_from',d.available_from,'collection_deadline',d.collection_deadline,
    'donor_name',donor.name,'business_name',p.business_name,
    'contact_phone',donor.phone,'contact_email',donor.email,'pickup_hours',p.pickup_hours,
    'recipient_name',recipient.name,'recipient_phone',recipient.phone,'recipient_email',recipient.email,
    'status',d.status,'completed_at',d.completed_at
  ) into result
  from public.collection_arrangements c
  join public.donations d on d.id=c.donation_id
  join public.users donor on donor.id=d.donor_id
  join public.users recipient on recipient.id=c.recipient_id
  left join public.donor_profiles p on p.user_id=donor.id
  where c.donation_id=target_donation_id
    and d.status in ('ACCEPTED','PICKUP_ASSIGNED','COLLECTED','DELIVERED','COMPLETED')
    and (c.recipient_id=actor or d.donor_id=actor or private.is_admin());
  if result is null then
    raise exception 'Collection details unavailable or not authorized' using errcode='42501';
  end if;
  return result;
end; $$;

-- Function grants from the preceding recipient migration remain unchanged.
notify pgrst,'reload schema';
