# QR Ordering System 2 Spec

## Product Goal

A dine-in QR ordering system for small restaurants. Guests order from a table-scoped menu. FOH operates live orders and checkout. Kitchen remains read-only.

## P0 Scope

### Customer

- Enter via `/c?t=<qrToken>` or manual table token entry.
- Browse store-branded menu by category.
- Search menu items.
- Switch customer menu language between English, Canadian French, and simplified Chinese when content is configured.
- Select item modifiers and send kitchen notes.
- Add available, in-stock items to cart.
- Submit dine-in order for the current table.
- View current table order status, item status, open total, tax lines, and service request status.
- Send service requests: water, call staff, follow up.
- Submit order feedback after checkout.
- Preserve table context while navigating customer flows.

### FOH

- View table cards with open totals, pending items, and service requests.
- Confirm physical dishes only after staff sees handoff.
- Cancel order items when needed, restoring tracked stock.
- Mark service requests handled.
- Record payment, tip, discount, checkout, and local refunds when no pending dishes remain.
- Attach member phone and coupon code at checkout when needed.
- Keep all live order mutations on FOH surfaces.

### Kitchen

- Read pending kitchen items aggregated by station and item.
- Show waiting time and urgency.
- Support token-scoped KDS device boards for configured stations.
- Update KDS device heartbeat without exposing live order mutation.
- Do not mutate live order state.

### Management

- Manage menu categories/items, localized content, images, allergens, spice level, modifier groups, kitchen station, tax category, availability, and item-level stock.
- Create, edit, deactivate, and rotate QR tokens for tables.
- Create, edit, deactivate, and reset passwords for staff accounts.
- Configure store identity, Canada/China market settings, languages, receipt footer, tax rules, invoice instructions, enabled payment methods, tips, and service charge.
- Provide QR entry links for customer preview.
- Review print jobs and trigger reprints.
- Manage suppliers, inventory adjustments, members, coupons, KDS device tokens, and audit history.
- Copy KDS device links, rotate device tokens, and review KDS heartbeat status.
- Review member payment summaries and coupon redemption counts.
- Apply stocktakes for tracked menu item inventory and review stocktake differences.
- Manage ingredients, recipe lines, menu item cost, and margin estimates.
- Review customer feedback and mark feedback reviewed or resolved.
- Review member order, payment, coupon, and feedback history.
- Review P1 pilot readiness across purchasing, inventory, costing, customers, and feedback.
- DEV creates stores, assigns first ADMIN, switches store context, and reviews P2 platform readiness.

### Printer Service

- Poll durable print jobs with printer credentials.
- Print demo ticket text and mark jobs printed or failed.

## Later Phases

- Live Stripe/Interac/WeChat Pay/Alipay capture and reconciliation.
- Marketing automation and richer customer segmentation.
- Supplier invoice reconciliation and advanced recipe costing.
- Deeper analytics and reporting.
- Fleet analytics and deeper multi-store operations.
- Advanced KDS category routing and station load balancing.

## Non-Negotiable Role Boundary

Kitchen/KDS hardware is read-only. FOH is the only operator that changes live order state.
ADMIN, FOH, KITCHEN, and PRINTER users are scoped to their assigned store. Only DEV can inspect another store context.
