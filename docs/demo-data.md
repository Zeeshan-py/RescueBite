# University demonstration dataset

RescueBite's live Supabase project includes a **synthetic demonstration dataset**. It is meant to demonstrate application behavior, not to claim that food was collected, delivered, or received in the real world. The donor, volunteer, administrator, and NGO representative accounts are invented demonstration identities. Organization profiles are fictional and carry a `DEMO` prefix; none claims an affiliation with a real charity, restaurant, university, or landmark. No private person's email address, phone number, CNIC, or residence is included. Demonstration emails use the reserved `example.com` domain.

The seed uses the existing Supabase Auth profile trigger, role rules, donor matching RPC, NGO acceptance RPC, volunteer pickup RPCs, receipt confirmation RPC, notification triggers, and activity logging. It does not change those rules or hard-code dashboard values. Its 30/25/20/15/10 matching components come from the application matching module and are validated by the database RPC. For historical scenarios, the workflow is run first against valid future deadlines, then **only the resulting demo records** receive synthetic past event timestamps. Thus history charts illustrate a plausible timeline; they are not historical operational evidence. `updated_at` can reflect the import time because of the existing trigger.

The target is 24 new demo users (8 donors, 10 NGO representatives, 5 volunteers, 1 administrator), 10 demo NGOs, and 63 donations. The latter include completed, delivered, collected, assigned, available, matched, posted, cancelled, expired, and exception examples. Three additional current matched donations keep every NGO dashboard actionable. Matches, pickup tasks, notifications, and activity logs are created through the workflow. A pickup task ends at `DELIVERED`; the donation ends at `COMPLETED` after NGO receipt confirmation. This follows the actual database enums.

At the 5 October 2026 verification snapshot, the database held 25 users (including one pre-existing donor left untouched), 10 NGOs, 63 donations, 177 matches, 53 pickup tasks, 1,349 workflow notifications, and 559 activity logs. Thirty-six donations were completed. The demo matching scores ranged from 66.75 to 82, and completed events span several months. These are **synthetic scenario counts**, not real-world impact figures. All dashboard and impact totals remain calculated from Supabase records.

## Public location reference points

The map uses public OpenStreetMap feature centroids as reference points for **imaginary demo pickup and service areas near** these landmarks. Coordinates identify the named public landmark, not an actual donor address or NGO office. OpenStreetMap contributors provide the public geographic data; the [Lahore map](https://www.openstreetmap.org/#map=11/31.5140/74.3540) gives geographic context.

| Public place | OpenStreetMap feature | Demo profile |
| --- | --- | --- |
| Liberty Market | [OSM way 905333178](https://www.openstreetmap.org/way/905333178) | DEMO Liberty Community Pantry |
| Lahore Museum | [OSM way 792447292](https://www.openstreetmap.org/way/792447292) | DEMO Museum District Food Circle |
| Badshahi Mosque | [OSM relation 12271286](https://www.openstreetmap.org/relation/12271286) | DEMO Walled City Relief Kitchen |
| Minar-e-Pakistan | [OSM way 232401426](https://www.openstreetmap.org/way/232401426) | DEMO Iqbal Park Food Network |
| Lahore Cantt Railway Station | [OSM node 2433364441](https://www.openstreetmap.org/node/2433364441) | DEMO Station Neighbourhood Pantry |
| Model Town Park | [OSM way 173961470](https://www.openstreetmap.org/way/173961470) | DEMO Model Town Food Share |
| Jilani Park | [OSM way 246128683](https://www.openstreetmap.org/way/246128683) | DEMO Jilani Community Kitchen |
| Gaddafi Stadium | [OSM way 172700971](https://www.openstreetmap.org/way/172700971) | DEMO Stadium Area Food Share |
| Shalimar Gardens | [OSM way 232344024](https://www.openstreetmap.org/way/232344024) | DEMO Shalimar Community Pantry |
| Punjab University | [OSM way 380521517](https://www.openstreetmap.org/way/380521517) | DEMO Campus Food Circle |

The landmark names and coordinates were checked against the [OpenStreetMap Nominatim search API](https://nominatim.org/release-docs/latest/api/Search/) on 5 October 2026. The profile names, capacities, food preferences, donation amounts, and all activity are invented for demonstration. A map marker near a landmark does not imply permission to collect food there.

## Reproduction and safety

Run `node scripts/seed-demo.mjs` from the repository root with the project's ignored `.env` already configured. The script asserts the intended Supabase project URL before writing, checks all seven application tables, creates users through Supabase Auth, and saves progress to ignored `.demo-seed-state.json.local`. That local manifest contains **random demo account passwords** and must never be committed, copied into documentation, or exposed in the browser. The script resumes completed records and refuses to silently adopt a pre-existing demo email if its manifest is missing. Do not run against another project. Run `node scripts/verify-demo.mjs` to check counts, referential coherence, event timestamps, role dashboards, impact reports, and a small set of authorization boundaries.

The script does not delete or rewrite any pre-existing non-demo record. It does not call the global expiry RPC because that could affect unrelated overdue donations; the one expired example is updated by the server-side service client with a specific demo donation ID and is still processed by the existing notification and activity triggers. The service key remains in ignored `.env` and is never bundled into the frontend.

For a classroom walkthrough, the locally stored `donor0`, `ngo1`, `volunteer0`, and `admin` accounts show rich examples for each role. `ngo0`, `ngo3`, and `ngo9` intentionally show incoming opportunities rather than completed distributions. Their email addresses and passwords are in the ignored local manifest; never publish that file or put the passwords in a handout. Authentication is required to see role dashboards, so the public landing page does not display protected personal data.

Demo accounts can be used for a supervised classroom presentation, but the synthetic dataset should be removed or clearly separated before real users or real food coordination rely on this project. The application should not present demo impact totals as verified real-world impact.

This is a dated snapshot, not a perpetual fixture. Current matched and available donations have real future deadlines relative to the seed date and will eventually become overdue. Re-running the script with its existing manifest is intentionally idempotent; it will not invent fresh activity or silently extend those deadlines.
