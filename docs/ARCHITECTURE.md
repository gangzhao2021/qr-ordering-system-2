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

Staff API routes resolve the active store from the authenticated session. The optional `x-store-id` request header is honored only for `DEV`, which allows platform inspection and store switching without giving ADMIN, FOH, KITCHEN, or PRINTER users cross-store access.

## Platform Store Scope

P2-A adds a small platform layer on top of the existing `Store` model. DEV can create stores through `/v1/manage/platform/stores`; the API applies a Canada/China market preset, creates opening QR tables, creates the first ADMIN account, and records an audit entry. New stores intentionally start without copied demo menu, order, inventory, member, coupon, or feedback data.

The management platform page stores the selected DEV store in local browser storage and sends it as `x-store-id` on API calls. Non-DEV users ignore that header and continue to use `User.storeId` from the session. `/manage/p2-smoke` and `pnpm smoke:p2-multistore` prove this boundary before later payment, KDS authorization, or marketing work.

## Staff Management

Management can create staff users, edit staff profile fields, assign staff roles, deactivate access, and reset passwords. Role, active-state, and password changes increment `User.sessionVersion`, which invalidates existing sessions for that account. The API prevents deactivating or downgrading the final active `DEV`/`ADMIN` manager in the store.

## Print Queue

Order submission writes a durable `PrintJob` in the same transaction as the order. FOH can inspect recent print jobs and create reprints. The demo printer service claims pending jobs through `/v1/printer/jobs`, prints the ticket payload to stdout, and marks each job printed.

Management exposes the same recent print queue through `/v1/manage/print-jobs` and can create reprint jobs through `/v1/manage/orders/:orderId/reprint`. This keeps troubleshooting available to managers without giving kitchen users mutation rights.

## Store Settings And Totals

The default store owns market, region, currency, locale, timezone, supported languages, receipt identity, tax rules, invoice instructions, enabled payment methods, tip behavior, and service charge rate. FOH totals and order ticket payloads share one calculation: subtotal from non-canceled order items, service charge on subtotal, then tax from configured rules. Canada-style multiple tax rules and China-style price-includes-tax behavior are represented in store settings; legal filing and gateway reconciliation remain outside P0.

## Customer Order Visibility

The public `/v1/public/orders` endpoint is scoped by table QR token and returns recent orders, order item statuses, service request statuses, and open table totals. It uses the same server-side total calculation as FOH and order ticket payloads. Inactive tables return `TABLE_NOT_FOUND`, matching public menu behavior.

## Checkout And Payments

FOH checkout closes all submitted orders for a table only when no order items are pending. If the table total is greater than zero, checkout creates a `Payment` record with method, amount, currency, optional reference, tip, manual discount, coupon discount, member snapshot, points earned, and the closed order ids. Recent payments are visible in the FOH workspace. Refunds update local payment status and write audit records; live third-party payment capture is intentionally not coupled to P0.

## Management Analytics

Management analytics is computed from existing transactional data, not a separate warehouse. Revenue uses `Payment.paidAt`; order counts use `Order.submittedAt`; top items aggregate non-canceled `OrderItem` quantity and item sales. The report supports 7, 14, and 31 day windows.

P2 reporting expands the same store-scoped read model instead of adding a new reporting database. `/v1/manage/analytics` aggregates payments, refunds, discounts, order totals, taxes, service charges, menu categories, kitchen stations, member payments, coupon redemptions, feedback ratings, menu item stock risk, recipe margin, and audit action counts for the current store. DEV may inspect another store with `x-store-id`; non-DEV users stay on their session store.

`/v1/manage/audit-logs` exposes filterable audit history for the current store with range, action, entity type, actor, and limit filters. Audit records are intentionally lightweight: action, entity type/id, optional actor email, metadata JSON, and timestamp. The dedicated `/manage/audit` page uses those filters while `/manage/operations` keeps a short recent-audit preview.

## Menu Stock

Menu item stock is stored directly on `MenuItem`. A `null` stock quantity means unlimited or untracked stock; `0` means sold out. Public menus include available sold-out items so customers can see them, but the cart disables them. Order submission validates aggregated item quantity and conditionally decrements stock in the same transaction as order and print-job creation. FOH canceling a tracked order item restores stock; restoring a canceled item checks and decrements stock again.

## Menu Management

Management can create, rename, sort, and delete empty menu categories. Management can create and edit menu items, including category assignment, localized names/descriptions, image URL, allergens, spice level, tax category, kitchen station, modifier groups, description, price, availability, stock settings, and sort order. Hard delete is limited to unused menu items because historical order items retain their menu item relation; items with order history should be marked unavailable instead.

