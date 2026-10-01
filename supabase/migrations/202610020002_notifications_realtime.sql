-- Phase 9: persistent, idempotent workflow notifications and scoped Realtime.

alter table public.notifications
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists event_key text;

alter table public.notifications
  add constraint notifications_entity_reference_complete check (
    (entity_type is null and entity_id is null)
    or (entity_type is not null and btrim(entity_type) <> '' and entity_id is not null)
  );

create unique index notifications_event_key_uidx
  on public.notifications (event_key)
  where event_key is not null;
create index notifications_user_unread_created_at_idx
  on public.notifications (user_id, created_at desc)
  where is_read = false;
create index notifications_entity_idx
  on public.notifications (entity_type, entity_id)
  where entity_id is not null;

comment on column public.notifications.event_key is
  'Stable workflow-event and recipient key used to prevent duplicate notifications.';

create or replace function private.create_notification(
  recipient_id uuid,
  notification_kind public.notification_type,
  notification_title text,
  notification_message text,
  related_entity_type text,
  related_entity_id uuid,
  stable_event_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if recipient_id is null or stable_event_key is null or btrim(stable_event_key) = '' then
    raise exception 'Notification recipient and event key are required';
  end if;

  insert into public.notifications (
    user_id, type, title, message, entity_type, entity_id, event_key
  ) values (
    recipient_id, notification_kind, notification_title, notification_message,
    related_entity_type, related_entity_id, stable_event_key
  )
  on conflict (event_key) where event_key is not null do nothing
  returning id into created_id;

  return created_id;
end;
$$;

revoke all on function private.create_notification(uuid, public.notification_type, text, text, text, uuid, text)
  from public, anon, authenticated;

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
      'The receiving NGO confirmed that your food donation arrived.',
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
        'An NGO accepted your donation. A pickup task is now being prepared.',
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

create or replace function private.notify_pickup_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare donor uuid; ngo_user uuid; recipient uuid;
begin
  select d.donor_id into donor from public.donations d where d.id = new.donation_id;
  select n.user_id into ngo_user
  from public.matches m join public.ngos n on n.id = m.ngo_id
  where m.donation_id = new.donation_id and m.status = 'ACCEPTED'
  limit 1;

  if tg_op = 'INSERT' and new.status = 'AVAILABLE' then
    for recipient in select u.id from public.users u where u.role = 'VOLUNTEER' loop
      perform private.create_notification(
        recipient, 'PICKUP_AVAILABLE', 'Pickup available',
        'A new food rescue pickup is available for volunteers.',
        'PICKUP_TASK', new.id, 'pickup-available:' || new.id || ':' || recipient
      );
    end loop;
    return new;
  end if;

  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then return new; end if;

  if new.status in ('ASSIGNED', 'COLLECTED', 'DELIVERED') then
    for recipient in
      select donor where donor is not null
      union select ngo_user where ngo_user is not null
      union select new.volunteer_id where new.volunteer_id is not null
    loop
      if new.status = 'ASSIGNED' then
        perform private.create_notification(
          recipient, 'PICKUP_ASSIGNED', 'Pickup assigned',
          case when recipient = new.volunteer_id
            then 'You successfully claimed this pickup task.'
            else 'A volunteer has claimed the pickup for this donation.' end,
          'PICKUP_TASK', new.id, 'pickup-assigned:' || new.id || ':' || recipient
        );
      elsif new.status = 'COLLECTED' then
        perform private.create_notification(
          recipient, 'FOOD_COLLECTED', 'Food collected',
          'The volunteer marked the food as collected.',
          'PICKUP_TASK', new.id, 'food-collected:' || new.id || ':' || recipient
        );
      else
        perform private.create_notification(
          recipient, 'FOOD_DELIVERED', 'Food delivered',
          case when recipient = ngo_user
            then 'The food was delivered. Please confirm receipt to complete the rescue.'
            else 'The food was delivered to the receiving NGO.' end,
          'PICKUP_TASK', new.id, 'food-delivered:' || new.id || ':' || recipient
        );
      end if;
    end loop;
  elsif new.status = 'CANCELLED' and old.status <> 'AVAILABLE' then
    for recipient in
      select donor where donor is not null
      union select ngo_user where ngo_user is not null
      union select old.volunteer_id where old.volunteer_id is not null
    loop
      perform private.create_notification(
        recipient, 'DONATION_CANCELLED', 'Pickup cancelled',
        'The pickup task for this donation has been cancelled.',
        'PICKUP_TASK', new.id, 'pickup-cancelled:' || new.id || ':' || recipient
      );
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_donation_change() from public, anon, authenticated;
revoke all on function private.notify_match_change() from public, anon, authenticated;
revoke all on function private.notify_pickup_change() from public, anon, authenticated;

create trigger notifications_after_donation_change
after insert or update of status on public.donations
for each row execute function private.notify_donation_change();

create trigger notifications_after_match_change
after insert or update of status on public.matches
for each row execute function private.notify_match_change();

create trigger notifications_after_pickup_change
after insert or update of status on public.pickup_tasks
for each row execute function private.notify_pickup_change();

-- Postgres Changes applies table RLS before sending rows to subscribers.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then alter publication supabase_realtime add table public.notifications; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'donations'
  ) then alter publication supabase_realtime add table public.donations; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pickup_tasks'
  ) then alter publication supabase_realtime add table public.pickup_tasks; end if;
end;
$$;
