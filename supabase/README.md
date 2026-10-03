# RescueBite database

This folder contains the version-controlled PostgreSQL schema for RescueBite. The initial migration creates the seven entities specified by `Instruction/ERD.md`: users, NGOs, donations, matches, pickup tasks, notifications, and activity logs.

## Authentication and profiles

Supabase Auth owns authentication records in `auth.users`. `public.users` stores only application profile data, uses the same UUID as the Auth user, and never stores passwords or authentication secrets. A signed-in user can create their own non-admin profile. Administrative profiles must be provisioned through a trusted backend or SQL administration workflow.

The application roles are `DONOR`, `NGO`, `VOLUNTEER`, and `ADMIN`. PostgreSQL enum types validate roles and workflow statuses. Database triggers also ensure NGO profiles, donations, and pickup assignments reference users with the correct role.

## Row Level Security

RLS is enabled on all seven application tables. Policies restrict profiles and notifications to their owners, donations and workflow records to participating users, NGO profiles to their owner for writes, pickup tasks to authorized volunteers, and activity logs to administrators. Private `SECURITY DEFINER` helper functions perform role and ownership checks without recursively invoking policies on `public.users`.

Frontend role checks are only for user experience; RLS is the actual data boundary. Secured database functions and triggers create workflow notifications; browser users cannot insert or delete them and can update only their own `is_read` value. The Supabase `service_role` remains reserved for trusted backend processes and must never be exposed in browser code.

The Phase 4 donation migration requires positive quantities and meal portions. Its update trigger limits donors to editing a `POSTED` donation or moving it to `CANCELLED`; later workflow transitions remain reserved for trusted future services and administrators.

Phase 5 stores rule-based suggestions through `store_donation_matches`. This narrow `SECURITY DEFINER` function verifies donation ownership, candidate NGO compatibility/capacity, score ranges, the weighted total, and duplicate keys before it writes. It is also the only donor-accessible path that can move a donation between `POSTED` and `MATCHED`; the frontend never receives the service-role key.

Phase 6 uses `respond_to_donation_match` for NGO decisions. It locks both the NGO-owned match and donation, validates the role, ownership, deadline, and current states, then accepts or declines in one transaction. Direct browser updates to match status are revoked. Acceptance expires competing suggestions and creates an activity log; declining the last actionable suggestion restores the donation to `POSTED`.

Phase 7 extends acceptance to create one active pickup task per donation. `claim_pickup_task` locks the task so simultaneous volunteers produce one winner; `mark_pickup_collected` requires the assigned volunteer. Protected pickup assignment and status columns are guarded by a trigger and workflow RPCs. The migration stops at `COLLECTED`.

Phase 8 adds `donations.completed_at` and completes the operational lifecycle without adding another table. `mark_pickup_delivered` requires the assigned volunteer and atomically synchronizes the pickup and donation at `DELIVERED`. `confirm_donation_receipt` requires ownership of the accepted NGO match and moves only the donation to `COMPLETED`. Row locks make duplicate and concurrent requests produce one successful transition, while timestamp constraints and the existing workflow triggers prevent contradictory states.

Phase 9 extends `notifications` with an optional related entity and a stable event key. Private trigger functions create persistent donor, NGO, and volunteer notifications in the same transaction as each successful workflow change. A unique partial index prevents duplicate events, including concurrent requests. Realtime publishes only `notifications`, `donations`, and `pickup_tasks`; table RLS still decides which rows an authenticated subscriber can receive.

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

## Phase 10: locations and maps

`202610020003_geographic_locations.sql` adds optional paired latitude/longitude to donations and NGO profiles. Both must be absent or valid together (latitude -90 to 90, longitude -180 to 180). Written locations remain required. `matches.distance_km` stores the distance when suggestions are generated.

Matching uses straight-line Haversine distance, not road routing. Distance scores are 100 within 2 km, 90 within 5 km, 75 within 10 km, 50 within 20 km, 25 within 30 km, and 0 beyond 30 km. These local-delivery bands are project assumptions. The existing 30/25/20/15/10 weights remain unchanged. Without both coordinate pairs, existing normalized-text scoring remains in use and distance_km stays null.

