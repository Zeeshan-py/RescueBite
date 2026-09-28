# RescueBite

Food Rescue & Surplus Redistribution Platform — Software Engineering Lab, Semester 5.

## Phase 1 scope

This repository contains the frontend foundation only: React, TypeScript, Vite,
Tailwind CSS, a responsive application shell, loading/error boundaries, ERD domain
types, and an environment-based Supabase client factory.

The overview explains the planned rescue journey. It contains no sample donation
records or fabricated statistics. Future navigation items are visibly disabled.
Authentication, database tables/RLS, CRUD, matching, maps, notifications, reports,
and AI have not been implemented. The core workflow will remain independent of AI.

## Install

Use Node.js 22.18.0 (recorded in `.nvmrc`) and npm. Compatible later Node 22
releases are allowed by `package.json`.

```sh
npm install
```

Commit `package-lock.json` with the source. On a fresh checkout, `npm ci` installs
the exact locked dependencies.

## Environment

The preview works with no environment variables. To prepare Supabase configuration,
copy the template in PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Then fill in these values from your Supabase project settings:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Use the project's public anon key. All `VITE_` variables are exposed to the browser:
never put a service-role key, database password, or private API key here.
Local environment files are ignored by Git. Restart Vite after changing them.

`src/lib/supabase.ts` validates configuration and exposes `getSupabaseClient()`.
It creates one shared client only when requested by a future service; the shell
does not initialize authentication, query the database, or claim to verify a
connection. Missing/invalid configuration is explained in the overview's
Development setup disclosure, and client access throws a useful error.

## Run

```sh
npm run dev
```

Open the address Vite prints, normally http://127.0.0.1:5173. The server binds to
loopback. The mobile menu, overview link, and rescue-journey anchor work; the
remaining navigation is reserved for future phases.

## Validate and build

```sh
npm run lint
npm run build
npm run preview
```

Build runs strict TypeScript checks before generating `dist/`. Preview serves the
production build locally, normally at http://127.0.0.1:4173.

## Phase 5 matching assumptions

The first matching engine is deterministic TypeScript logic using the documented weights: distance 30%, urgency 25%, food compatibility 20%, capacity 15%, and pickup availability 10%. Location records do not yet include coordinates, so exact normalized location text scores 100 and all other locations receive a neutral 50 rather than an invented physical distance. Eligible NGOs must accept the food category and have capacity for the donation's meal portions. Availability uses a documented score of 70 until volunteer scheduling exists. These two isolated scoring functions can be replaced when coordinates and schedules are added.

## Phase 6 NGO workflow

NGOs can review only matches associated with their organization, accept one atomically, or preserve a declined suggestion as history. The database locks the donation during a decision, expires competing suggestions after acceptance, restores `POSTED` when the final actionable suggestion is declined, and records NGO decisions in `activity_logs`. Pickup, delivery, notifications, and realtime behavior remain outside this phase.

## Phase 7 volunteer pickup workflow

Accepting an NGO match creates one `AVAILABLE` pickup task using the donation and NGO text locations. Volunteers can view shared available tasks, atomically claim one, and mark only their own assigned task `COLLECTED`. Claim and collection also move the donation to `PICKUP_ASSIGNED` and `COLLECTED`. Delivery, completion, maps, and realtime tracking remain outside this phase.

## Project structure

```text
Instruction/              Original requirements and prototype, preserved unchanged
src/
  components/
    common/               AppLayout, ErrorBoundary, LoadingState
    forms/                Reserved
    dashboard/            Reserved
    maps/                 Reserved
  pages/
    OverviewPage.tsx       Foundation overview, not a dashboard
    auth/ donor/ ngo/ volunteer/ admin/   Reserved role pages
  services/
    auth/ donations/ matching/ ngos/ volunteers/ notifications/ reports/
                          Reserved service boundaries; no stub APIs
  hooks/                  Reserved
  types/domain.ts         Seven ERD entity interfaces and status unions
  utils/                  Reserved
  lib/supabase.ts         Lazy shared Supabase client factory
  routes/                 Reserved until there are actual routes
  App.tsx                 Shell and lazy page loading
  main.tsx                React entry point and error boundary
  index.css               Tailwind import and shared visual tokens
```

Empty reserved directories contain `.gitkeep` so Git retains the requested
structure. There is one page, so a router, state library, forms library, map
library, and separate backend are unnecessary at this stage.

## Source documents and interpretation

Read before implementation:

- `Instruction/Food_Rescue_Problem_Statement.docx`
- `Instruction/Food_Rescue_SRS.docx`
- `Instruction/PRD.md`
- `Instruction/Architecture.md`
- `Instruction/APIDesign.md`
- `Instruction/ERD.md`
- `Instruction/TechStack.md`

The supplied HTML prototype informed the FoodBridge name, green palette, and
sidebar layout. Its simulated dashboards and actions are not incorporated.

The planned workflow remains: donor creates donation → smart matching → NGO
accepts → volunteer pickup → collection → delivery → NGO receipt confirmation →
completion → impact recorded.

Implementation decisions:

- The API document explicitly allows Supabase-generated APIs. Future service
  modules will organize those calls; its example localhost:3000 API does not
  require a custom backend in this foundation.
- Roles and entity fields follow the detailed ERD tables, including uppercase
  roles, despite lowercase roles in API examples. Types are application record
  shapes, not a generated or deployed database schema.
- UUIDs and timestamps are strings; numeric fields are numbers; accepted food
  types use the ERD's array option. Unassigned volunteers and pickup/collection/
  delivery times allow `null` for events that have not occurred. Other database
  nullability rules remain to be finalized with the schema.
- The ERD distinguishes `DELIVERED` from `COMPLETED` after NGO confirmation.
  The SRS wording around delivery confirmation needs reconciliation when status
  transitions are implemented; no transition logic is introduced here.
- API confirmation payload fields such as `received_meal_portions` and location
  coordinates needed for distance matching are not in the ERD. They are not
  invented in these interfaces and need design decisions in a later phase.

## Tooling references

Configuration follows the official [Vite guide](https://vite.dev/guide/),
[Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite),
and [Supabase client initialization](https://supabase.com/docs/reference/javascript/initializing).
