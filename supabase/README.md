# RescueBite database

This folder contains the version-controlled PostgreSQL schema for RescueBite. The initial migration creates the seven entities specified by `Instruction/ERD.md`: users, NGOs, donations, matches, pickup tasks, notifications, and activity logs.

## Authentication and profiles

Supabase Auth owns authentication records in `auth.users`. `public.users` stores only application profile data, uses the same UUID as the Auth user, and never stores passwords or authentication secrets. A signed-in user can create their own non-admin profile. Administrative profiles must be provisioned through a trusted backend or SQL administration workflow.

The application roles are `DONOR`, `NGO`, `VOLUNTEER`, and `ADMIN`. PostgreSQL enum types validate roles and workflow statuses. Database triggers also ensure NGO profiles, donations, and pickup assignments reference users with the correct role.

## Row Level Security

RLS is enabled on all seven application tables. Policies restrict profiles and notifications to their owners, donations and workflow records to participating users, NGO profiles to their owner for writes, pickup tasks to authorized volunteers, and activity logs to administrators. Private `SECURITY DEFINER` helper functions perform role and ownership checks without recursively invoking policies on `public.users`.

Frontend role checks are only for user experience; RLS is the actual data boundary. The Supabase `service_role` is reserved for trusted backend processes that will later create matches, pickup tasks, notifications, and activity logs. Never expose the service-role key in browser code.

The Phase 4 donation migration requires positive quantities and meal portions. Its update trigger limits donors to editing a `POSTED` donation or moving it to `CANCELLED`; later workflow transitions remain reserved for trusted future services and administrators.

## Applying migrations

With the Supabase CLI and Docker installed, a clean local database can be created with:

```bash
npx supabase start
npx supabase db reset
```

For the linked remote project, review pending changes and then apply them:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Connection details belong in the ignored project-root `.env` file. Do not put passwords, service-role keys, or database URLs in migrations or committed configuration.

## Adding future migrations

Do not edit a migration after it has been applied to a shared database. Generate a new timestamped file, make one focused schema change, test from a clean database, and commit the new file:

```bash
npx supabase migration new describe_the_change
npx supabase db reset
```

Development users should be created through Supabase Auth. No seed file is included because profile rows must reference real `auth.users` UUIDs, and passwords must never be stored in SQL seed files.

## Registration and administrator accounts

The Phase 3 Auth trigger creates a `public.users` profile from validated signup metadata for `DONOR`, `NGO`, and `VOLUNTEER` registrations. It intentionally rejects `ADMIN` as a public registration role. With email confirmation enabled, this lets the profile be created before the user has an authenticated browser session.

Provision an administrator separately: create the authentication account through the Supabase dashboard or another trusted server-side administration process, then insert its matching UUID and profile details into `public.users` with role `ADMIN` from the SQL editor. Never expose the service-role key in the browser or add an admin option to the public registration form.
