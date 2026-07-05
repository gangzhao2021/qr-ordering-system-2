# P1 Exit Criteria

P1 is the small-restaurant pilot gate for store operations beyond the core QR ordering loop. It assumes P0 already passes.

## Required Smoke Proof

Run against a migrated and seeded database with the API listening on `http://127.0.0.1:3001`.

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm db:deploy
pnpm db:seed
pnpm smoke:p1
pnpm smoke:p1-members
pnpm smoke:p1-inventory
pnpm smoke:p1-recipes
pnpm smoke:p1-feedback
pnpm smoke:p0
```

The smoke scripts write real local database records. That is expected.

## Functional Gates

- Purchasing: management can create purchase orders, receive lines, and produce linked stock movement.
- Inventory: management can apply stocktakes and see expected, counted, and difference quantities.
- Costing: management can maintain ingredients and recipes, then see menu item cost and margin estimates.
- Customers: customer orders can capture member phone and coupon code, checkout accrues points, and operations shows member history.
- Feedback: customers can submit feedback only after checkout, and management can mark feedback reviewed or resolved.
- Role boundaries: FOH cannot mutate management setup or feedback processing; kitchen remains read-only for live order state.
- P0 regression: customer ordering, FOH, kitchen, print queue, and checkout still pass `pnpm smoke:p0`.

## Manual Pilot Checks

- `/manage/p1-smoke` shows no `NEEDS_SETUP` checks.
- `/manage/operations` is usable through its grouped tabs:
  - Inventory & Costing
  - Customers
  - Devices & Audit
- `/manage/purchasing` can show current purchase orders and receiving state.
- `/manage/analytics` still loads after P1 smoke data has been written.

## Out Of P1

- Live payment gateway capture and reconciliation.
- Multi-store onboarding and fleet operations.
- KDS device heartbeat and enforced station authorization.
- Supplier invoice reconciliation, weighted average ingredient costing, and automatic ingredient stock deduction.
- Marketing automation and advanced segmentation.
