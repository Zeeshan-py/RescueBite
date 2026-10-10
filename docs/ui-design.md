# Workspace interface

RescueBite uses a shared operations layout for donors, NGOs, volunteers, and administrators. The visual system lives in `src/index.css`, with reusable icons, metric cards, record tables, and donation cards under `src/components`.

## Layout and hierarchy

- White navigation sidebar, neutral canvas, and emerald accents keep the primary action and current location visible.
- The workspace expands to 1680px instead of keeping reports in a narrow centered column.
- Four priority metrics introduce a dashboard; secondary counts sit in a compact strip. Existing zero-count dashboard behavior is preserved.
- Record tables show comparison fields first. Expand a row to see its complete administrative details.
- Donation and pickup cards prioritize food, quantities, status, location, and deadline. NGO match scores are labeled as scores out of 100, not probabilities.
- Small screens use a collapsible navigation menu, two-column metrics, stacked report panels, and single-column cards. Wide tables scroll within their own region.

## Analytics and data meaning

Analytics initially shows all available history. Users can apply presets or valid custom UTC dates, switch between donation activity and confirmed food impact, and export the trend records as CSV.

The line chart uses actual backend day, month, or year buckets. Created and completed series use their respective event dates. Volunteer charts use collection and delivery events. Missing activity displays an empty state; no sample values or growth percentages are invented.

The outcomes chart groups current donation statuses. Delivered food remains in progress until the NGO confirms completion. Workflow percentages retain their original denominators, which remain visible beside each indicator. Period-based impact totals and current statuses of records created during that period are distinct measurements.

## Accessibility and maintenance

- Charts provide textual totals, keyboard arrow navigation, and a detailed data table. The two activity series use solid and dashed strokes as well as different colors.
- Controls have visible focus states and accessible names. Mobile navigation closes with Escape and returns focus to its toggle.
- Row expansion uses `aria-expanded`; tables include column headers, captions, and focusable scroll regions.
- Existing reduced-motion support remains in place. SVG charts add no charting-library dependency.
- Preserve server authorization, role-specific queries, and database policies when changing presentation. Design components receive authorized data; they do not broaden access.

Validation includes chart data/accessibility tests, the existing application suite, lint, the production TypeScript/Vite build, and browser checks at desktop and mobile widths.
