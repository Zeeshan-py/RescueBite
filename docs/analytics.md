# Analytics and impact (Phase 12)

This page documents the earlier Phase 12 metric design. The individual-recipient release adds `/recipient/analytics`, recipient request counts, and direct collection. For the current rollout and limits, see [recipient redesign](recipient-redesign.md); historical volunteer task measures below apply only to retained records.

Routes: `/admin/analytics`, `/donor/analytics`, `/ngo/analytics`, `/volunteer/analytics`.
The existing dashboard navigation links to each role's report. No export or new realtime system is added.

## Sources and ownership

`get_my_impact(from_date, to_date)` derives the role from the trusted profile and the owner from `auth.uid()`. It accepts no user, NGO or volunteer ID. Donors use their donations; NGOs use donations with their own ACCEPTED match (pending candidates are reported separately); volunteers use their own assigned tasks. Available tasks and another participant's records do not become personal impact. `get_platform_impact` explicitly checks ADMIN before invoking the aggregate. Both functions use SECURITY INVOKER, an empty search path and existing RLS. Anonymous execution is revoked. There are no new policies, tables, workflow transitions, stored impact numbers, or service keys in the frontend.

PostgreSQL COUNT, SUM, EXISTS, GROUP BY and date filtering return one aggregate JSON response. EXISTS avoids multiplication by candidate NGO matches. Existing relationship/creation indexes are reused; a partial completed_at index supports completion-date reporting. Trends are daily for up to 91 inclusive days, monthly for up to 3661 days, yearly for longer all-time history. The browser never downloads all donations/tasks/users to calculate totals. Bars use CSS and exact-value labels, without a chart dependency.

## Dates: two distinct measures

Last 7/30/90 days include today and preceding UTC calendar days; today can be incomplete. Custom dates are inclusive UTC days, at most 3660 days apart, with no future end date. All time has no arbitrary start date. Database comparisons use midnight UTC and an exclusive next-day upper boundary.

Creation cohorts select donations by created_at and report their **current** state, even if completion occurred later. Task cohorts independently select pickup_tasks.created_at. Event impact and trends select actual completed_at, collected_at or delivered_at. A donation posted last month and completed today contributes to today's event impact, while it remains in last month's creation cohort. Cohort redistributed portions and period redistributed portions intentionally differ. Current states are not reconstructed historical snapshots.

## Metric definitions

| Metric | Definition |
| --- | --- |
| Total / active donations | Cohort count / cohort count in POSTED, MATCHED, ACCEPTED, PICKUP_ASSIGNED, COLLECTED, DELIVERED |
| Completed / cancelled / expired | Cohort counts of the respective persisted states; EXCEPTION remains separate in the status breakdown |
| Portions donated | Sum of meal_portions on cohort donations, including unsuccessful donations |
| Cohort redistributed portions | Sum of meal_portions on COMPLETED cohort donations only |
| Period completed / redistributed portions | Count / sum of meal_portions on COMPLETED donations with completed_at in the period |
| Match rate | Cohort donations with any stored candidate match / all cohort donations |
| Acceptance rate | Cohort donations with a currently ACCEPTED match / cohort donations with any stored match |
| Pickup completion rate | Cohort tasks with collected_at / all cohort tasks (including available/cancelled) |
| Delivery completion rate | Cohort tasks in DELIVERED state with delivered_at / all cohort tasks |
| Donation completion rate | COMPLETED cohort donations / all cohort donations, including active/unsuccessful |
| Cancellation / expiry rate | CANCELLED / EXPIRED cohort donations divided by all cohort donations |
| Donors / volunteers (admin) | Profiles with that role created in the period; all registered profiles for all time |
| NGOs / new NGOs (admin) | Organization profiles created in the period, not NGO user registrations |
| Participating donors | Distinct donors on donations created in the period |
| Receiving NGOs | Distinct accepted NGOs on COMPLETED donations completed in the period |
| Delivering volunteers | Distinct volunteer IDs on DELIVERED tasks delivered in the period |
| Personal volunteer activity | Own cohort tasks: claimed = volunteer_id assigned, active = ASSIGNED/COLLECTED, collected = collected_at present, deliveries = DELIVERED with timestamp |
| Pending NGO matches | Own SUGGESTED/VIEWED candidates on MATCHED donations created in the period, before collection deadline |

Each percentage shows its numerator, denominator and definition. A zero denominator displays N/A, not a fabricated zero success rate. Trend rows retain zero buckets and use actual creation/completion timestamps. Donor and NGO reports expose only their scoped donation counts; volunteer reports show task activity without assigning artificial food impact to volunteers.

## Limitations

`quantity` has no unit column, so summing it would mix unknown units. Meal portions are the project's estimated portions, not verified meals consumed, kilograms, recipients, financial savings or carbon savings. There is no recorded actual received-portion quantity, so completed donation estimates are used. The schema requires positive, non-null quantity/meal_portions; aggregation defensively coalesces missing portions to zero, but never substitutes quantity for portions.

Matches reflect retained/current records, not an immutable lifetime matching/acceptance event funnel. No assigned_at/accepted_at exists; claimed task counts use task creation cohorts and current volunteer associations. No cancellation/expiry timestamps exist; those rates are creation-cohort current-state outcomes rather than cancellation/expiry event timelines. Expiry counts use the persisted EXPIRED state, not an inferred deadline. Existing activity_logs remains the audit source; it is not joined to add duplicate outcome counts. No missing dates or historical events are invented.

Refresh reuses the existing notification/focus/manual dashboard mechanism. No broad analytics subscriptions are added. Requests have a 15-second timeout with a visible retry action.

## Validation

`npm test`, `npm run lint`, `npm run build`.
`node scripts/verify-phase12.mjs` uses ignored `.env` only on the server, creates isolated temporary Auth users/records, checks expected metrics, ownership, admin denial, dates, empty data and a full confirmation workflow, then cleans its records in finally. Run the existing Phase 10/11 live scripts for geographic/realtime/workflow/admin regression. These scripts target the configured development Supabase project and must never run in the browser.
