# Rewrite Roadmap

## P0 - Operating Loop

- Customer QR menu and cart
- Customer language switch, item modifiers, item notes, image/allergen/spice display
- Order submission with table context
- Customer table order status, item status, tax lines, and service request visibility
- FOH table board, item confirmation, service requests, checkout, tips, discounts, and local refunds
- FOH checkout payment records and recent payment list across configured payment methods
- Kitchen read-only pending item board with station filtering
- Menu and table management
- Staff account management for roles, active access, and password resets
- Basic management analytics for revenue, payments, orders, and top items
- Prisma/PostgreSQL persistence for the P0 loop
- Staff login and role-gated FOH, kitchen, and management routes
- Durable print jobs with a demo printer-service poller
- Management print queue review and order reprints
- Store settings for Canada/China market presets, languages, receipt identity, tax rules, enabled payment methods, tips, service charge, and FOH totals
- Menu item stock, sold-out guard, and cancel restock behavior
- Table CRUD, QR token rotation, and printable table cards
- Lightweight operations management for suppliers, inventory adjustments, members, coupons, KDS devices, and audit logs

## P1 - Store Operations

- Purchase orders and supplier receiving tied to menu item stock
- Customer-facing member phone capture, coupon redemption, payment points, and operations summaries
- Applied stocktake workflow with linked inventory adjustments
- Recipe/BOM costing foundation with ingredient unit costs and menu item margin rollups
- Post-checkout customer feedback and member order/payment/coupon/feedback history

## P2 - Platform And Scale

- DEV multi-store onboarding
- KDS heartbeat, station authorization, and category routing enforcement
- Stripe/Interac/WeChat Pay/Alipay Hosted Checkout and reconciliation
- Marketing automation and richer customer segmentation
- Deeper analytics dashboards and operational reporting
- Advanced audit history and operational reporting

## Build Rule

Do not widen scope until the previous phase has a complete manual smoke path.
Use `docs/P0_EXIT_CRITERIA.md` as the P0 completion gate before starting P1 work.