Customer order items snapshot the selected modifier names, modifier price deltas, and item note. The order transaction validates selected modifiers against the current menu item definition and includes modifier deltas in totals and print ticket payloads.

## Store Operations

Management operations are lightweight transactional records in the API database: suppliers, inventory adjustments, stocktakes, ingredients, recipes, members, coupons, customer feedback, KDS device tokens, and audit logs. Inventory adjustments update tracked `MenuItem.stockQuantity` and keep a recent adjustment history.

P1 purchasing adds `PurchaseOrder` and `PurchaseOrderLine` records. Management can create an ordered purchase order against an active supplier, then receive each line partially or fully. Receiving increments `MenuItem.stockQuantity`, creates linked `InventoryAdjustment` rows, and moves the purchase order to `PARTIALLY_RECEIVED` or `RECEIVED`. Unit cost is stored for receiving context only; supplier invoice reconciliation remains later-phase work.

P1 member/coupon checkout lets customer orders include an optional name, phone, and coupon code. The API upserts a member from phone, snapshots coupon discount on the order, and includes coupon discounts in public/FOH table totals and print ticket totals. FOH can also attach a member phone or coupon at checkout. Successful paid checkout increments member points, writes a `MemberPointLedger` row, and records `CouponRedemption` rows for operations reporting. Coupon rules intentionally stay simple: active window, minimum subtotal, fixed amount or percentage discount, and one redemption per member.

P1 feedback lets customers submit one feedback record per closed order from the table-scoped public flow. Feedback stores rating, comment, tags, order/table/member links, and a simple `NEW` -> `REVIEWED` -> `RESOLVED` management status. It is not a live-order mutation, so FOH remains the only live order operator while management handles feedback triage. Operations also enriches each member record with recent order, payment, coupon, and feedback history for lightweight customer profile review.

P1 stocktake adds applied stock counts for tracked menu items. Management can submit a stocktake with one or more counted lines; the API snapshots expected quantity, stores counted quantity and difference on `StocktakeLine`, updates `MenuItem.stockQuantity` to the counted value, and creates linked `InventoryAdjustment` rows for non-zero differences. This is intentionally an apply-now workflow; draft counts and ingredient stock deduction remain later work.

P1 recipe costing adds `Ingredient`, `Recipe`, and `RecipeLine` records. Management can maintain ingredient stock quantity, unit, unit cost, low-stock threshold, and active state, then assign one recipe to a menu item. Recipe cost is computed from line quantity times current ingredient unit cost, divided by yield quantity, and the API reports cost, margin cents, and margin basis points for operations review. This foundation does not attempt complex unit conversion, supplier invoice averaging, or automatic ingredient-level stock consumption yet.

The P1 smoke cockpit aggregates store-operations readiness from existing transactional tables rather than storing separate state. It reports supplier, purchase order, stocktake, ingredient, recipe, member, coupon, and feedback coverage, and links managers to the same operational surfaces used during smoke verification.

The P2 smoke cockpit aggregates platform readiness from existing store, user, table, menu, KDS, payment, inventory, and audit rows. It reports store count, active manager coverage, table bootstrap coverage, menu setup coverage, KDS readiness, reporting/audit readiness, and regression commands.

KDS device records provide token and station inventory for device setup. Staff-session `/kitchen` remains a read-only operations board for managers and kitchen staff. Token-scoped `/v1/kds/*` endpoints let a configured device read only its station's pending items and send heartbeat updates without a staff session. Invalid, inactive, or rotated device tokens cannot read pending work. Management operations can copy device links, rotate tokens, and review `lastSeenAt` as an online/offline signal.

The P2 smoke cockpit includes KDS active device count, online heartbeat count, station assignment coverage, reporting payment count, reporting revenue, audit entry count, and low-stock risk count. `pnpm smoke:p2-kds` proves token auth, station filtering, heartbeat, inactive-token rejection, and token rotation. `pnpm smoke:p2-reporting` proves operating reports, audit filters, inventory risk, and reporting store isolation.

## Table Management

Management can create tables, edit table number/name/status, rotate QR tokens, and print table cards. Public customer entry remains token-scoped through `DiningTable.qrToken`; inactive tables return `TABLE_NOT_FOUND`. Table cards render local SVG QR codes for the full customer URL in the web app, so printing does not depend on an external QR service. Hard delete is limited to unused tables because historical orders, service requests, and print jobs must remain attached to their table context.

## API Prefixes

- `/v1/public/*` - table-scoped public customer flows
- `/v1/foh/*` - FOH operator flows
- `/v1/kitchen/*` - read-only kitchen flows
- `/v1/manage/*` - management configuration flows
