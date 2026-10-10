-- TEST ONLY: use in a disposable local PostgreSQL database before migrations.
-- Supabase supplies these objects in hosted projects. Never apply this file there.
create schema auth;
create table auth.users (
  id uuid primary key, email text, phone text,
  email_confirmed_at timestamptz, phone_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid(), auth.jwt() to authenticated, anon;
create schema extensions;
create publication supabase_realtime;
