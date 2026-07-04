# P0 Exit Criteria

P0 is the complete dine-in operating loop for one restaurant using seeded Prisma/PostgreSQL data.
It is not a launch checklist for payment gateways, multi-store fleet operations, or advanced
inventory accounting.

## Product Gate

P0 is done when all of these user journeys work against the current schema and seed data:

- A guest opens a table-scoped QR menu, browses categories, searches items, switches languages,
  selects modifiers, adds notes, and submits an in-stock dine-in order.
- The guest can return to the table view and see order state, item state, taxes, service charge,
  open total, and service request state for the same QR token.
- FOH can see table cards, confirm items, cancel items with tracked-stock restoration, handle
  service requests, take payment, record tips/discounts, close a table, reprint tickets, and record
  local refunds.
- Kitchen/KDS can read pending kitchen work by station and urgency, but cannot mutate live order
  state.
- Management can configure menu, tables, QR tokens, staff, store settings, print jobs, analytics,
  and lightweight operations records needed for a pilot.
- The printer poller can claim pending print jobs and mark ticket attempts as printed or failed.
- Role gates keep live order mutations on FOH surfaces; Kitchen remains read-only.

## Required Verification

Run these from the repository root unless noted otherwise.

```powershell
pnpm -C apps/api db:deploy
pnpm -C apps/api db:generate
pnpm -C apps/api db:seed
.\node_modules\.bin\prettier.CMD --check README.md SPEC.md "docs/**/*.md" "apps/**/*.{ts,tsx,css,json,mjs}" "packages/**/*.{ts,json}" "scripts/**/*.mjs"
pnpm typecheck
pnpm test
pnpm build
```

Then start the API and run the stateful P0 smoke against it:

```powershell
$env:PORT='3201'
$env:WEB_ORIGIN='http://127.0.0.1:3200'
pnpm -C apps/api dev
```

In another shell:

```powershell
$env:API_BASE_URL='http://127.0.0.1:3201'
pnpm smoke:p0
```

The smoke is stateful. It creates real local database records for an order and payment, uses table
8 and the unlimited-stock Jasmine Tea item, and verifies the Kitchen role can read but cannot
mutate live FOH order state.

For Web readiness, start Next.js against the same API and confirm these routes return HTTP 200:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:3201'
pnpm -C apps/web exec next dev -H 127.0.0.1 -p 3200
```

- `/`
- `/login`
- `/c?t=table-8-token`
- `/foh`
- `/kitchen`
- `/manage/p0-smoke`

## Manual Pilot Check

After automated checks pass, run one manual browser pass through the management P0 smoke cockpit at
`/manage/p0-smoke`. It should cover:

- Login using seeded staff accounts.
- Customer table 8 QR order submission.
- FOH item confirmation, service request handling, and checkout.
- Kitchen read-only review.
- Management print job review and reprint.
- Store settings, menu, table, staff, analytics, and operations spot checks.

## P0 Non-Goals

These remain later-phase work and must not block P0 closeout:

- Live Stripe, Interac, WeChat Pay, Alipay, UnionPay, or gift-card capture/reconciliation.
- Customer-facing member signup, coupon redemption, points, feedback, and customer profile.
- Purchase orders, supplier receiving, recipes/BOM costing, stocktake workflow, and deep inventory
  valuation.
- DEV multi-store onboarding and fleet administration.
- KDS heartbeat, station authorization, and enforced category routing.
- Deeper analytics, scheduled reports, and advanced audit reporting.

## Closeout Rule

P0 can be marked complete when the product gate is true, every required verification command passes,
the Web readiness routes return 200, and any remaining known work is explicitly classified under P1
or P2 in `docs/ROADMAP.md`.
