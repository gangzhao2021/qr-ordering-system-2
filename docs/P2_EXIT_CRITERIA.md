# P2 Exit Criteria

P2 starts the platform layer for multiple restaurant stores. P2-A is complete when multi-store onboarding and store isolation are proven without weakening P0/P1.

## Required Smoke Proof

Run against a migrated and seeded database with the API listening on `http://127.0.0.1:3001`.

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm db:deploy
pnpm db:seed
pnpm smoke:p2-kds
pnpm smoke:p2-multistore
pnpm smoke:p1
pnpm smoke:p1-members
pnpm smoke:p1-inventory
pnpm smoke:p1-recipes
pnpm smoke:p1-feedback
pnpm smoke:p0
```

The P2 smoke creates a real local store, admin account, tables, and audit entry. That is expected.
The KDS smoke creates real local orders and KDS devices, and updates device heartbeat timestamps.

## Functional Gates

- DEV can create a store with a Canada/China market preset, first ADMIN, and opening QR tables.
- DEV can switch store context through the management platform page.
- ADMIN, FOH, KITCHEN, and PRINTER staff remain locked to their assigned store even if a cross-store header is sent.
- Store settings, FOH, kitchen, printer, management, and operations APIs resolve their current store from the authenticated staff session.
- KDS devices can read pending station work with only a valid active device token.
- KDS heartbeat updates `lastSeenAt`, and management can see online/offline status.
- KDS station assignments filter pending items to the device's station.
- Invalid, inactive, and rotated KDS tokens cannot read pending work.
- `/manage/p2-smoke` exposes platform readiness, store isolation, and regression checks.
- Existing P1 and P0 smoke paths still pass after P2 data is written.

## Manual Pilot Checks

- `/manage/platform` lists stores and shows current store context.
- Creating a new store does not copy demo menu, inventory, members, coupons, or orders.
- A DEV-selected store changes management API results.
- A non-DEV manager cannot switch into another store.
- `/kitchen/device?t=<token>` opens a read-only station board without staff login.
- `/manage/operations` can copy a device link, rotate a token, and show last seen status.

## Out Of P2-A

- Payment gateway onboarding and reconciliation.
- Multi-store analytics rollups.
- Marketing automation and segmentation.
- Store billing, subscription plans, and production tenant provisioning.
