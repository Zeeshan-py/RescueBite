# Individual recipients: schema, rollout, and verification

This release replaces the active Volunteer/Rider journey with direct collection by a verified NGO or registered individual. The frontend depends on the `20261010` migrations. **Do not deploy it against the prior database schema.**

## Migration order

1. `202610100001_recipient_enums.sql` adds the `RECIPIENT` enum value and request/collection notification types. PostgreSQL enum additions are committed before later statements use them.
2. `202610100002_individual_recipients.sql` adds donor and recipient profiles, NGO verification, donation eligibility and public area, food requests, collection arrangements, policies, guarded RPCs, account moderation, notifications, and audit details. Existing `VOLUNTEER` profiles become `RECIPIENT`; their historical pickup-task rows remain unchanged.
3. `202610100003_recipient_reporting.sql` adjusts matching, cancellation, notifications, dashboard/admin views, and impact reporting to the two new pathways.

The old `pickup_tasks` table, its foreign keys, and original migrations are retained for audit. Rider RPC grants are revoked for authenticated users. The active signup role allowlist is Donor, NGO, or Recipient. There is no public Admin registration.

## Safety model

Each food request reserves a **whole donation** with its posted portion count. Donor acceptance and NGO acceptance both lock the donation row, then update competing requests/matches in the same transaction. A partial unique index allows at most one accepted/completed individual request per donation. Donor edits to a posted offer are blocked while pending individual requests exist. An accepted recipient, donor, or admin can access the private collection record; an individual browsing available meals receives only sanitized listing fields.

New donor posts require a business profile and Supabase Auth phone verification matching the application profile phone. Recipient requests require a profile and verified email and are capped by `daily_request_limit` (default five per rolling 24 hours). NGO matching and acceptance require administrator verification. Account restriction is checked in role helpers and restrictive write policies. Moderation requires a reason and writes an audit event. Donor contact and precise collection details are returned by `get_collection_details` only to participants after acceptance. Existing matched NGOs retain access to the donation details needed to decide whether to accept; donor contact is not in those records.

NGO and individual recipients confirm receipt through `confirm_donation_receipt` after the donor sets a collection time and that time arrives. A previously delivered legacy pickup task can also be confirmed without inventing a new arrangement time. Completion writes an audit event, updates a related individual request if present, and lets existing notification triggers notify participants. Current deadlines and status guards remain. A donor can cancel an active donation; expiry synchronizes pending/accepted requests.

## Deployment sequence

1. Back up the target database and inspect existing `public.users` roles, NGO profiles, donations, matches, and pickup tasks. In particular, count existing volunteer profiles (they become recipients without a recipient profile) and NGOs (they begin as `PENDING` until reviewed). Historical records are preserved.
2. Apply these migrations to a **separate Supabase test project** first. Verify Auth sign-up and Google sign-in, email confirmation, donor SMS verification, NGO admin verification, both collection pathways, RLS, notifications, and reports using test accounts. Do not put service-role credentials in the browser.
3. Configure Supabase Auth email confirmation and an SMS provider before enabling donor posting. Configure Site URL and redirect URLs for the production Netlify domain and localhost as described in the [OAuth guide](google-sign-in.md).
4. For the production database, review the pending migration list with `npx supabase db push --dry-run` after `npx supabase link --project-ref <project-ref>`. Apply the three migrations with `npx supabase db push` only after the backup, review, and explicit release decision. Migration files are the source of truth; do not hand-create tables in the dashboard.
5. Verify production schema/RLS and administrator NGO verification, then deploy the matching frontend build to Netlify. Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as public build settings. Never add a database password or service-role key to Netlify's browser bundle.
6. Smoke-test a non-sensitive donor/NGO/recipient journey and inspect logs. If an operational issue appears after migration, use a new forward migration; PostgreSQL enum additions and migrated roles should not be assumed safely reversible by deleting files.

This repository change has **not** applied a live Supabase migration or deployed the new frontend. A clean local PostgreSQL run is evidence of syntax and workflow behavior, not hosted Auth/SMS/OAuth readiness.

## Local SQL integration check

Use a disposable PostgreSQL database, not the user's live project. `scripts/local-auth-bootstrap.sql` defines minimal Auth stubs for PostgreSQL alone and must **never** be applied to Supabase. Apply the existing migration files in filename order, then run `scripts/verify-recipient-schema.sql`. It creates only synthetic local accounts and asserts role denial, sanitized browsing, duplicate rejection, cancellation, expiry, request notifications, and successful NGO/individual confirmations. `scripts/verify-recipient-race.sql` prepares a third offer for a two-session acceptance race; exactly one acceptance should succeed and the resulting donation must have one allocation. `scripts/verify-legacy-receipt.sql` reconstructs a previously delivered rider record in a disposable superuser-owned database and confirms that the NGO can finish it. It uses `session_replication_role` only to set up a synthetic historical state; never run it in Supabase.

The standard frontend checks are `npm test`, `npm run lint`, and `npm run build` (which includes TypeScript). The tests do not use or reveal project credentials.

## Known limits

There is no partial allocation, delivery dispatch, food-safety inspection, or medical/dietary profiling. Existing volunteers become recipient accounts but must supply a general area before requesting food. Existing donors must add business details and verify their phone before posting new food; existing NGOs need administrator review before receiving new suggestions. Food portions and impact remain estimates based on donor entries and confirmed collection.
