# Architecture Notes

## Shape

- `apps/web` owns user-facing screens.
- `apps/api` owns HTTP contracts and server-side business rules.
- `packages/shared` owns shared roles, DTOs, and stable domain vocabulary.

## P0 Data Strategy

P0 uses Prisma + PostgreSQL for durable store, table, menu, order, order item, and service request data. Demo data is created with `pnpm db:seed` after migrations.

## Role Boundaries

- Customer can create orders and service requests for a valid table token.
- FOH can mutate live order item and service request state.
- Kitchen can read pending items only.
- Management can configure store resources.

Staff workspaces use a signed HTTP-only session cookie. FOH routes allow `FOH`, `ADMIN`, and `DEV`; kitchen routes allow `KITCHEN`, `ADMIN`, and `DEV`; management routes allow `ADMIN` and `DEV`. Printer-service routes allow `PRINTER`, `ADMIN`, and `DEV`.

## Staff Management

Management can create staff users, edit staff profile fields, assign staff roles, deactivate access, and reset passwords. Role, active-state, and password changes increment `User.sessionVersion`, which invalidates existing sessions for that account. The API prevents deactivating or downgrading the final active `DEV`/`ADMIN` manager in the store.

## Print Queue

Order submission writes a durable `PrintJob` in the same transaction as the order. FOH can inspect recent print jobs and create reprints. The demo printer service claims pending jobs through `/v1/printer/jobs`, prints the ticket payload to stdout, and marks each job printed.

Management exposes the same recent print queue through `/v1/manage/print-jobs` and can create reprint jobs through `/v1/manage/orders/:orderId/reprint`. This keeps troubleshooting available to managers without giving kitchen users mutation rights.

## Store Settings And Totals

The default store owns currency, locale, timezone, receipt identity, tax rate, and service charge rate. FOH totals and order ticket payloads share one calculation: subtotal from non-canceled order items, service charge on subtotal, then tax on subtotal plus service charge.

## Customer Order Visibility

The public `/v1/public/orders` endpoint is scoped by table QR token and returns recent orders, order item statuses, service request statuses, and open table totals. It uses the same server-side total calculation as FOH and order ticket payloads. Inactive tables return `TABLE_NOT_FOUND`, matching public menu behavior.

## Checkout And Payments

FOH checkout closes all submitted orders for a table only when no order items are pending. If the table total is greater than zero, checkout creates a `Payment` record with method, amount, currency, optional reference, and the closed order ids. Recent payments are visible in the FOH workspace.

## Management Analytics

Management analytics is computed from existing transactional data, not a separate warehouse. Revenue uses `Payment.paidAt`; order counts use `Order.submittedAt`; top items aggregate non-canceled `OrderItem` quantity and item sales. The report supports 7, 14, and 31 day windows.

## Menu Stock

Menu item stock is stored directly on `MenuItem`. A `null` stock quantity means unlimited or untracked stock; `0` means sold out. Public menus include available sold-out items so customers can see them, but the cart disables them. Order submission validates aggregated item quantity and conditionally decrements stock in the same transaction as order and print-job creation. FOH canceling a tracked order item restores stock; restoring a canceled item checks and decrements stock again.

## Menu Management

Management can create, rename, sort, and delete empty menu categories. Management can create and edit menu items, including category assignment, description, price, availability, stock settings, and sort order. Hard delete is limited to unused menu items because historical order items retain their menu item relation; items with order history should be marked unavailable instead.

## Table Management

Management can create tables, edit table number/name/status, rotate QR tokens, and print table cards. Public customer entry remains token-scoped through `DiningTable.qrToken`; inactive tables return `TABLE_NOT_FOUND`. Table cards render local SVG QR codes for the full customer URL in the web app, so printing does not depend on an external QR service. Hard delete is limited to unused tables because historical orders, service requests, and print jobs must remain attached to their table context.

## API Prefixes

- `/v1/public/*` - table-scoped public customer flows
- `/v1/foh/*` - FOH operator flows
- `/v1/kitchen/*` - read-only kitchen flows
- `/v1/manage/*` - management configuration flows
