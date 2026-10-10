# Security model and Phase 13 audit

This audit is a historical Phase 13 snapshot. The individual-recipient release adds four protected tables, replaces active Volunteer access, and introduces verified NGOs, account restrictions, direct-collection RPCs, and request controls. See [recipient redesign](recipient-redesign.md) for the current authorization model and its local test scope. The prior live verification figures below do not verify the new hosted release.

This document describes the controls verified on 3 October 2026 against the configured development Supabase project. It records tested boundaries, not a claim that the system is fully secure.

## Authentication and roles

Supabase Auth owns passwords, tokens, session persistence, refresh and logout. `public.users.id` is the matching `auth.users.id`; the application never stores passwords. `DONOR`, `NGO`, `VOLUNTEER` and `ADMIN` are PostgreSQL enum values. Public registration accepts the first three roles. Administrative authority always comes from `public.users.role`, not editable Auth metadata or React state.

Protected routes wait for both the session and database profile. A missing, stale or failed profile cannot render protected content. Session changes clear the previous profile immediately, profile reads have a 15-second limit, and logout clears local application state even when remote token revocation cannot be confirmed.

## Data authorization

RLS is enabled on all seven application tables: `users`, `ngos`, `donations`, `matches`, `pickup_tasks`, `notifications` and `activity_logs`. There are no unrestricted protected-table policies. Private role/ownership helpers use `SECURITY DEFINER` with an empty search path and are not exposed to anonymous callers.

- Profiles are visible to their owner and administrators.
- Donations are visible to the donor, an NGO with a match, an authorized volunteer workflow participant, and administrators. Only a donor can insert its own `POSTED` record. Client grants exclude IDs, timestamps, ownership and status from updates.
- NGO profiles are visible in full only to their owner, administrators, and a donor with an existing match to that NGO. Matching discovery uses `get_matching_ngos(donation_id)`, which verifies donation ownership and returns only scoring/location fields; it omits contact information and descriptions.
- Matches are visible only to the donation owner, matched NGO owner and administrators. State changes use secured workflow functions.
- Pickup tasks are visible only to workflow participants and administrators. Client updates cannot change protected status or timestamps.
- Notifications are readable and markable only by their recipient, including for administrator accounts. Clients cannot insert or delete notification history.
- Activity logs are readable only by administrators and are written by trusted workflow functions/triggers.

Administrative dashboards, record search and platform analytics check the database role. Personal analytics derive ownership from `auth.uid()` and accept no user/NGO/volunteer identifier.

## Workflow and integrity

Matching, acceptance, claiming, collection, delivery, confirmation, cancellation and expiry use PostgreSQL functions and row locks. Unique indexes allow one accepted NGO match and one active pickup per donation. Direct client status changes are denied through column grants and workflow triggers. Invalid, reverse and duplicate transitions fail without creating duplicate notifications or audit events.

Database constraints enforce positive quantities and portions, valid coordinate pairs/ranges, valid availability windows, finite timestamps/numbers, controlled enums, completion timestamps, pickup assignment/collection/delivery timestamps, delivery ordering, relationships, text bounds and non-empty NGO food preferences. Important historical rows use restrictive foreign-key deletion behavior.

Persistent notifications are created in the same transaction as workflow changes. Unique event keys deduplicate them. Realtime subscriptions use the authenticated user's filter and RLS; initial fetch and reconnect reconciliation recover missed events. The client merges by stable notification ID and never changes a locally read notification back to unread from a delayed event.

Donor pickup coordinates remain inside the donation row and therefore inherit donation RLS. An unassociated NGO or volunteer cannot read them. An assigned volunteer receives the destination through a narrow secured function. NGO coordinates are available for donor matching through the limited projection; NGO contact and description fields are not.

## Phase 13 verification

The live suite creates seven temporary accounts (two donors, two NGOs, two volunteers and one administrator), exercises cross-account reads/writes, role forgery, private locations, notifications, analytics, invalid input, all workflow transitions and simultaneous competing operations. It verifies exactly one winner for competing NGO acceptance, pickup claims, deliveries and confirmations. Cleanup inventories the run prefix, removes related records, deletes every temporary Auth account and confirms none remain.

Run:

```sh
npm test
npm run lint
npm run build
node scripts/verify-phase13.mjs
node scripts/verify-phase10.mjs
node scripts/verify-phase11.mjs
node scripts/verify-phase12.mjs
```

The server-side live scripts read ignored `.env` credentials. They must never be bundled or run in the browser. `.env`, `.env.*`, build output, logs, TypeScript build data and the local `Instruction/` folder are ignored. Only public Supabase URL/anon values belong in `VITE_` variables.

## Known limits and warnings

- Browser route guards improve navigation but database RLS/functions remain the authority.
- Realtime delivery depends on network availability. Persistent notification fetch and reconnect reconciliation provide recovery, not guaranteed instant delivery.
- Matching validates eligibility, database-derived distance and score ranges/weighting. The donor client still supplies the non-distance scoring components used by the documented rule-based Phase 5 algorithm.
- OpenStreetMap receives map tile coordinates for the visible map area. The app does not implement live GPS tracking.
- Content Security Policy and other production HTTP security headers depend on the future hosting configuration and must be verified there.
- The production bundle currently reports Vite's existing chunk-size warning. It does not expose a known security defect, but later code splitting can improve load performance.
