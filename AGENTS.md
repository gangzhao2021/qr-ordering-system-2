# AGENTS.md - QR Ordering System 2

This is the clean rewrite workspace. Treat `D:\projects\qr-ordering-system` as reference only unless explicitly asked to migrate code.

## Product Boundary

Build a dine-in QR ordering system for small restaurants.

- Customer orders from a table-scoped QR menu.
- FOH is the only live-order operator.
- Kitchen/KDS is read-only for live order state.
- Management surfaces configure menu, tables, QR, printer routing, staff, and store settings.

## Preferred Stack

- Monorepo: pnpm workspaces
- Backend: Node.js + TypeScript + Express; Prisma/PostgreSQL is planned after P0 contracts settle
- Frontend: Next.js + TypeScript
- Shared contracts: `packages/shared`

## Priority

1. `SPEC.md` - product scope and role boundaries
2. `docs/ROADMAP.md` - delivery phases
3. `docs/ARCHITECTURE.md` - technical shape
4. `README.md` - setup and usage

## Quick Commands

- Install deps: `pnpm install`
- Start API + web: `pnpm dev`
- API health: `http://127.0.0.1:3001/health`
- Web app: `http://127.0.0.1:3000`
- Typecheck: `pnpm typecheck`

## Rewrite Discipline

Keep the new app simple until P0 is complete. Do not copy old modules wholesale. Port concepts, contracts, and proven behavior only after checking current product scope.
