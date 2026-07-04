# QR Ordering System 2

Clean rewrite of the dine-in QR ordering system.

The old repo at `D:\projects\qr-ordering-system` is the reference implementation. This repo starts fresh with a smaller P0 loop: customer QR ordering, FOH operations, kitchen read-only display, and basic management.

## Commands

```bash
pnpm install
copy apps\api\.env.example apps\api\.env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://127.0.0.1:3000
- API: http://127.0.0.1:3001/health
- Demo customer menu: http://127.0.0.1:3000/c?t=table-1-token
- Staff login: http://127.0.0.1:3000/login
- Demo printer once: `pnpm printer:once`
- Unit tests: `pnpm test`
- P0 smoke against a running API: `pnpm smoke:p0`

This repo includes `.npmrc` settings that use a hoisted/copy install strategy. That is slower than
pnpm's default linker, but it avoids Windows link stalls observed during the initial setup.

The API now uses Prisma + PostgreSQL. Set `DATABASE_URL` in `apps/api/.env` before running
database commands or starting the API.

`pnpm smoke:p0` expects the API to be running. It defaults to `http://127.0.0.1:3001`;
set `API_BASE_URL` to target another port. The smoke uses demo staff accounts, table 8,
and the unlimited-stock Jasmine Tea item so it can be repeated without draining tracked stock.

`pnpm test` runs package unit tests for shared contracts, API auth/session helpers, and web
request/component behavior. It does not start the database or browser.

Demo staff password: `devpass`

- `dev@local` - DEV
- `admin@local` - ADMIN
- `foh@local` - FOH
- `kitchen@local` - KITCHEN
- `printer@local` - PRINTER

## Workspace

```text
apps/api      Express API for P0 workflow
apps/web      Next.js app
apps/printer  demo printer-service poller
packages/shared  shared roles, DTOs, and demo contracts
docs          rewrite plan and architecture notes
```

## P0 Routes

- `/c` - customer entry and table-scoped ordering
- `/foh` - live FOH workspace
- `/kitchen` - read-only kitchen display
- `/manage` - management hub
- `/manage/settings` - store identity, market presets, languages, tax, payment methods, and service charge settings
- `/manage/menu` - menu category, localized item, modifier, price, availability, and stock management
- `/manage/tables` - table CRUD, QR token rotation, and printable table cards
- `/manage/staff` - staff accounts, roles, active access, and password resets
- `/manage/print-jobs` - kitchen ticket queue review and order reprints
- `/manage/analytics` - revenue, payments, orders, and top items
- `/manage/operations` - suppliers, inventory adjustments, members, coupons, KDS devices, and audit logs
- `apps/printer` - demo poller for `/v1/printer/jobs`

## Current Data Layer

The P0 workflow is backed by Prisma/PostgreSQL:

- `pnpm db:generate` creates the Prisma client.
- `pnpm db:migrate` applies the local schema.
- `pnpm db:seed` creates a Canada/Ontario demo store, eight tables, localized starter menu, suppliers, members, coupons, KDS devices, and starter operations history.
- `pnpm db:seed` also creates the demo staff users listed above. Seeded menu items include a mix of tracked stock and unlimited stock; a blank stock value means the item is not inventory limited.

Customer order submission creates a pending print job. The demo printer service logs in as
`printer@local`, claims pending jobs, prints ticket text to stdout, and marks jobs as printed.

FOH and customer order totals use store settings: subtotal is active order items, service charge
is calculated on subtotal, and tax is calculated on subtotal plus service charge. Customer table
status shows recent orders, item state, open total, and service request state for the current QR
token.

FOH checkout records a payment when closing a table. The default payment amount is the table's
open total, with support for cash, card, Interac, Stripe, WeChat Pay, Alipay, UnionPay, gift card,
or other payment method plus optional reference, tip, discount, and refund records. External
gateway capture/reconciliation is still a future integration; current payment flows are local
operating records.

Management analytics uses existing payments, orders, and order items to show a 7/14/31 day
operating readout: revenue, payment mix, order counts, daily revenue, and top items.

Staff management supports creating staff users, changing roles, deactivating access, and
resetting passwords. Role, active-state, and password changes invalidate existing sessions.
The API protects against removing the last active DEV/ADMIN manager for the store.

Management print jobs shows recent kitchen tickets, current delivery status, attempt counts,
ticket payload items, and order reprint actions.

Menu item stock is checked and decremented inside the order transaction. Sold-out items remain
visible on the customer menu but cannot be added to the cart. FOH canceling an order item
restores tracked stock.

Menu management supports category create/edit/delete-empty and item create/edit/delete-unused.
Menu items can carry English/French/Chinese names and descriptions, image URLs, allergens, spice
level, kitchen station, tax category, and customer-selectable modifier groups. Menu items with
order history should be marked unavailable instead of hard-deleted.

Table management supports creating and editing table numbers, names, active status, and QR
tokens. QR rotation issues a new token for a table. Printable table cards include a locally
generated SVG QR code for the full customer URL. Tables with order, service request, or print
history should be deactivated; hard delete is limited to unused tables.

Store settings include Canada and China presets, supported languages, invoice instructions,
tax-rule JSON, price-includes-tax behavior, enabled payment methods, and tip settings.

Operations management covers supplier contacts, stock adjustment history, member records, coupon
records, KDS device tokens, and audit history. It is intentionally lightweight; purchase orders,
recipe BOM costing, supplier receiving, customer-facing coupon redemption, and real payment
gateway reconciliation remain later-phase work.
