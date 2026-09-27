-- Phase 4: enforce valid donation values and donor-owned workflow transitions.

alter table public.donations drop constraint if exists donations_quantity_check;
alter table public.donations drop constraint if exists donations_quantity_positive;
alter table public.donations add constraint donations_quantity_positive check (quantity > 0) not valid;
alter table public.donations validate constraint donations_quantity_positive;

alter table public.donations drop constraint if exists donations_meal_portions_check;
alter table public.donations drop constraint if exists donations_meal_portions_positive;
alter table public.donations add constraint donations_meal_portions_positive check (meal_portions > 0) not valid;
alter table public.donations validate constraint donations_meal_portions_positive;

create or replace function public.enforce_donor_donation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted backend jobs and administrators retain responsibility for later phases.
  if (select auth.uid()) is null or (select private.is_admin()) then
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

revoke all on function public.enforce_donor_donation_update() from public, anon, authenticated;

drop trigger if exists donations_enforce_donor_update on public.donations;
create trigger donations_enforce_donor_update
before update on public.donations
for each row execute function public.enforce_donor_donation_update();

comment on function public.enforce_donor_donation_update() is
  'Prevents donors from editing progressed donations or selecting later workflow statuses.';

drop policy if exists donations_insert_own_or_admin on public.donations;
create policy donations_insert_own_or_admin on public.donations
for insert to authenticated
with check (
  (donor_id = (select auth.uid()) and status = 'POSTED')
  or (select private.is_admin())
);
