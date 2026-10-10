# Production release status — 10 October 2026

Status: blocked before database migration and frontend publication. The currently
deployed site remains in place. Local checks do not establish production readiness.

## Verified

- `npm test`: 141 tests pass across 18 files.
- `npm run lint`: passes.
- `npm run build`: passes, including TypeScript compilation.
- GitHub access and fetch work; the recipient release is ahead of remote `main`.
- The production homepage and its referenced JavaScript assets return HTTP 200.
- Supabase Auth reports Google and email enabled, email confirmation required,
  and phone authentication disabled.
- Existing application tables are reachable through the authenticated REST API.
- The REST API reports `PGRST205` for `donor_profiles`, `recipient_profiles`,
  `food_requests`, and `collection_arrangements`. The new frontend must not be
  published until these schema dependencies are applied and verified.
- `.env` and `Instruction/` remain ignored by Git.
- Anonymous reads of all seven existing application tables were denied with HTTP
  401 / PostgreSQL permission error `42501`. This is a limited access check, not
  a complete role-policy audit.
- Configured private credentials were not found in tracked files or build output.
- Direct requests to `/login`, `/auth/google/callback`, and `/dashboard` return
  HTML with HTTP 200. This verifies SPA routing, not authenticated workflows.

## Release blockers

1. The configured direct PostgreSQL hostname does not resolve from this machine.
   A backup and inspection of `supabase_migrations.schema_migrations` could not
   be performed. Obtain the project's actual Session pooler connection from
   Supabase and store it locally in the ignored configuration; do not guess its
   host or put credentials in Git.
2. No authenticated Supabase or Netlify CLI session was found. Browser automation
   could not initialize, so dashboard settings could not be inspected or changed.
3. Donor posting requires a verified phone. Configure a supported SMS provider and
   enable phone authentication before release; do not remove the verification guard.
4. Hosted staging Auth/SMS/OAuth and both collection workflows remain unverified.

## Resume sequence

1. Restore database connectivity and authenticated platform administration access.
2. Back up production, inspect migration history and existing data, and validate
   the release in a separate Supabase test project as described in
   [recipient-redesign.md](recipient-redesign.md).
3. Review the pending migration list. Commit the enum migration separately from
   statements using its new values, then apply the recipient and reporting
   migrations in their documented order through Supabase migration tooling.
4. Verify tables, constraints, RLS, function grants, migration history, preserved
   historical rows, and restricted access with representative test accounts.
5. Verify email confirmation, SMS delivery, Google OAuth and production redirect
   URLs. Netlify needs only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for
   this frontend; never expose server credentials as browser build variables.
6. Push the validated release to GitHub `main`, verify the Netlify deployment
   matches that commit, then check direct route refreshes, login/logout, donor
   posting, NGO verification/acceptance, individual requests, collection receipt,
   notifications, and admin access restrictions.

No production backup, migration, settings mutation, or new deployment was performed
during this preflight. No security checks were disabled to make the release proceed.
