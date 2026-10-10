# RescueBite database

This folder contains the version-controlled PostgreSQL schema for RescueBite. The initial migration created the seven entities specified by the original ERD. The current recipient redesign adds donor profiles, individual recipient profiles, food requests, and collection arrangements. Older phase sections below describe the historical evolution; the [current release guide](../docs/recipient-redesign.md) explains the active workflow and rollout.

## Authentication and profiles

Supabase Auth owns authentication records in `auth.users`. `public.users` stores only application profile data, uses the same UUID as the Auth user, and never stores passwords or authentication secrets. A signed-in user can create their own non-admin profile. Administrative profiles must be provisioned through a trusted backend or SQL administration workflow.

The active application roles are `DONOR`, `NGO`, `RECIPIENT`, and `ADMIN`. The PostgreSQL enum still contains `VOLUNTEER` for historical compatibility, but public signup cannot create it and existing volunteer profiles migrate to recipient profiles. Enum/check constraints validate roles and workflow statuses. No client may create an admin role or mark an NGO verified.

## Row Level Security

RLS is enabled on all application tables, including the four added by the recipient redesign. Policies restrict profiles and notifications to their owners, donations and workflow records to participants, requests and collection details to authorized users, and activity logs to administrators. Old pickup tasks remain readable for authorized historical review; their rider action RPCs are retired. Private `SECURITY DEFINER` helpers perform role and ownership checks without recursive policies on `public.users`.

Frontend role checks are only for user experience; RLS is the actual data boundary. Secured database functions and triggers create workflow notifications; browser users cannot insert or delete them and can update only their own `is_read` value. The Supabase `service_role` remains reserved for trusted backend processes and must never be exposed in browser code.

The original Phase 4 donation migration required positive quantities and meal portions. New direct-collection transitions run through guarded workflow RPCs; donors may edit only posted donations with no pending individual requests.

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

The current Auth trigger creates a `public.users` profile from validated signup metadata for `DONOR`, `NGO`, and `RECIPIENT`. It rejects `ADMIN` and `VOLUNTEER` as public registration roles. Google accounts without an application profile use an authenticated `complete_registration` RPC with the same non-admin allowlist. Email confirmation remains a requirement for individual food requests.

Provision an administrator separately: create the authentication account through the Supabase dashboard or another trusted server-side administration process, then insert its matching UUID and profile details into `public.users` with role `ADMIN` from the SQL editor. Never expose the service-role key in the browser or add an admin option to the public registration form.

## Phase 10: locations and maps

`202610020003_geographic_locations.sql` adds optional paired latitude/longitude to donations and NGO profiles. Both must be absent or valid together (latitude -90 to 90, longitude -180 to 180). Written locations remain required. `matches.distance_km` stores the distance when suggestions are generated.

Matching uses straight-line Haversine distance, not road routing. Distance scores are 100 within 2 km, 90 within 5 km, 75 within 10 km, 50 within 20 km, 25 within 30 km, and 0 beyond 30 km. These local-delivery bands are project assumptions. The existing 30/25/20/15/10 weights remain unchanged. Without both coordinate pairs, existing normalized-text scoring remains in use and distance_km stays null.

Leaflet/react-leaflet displays OpenStreetMap tiles with attribution. Users manually select and confirm a point; the app does not request GPS permissions. Tile requests go to OpenStreetMap and reveal the displayed geographic area; no account data is sent with them. Maps show missing-coordinate and tile-failure messages.

Existing donation and NGO ownership policies protect updates. The historical volunteer destination function is no longer executable by authenticated clients; direct recipients obtain collection details only after acceptance through `get_collection_details`.

Run npm test, npm run lint, and npm run build. For a configured development Supabase project, node scripts/verify-phase10.mjs creates temporary Auth users and exercises coordinate constraints, RLS, matching, realtime, and the delivery workflow, then removes its test records. It needs the ignored .env server secret and must never run in the browser. Do not use real personal data for these checks.

## Phase 11: dashboards and administration

`202610020004_admin_dashboards.sql` adds three RLS-preserving, SECURITY INVOKER RPCs. get_dashboard_summary derives the role from the trusted public profile and returns only that participant's counts. get_admin_dashboard and get_admin_records reject non-admin callers before querying administrative records. No client role parameter, service credential, new table, or public data policy is introduced.

Dashboard counts use PostgreSQL COUNT/FILTER rather than downloading every record. Active donations include posted, matched, and accepted offers; exceptions are shown separately. Completed donations require confirmation by the accepted NGO or individual. Recipient dashboard counts include available meals and request states. The `20261010` redesign adds `account_status` and audited moderation.

Current admin routes are `/admin`, `/admin/users`, `/admin/donations`, `/admin/ngos`, `/admin/recipients`, and `/admin/activity`. Administrators can verify NGOs, restrict or restore non-admin accounts, and cancel eligible donations through `admin_moderate`; they cannot make arbitrary direct status changes. Moderation reasons are audited.

Admin lists use fixed 20-row pages, server-side literal search, and applicable role/status/food/action/entity/date filters. Date boundaries are inclusive UTC days. Existing relationship/status indexes are reused; a created_at/id index supports recent global audit ordering. Recent participant sections fetch at most five records per section. Administrators see relevant profile emails but no phone, password, Auth metadata, or precise coordinate listings.

The existing activity_logs table records the audit view. Small triggers fill previously missing creation/match/expiry/exception events; acceptance, cancellation, pickup, delivery, and confirmation RPCs continue writing their existing events. Historical missing events are not backfilled or fabricated.

The dashboard service layer is src/services/dashboard. Summaries refresh through the existing personal notification provider, on window focus, or with Refresh. Admins use focus/manual refresh because operational notifications belong to participants; no broad realtime subscription was added. The personal notification service now explicitly filters by the authenticated user even when the account has administrative RLS access.

Run node scripts/verify-phase11.mjs against the configured development Supabase project to check aggregates, filters, pagination, admin denial, ownership, and workflow regression. It uses temporary Auth users and removes only its own records, including audit and notification records. Connection settings remain in ignored .env. Run npm test, npm run lint, and npm run build for local validation.

## Phase 12 aggregation
202610020005_analytics_impact.sql adds get_my_impact(date,date), get_platform_impact(date,date), and a completed_at partial index. Both RPCs preserve RLS through SECURITY INVOKER; ownership and admin authorization are derived from the trusted profile. No tables or policies change. See ../docs/analytics.md for definitions, UTC dates, performance and schema limitations.

## Phase 13 security hardening

`202610020006_security_hardening.sql` narrows full NGO profiles to owners, administrators and donors with an existing match; matching discovery uses an owner-checked RPC that omits private contact and description fields. Notifications are recipient-only, including for administrator accounts. Donation and NGO client-write grants exclude server-owned IDs, roles, statuses and timestamps. The migration also rejects null workflow decisions/candidates and adds finite-value, text-bound, and pickup state/timestamp constraints. See `../docs/security.md` for the tested authorization model, live checks and known limits.
