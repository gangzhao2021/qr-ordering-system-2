# P0 Core Flow Product Audit

Date: 2026-07-04

## Audit Scope

Combined UX and accessibility pass for the P0 dine-in loop:

- Customer mobile QR menu, cart, and table status
- Kitchen read-only pending board
- FOH live operations workspace

Evidence was captured from the current rewrite workspace running locally with
the web app on `http://127.0.0.1:3100` and API on `http://127.0.0.1:3101`.

## Captured Steps

1. `01-customer-mobile-menu.png` - Customer opens table 8 QR menu on a mobile viewport. Health: usable.
2. `02-customer-mobile-cart.png` - Customer adds Beef Noodle Soup and sees the sticky cart. Health: usable with crowding risk.
3. `03-customer-mobile-status.png` - Customer views open total, HST, service requests, and order status. Health: usable.
4. `04-kitchen-desktop-board.png` - Kitchen reads station-based pending dishes with no mutation controls. Health: usable after wait-time readability fix.
5. `05-foh-desktop-workspace.png` - FOH sees pending dishes, table totals, print queue, and payment state. Health: usable after checkout/reprint noise fix.

## Strengths

- Customer flow keeps table context visible and shows open total, tax, order status, and service request state.
- Kitchen screen respects the non-negotiable read-only boundary: no confirm, cancel, or checkout actions are present.
- FOH action queue puts the live mutable tasks in one place and keeps confirm/cancel controls with FOH.
- Canada market tax lines are visible in the customer status and FOH table cards.

## UX Risks

- Customer mobile cart is functional but dense; long item names plus modifiers can crowd the sticky cart.
- Kitchen old pending items previously showed wait times as very large minute counts, which made the board harder to scan.
- FOH empty tables previously showed a disabled checkout button, adding noise to a high-pressure surface.
- FOH print queue previously allowed reprint actions on pending/printing jobs, which could lead to duplicate tickets.

## Accessibility Risks

- Screenshot-only audit cannot prove keyboard order, screen reader output, or focus states.
- Customer sticky cart needs keyboard and zoom checks because it stays fixed near the bottom of the viewport.
- Kitchen urgency uses color plus text, which is good, but should still be checked against contrast in a browser audit.

## Changes Made From This Audit

- Kitchen wait labels now format long waits as hours and minutes instead of raw minute counts.
- FOH empty tables now show `No open check.` instead of a disabled checkout action.
- FOH blocked checkout buttons now explain `Finish pending dishes first`.
- FOH print queue now shows `Waiting` for pending/printing tickets and keeps `Reprint` for completed/failure follow-up.

## Remaining Recommendations

- Add a narrow mobile FOH check before pilot if staff will use phones, not only tablets/desktops.
- Add keyboard/focus verification for customer cart, FOH confirm/cancel, and Kitchen station filters.
- Consider pruning old demo pending items before customer demos so Kitchen urgency reflects current pilot state.
