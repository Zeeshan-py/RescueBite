-- Phase 3: create application profiles when Supabase Auth registers a user.
-- Email confirmation can leave signUp without a session, so this trusted trigger
-- creates the profile without weakening the public.users RLS policies.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role text := upper(coalesce(new.raw_user_meta_data ->> 'role', ''));
  profile_name text := btrim(coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    ''
  ));
  profile_phone text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
begin
  -- Accounts provisioned outside public registration (including admins) can be
  -- created without role metadata and receive a profile through an admin workflow.
  if selected_role = '' then
    return new;
  end if;

  if selected_role not in ('DONOR', 'NGO', 'VOLUNTEER') then
    raise exception 'Invalid public registration role';
  end if;

  if profile_name = '' then
    raise exception 'A profile name is required';
  end if;

  insert into public.users (id, name, email, phone, role)
  values (
    new.id,
    profile_name,
    new.email,
    profile_phone,
    selected_role::public.app_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

comment on function public.handle_new_auth_user() is
  'Creates DONOR, NGO, or VOLUNTEER profiles from validated Supabase Auth signup metadata.';
