# Rewrite Roadmap

## P0 - Operating Loop

- Customer QR menu and cart
- Order submission with table context
- Customer table order status, item status, and service request visibility
- FOH table board, item confirmation, service requests, checkout
- FOH checkout payment records and recent payment list
- Kitchen read-only pending item board
- Basic menu and table management
- Staff account management for roles, active access, and password resets
- Basic management analytics for revenue, payments, orders, and top items
- Prisma/PostgreSQL persistence for the P0 loop
- Staff login and role-gated FOH, kitchen, and management routes
- Durable print jobs with a demo printer-service poller
- Management print queue review and order reprints
- Store settings for receipt identity, tax, service charge, and FOH totals
- Menu item stock, sold-out guard, and cancel restock behavior
- Table CRUD, QR token rotation, and printable table cards

## P1 - Store Operations

- Suppliers, purchase orders, stocktake, and inventory adjustment history
- Members, coupons, points, customer profile

## P2 - Platform And Scale

- DEV multi-store onboarding
- KDS device tokens, heartbeat, category routing
- Stripe Hosted Checkout and reconciliation
- Deeper analytics dashboards and operational reporting
- Audit history and operational reporting

## Build Rule

Do not widen scope until the previous phase has a complete manual smoke path.
