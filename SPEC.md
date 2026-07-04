# QR Ordering System 2 Spec

## Product Goal

A dine-in QR ordering system for small restaurants. Guests order from a table-scoped menu. FOH operates live orders and checkout. Kitchen remains read-only.

## P0 Scope

### Customer

- Enter via `/c?t=<qrToken>` or manual table token entry.
- Browse store-branded menu by category.
- Search menu items.
- Add available, in-stock items to cart.
- Submit dine-in order for the current table.
- View current table order status, item status, open total, and service request status.
- Send service requests: water, call staff, follow up.
- Preserve table context while navigating customer flows.

### FOH

- View table cards with open totals, pending items, and service requests.
- Confirm physical dishes only after staff sees handoff.
- Cancel order items when needed, restoring tracked stock.
- Mark service requests handled.
- Record payment and checkout a table when no pending dishes remain.
- Keep all live order mutations on FOH surfaces.

### Kitchen

- Read pending kitchen items aggregated by item.
- Show waiting time and urgency.
- Do not mutate live order state.

### Management

- Manage basic menu categories/items, availability, and item-level stock.
- Create, edit, deactivate, and rotate QR tokens for tables.
- Create, edit, deactivate, and reset passwords for staff accounts.
- Configure store identity, receipt footer, tax, and service charge.
- Provide QR entry links for customer preview.
- Review print jobs and trigger reprints.

### Printer Service

- Poll durable print jobs with printer credentials.
- Print demo ticket text and mark jobs printed or failed.

## Later Phases

- Stripe Hosted Checkout and refund reconciliation.
- Membership, coupons, points, and feedback.
- Suppliers, purchase orders, recipes, stocktake, and inventory adjustment audit.
- Analytics and reporting.
- DEV multi-store onboarding and fleet operations.
- KDS device-token binding and category routing.

## Non-Negotiable Role Boundary

Kitchen/KDS hardware is read-only. FOH is the only operator that changes live order state.