Leaflet/react-leaflet displays OpenStreetMap tiles with attribution. Users manually select and confirm a point; the app does not request GPS permissions. Tile requests go to OpenStreetMap and reveal the displayed geographic area; no account data is sent with them. Maps show missing-coordinate and tile-failure messages.

Existing donation and NGO ownership policies protect updates. Volunteers obtain receiving coordinates through get_pickup_destination only for their assigned task and its accepted NGO. This does not grant unrestricted access to NGO profiles.

Run npm test, npm run lint, and npm run build. For a configured development Supabase project, node scripts/verify-phase10.mjs creates temporary Auth users and exercises coordinate constraints, RLS, matching, realtime, and the delivery workflow, then removes its test records. It needs the ignored .env server secret and must never run in the browser. Do not use real personal data for these checks.

## Phase 11: dashboards and administration

`202610020004_admin_dashboards.sql` adds three RLS-preserving, SECURITY INVOKER RPCs. get_dashboard_summary derives the role from the trusted public profile and returns only that participant's counts. get_admin_dashboard and get_admin_records reject non-admin callers before querying administrative records. No client role parameter, service credential, new table, or public data policy is introduced.

Dashboard counts use PostgreSQL COUNT/FILTER rather than downloading every record. Active donations are POSTED, MATCHED, ACCEPTED, PICKUP_ASSIGNED, COLLECTED, or DELIVERED; EXCEPTION is shown separately. Delivered pickups count completed volunteer deliveries, while completed donations require NGO receipt confirmation. Available pickups and pending NGO decisions exclude elapsed deadlines; persisted donation status totals reflect the stored state. NGO user count and completed organization profile count are separate values. The users table has no suspension/account-status field, so the interface shows profile creation and role rather than inventing an account status.

Admin routes are /admin, /admin/users, /admin/donations, /admin/ngos, /admin/volunteers, and /admin/activity. The earlier /admin/activity-logs URL redirects to /admin/activity. These screens provide read-only visibility, not account deletion or arbitrary workflow changes. Restrictive UPDATE policies prevent authenticated admins from editing donations, matches, or pickup tasks directly; participant policies and secured transition RPCs remain in place.

Admin lists use fixed 20-row pages, server-side literal search, and applicable role/status/food/action/entity/date filters. Date boundaries are inclusive UTC days. Existing relationship/status indexes are reused; a created_at/id index supports recent global audit ordering. Recent participant sections fetch at most five records per section. Administrators see relevant profile emails but no phone, password, Auth metadata, or precise coordinate listings.

The existing activity_logs table records the audit view. Small triggers fill previously missing creation/match/expiry/exception events; acceptance, cancellation, pickup, delivery, and confirmation RPCs continue writing their existing events. Historical missing events are not backfilled or fabricated.

The dashboard service layer is src/services/dashboard. Summaries refresh through the existing personal notification provider, on window focus, or with Refresh. Admins use focus/manual refresh because operational notifications belong to participants; no broad realtime subscription was added. The personal notification service now explicitly filters by the authenticated user even when the account has administrative RLS access.

Run node scripts/verify-phase11.mjs against the configured development Supabase project to check aggregates, filters, pagination, admin denial, ownership, and workflow regression. It uses temporary Auth users and removes only its own records, including audit and notification records. Connection settings remain in ignored .env. Run npm test, npm run lint, and npm run build for local validation.

## Phase 12 aggregation
202610020005_analytics_impact.sql adds get_my_impact(date,date), get_platform_impact(date,date), and a completed_at partial index. Both RPCs preserve RLS through SECURITY INVOKER; ownership and admin authorization are derived from the trusted profile. No tables or policies change. See ../docs/analytics.md for definitions, UTC dates, performance and schema limitations.

## Phase 13 security hardening

`202610020006_security_hardening.sql` narrows full NGO profiles to owners, administrators and donors with an existing match; matching discovery uses an owner-checked RPC that omits private contact and description fields. Notifications are recipient-only, including for administrator accounts. Donation and NGO client-write grants exclude server-owned IDs, roles, statuses and timestamps. The migration also rejects null workflow decisions/candidates and adds finite-value, text-bound, and pickup state/timestamp constraints. See `../docs/security.md` for the tested authorization model, live checks and known limits.
