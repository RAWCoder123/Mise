# Security-static restaurant-owned table parity (2026-11-05)

## Problem

`scripts/security-backend.mjs` already treated ledger and recipe identity tables
(`purchase_lines`, `inventory_events`, count sessions/lines, POS/recipe mapping
tables, and peers) as restaurant-owned. `scripts/security-static.mjs` lagged
behind with a shorter `restaurantOwnedTables` set, so client repository
destructive-query scoping checks skipped those tables.

## Change

- Align `security-static.mjs` `restaurantOwnedTables` with the backend inventory.
- Fail closed in `tests/security.test.ts` when the two sets drift.

## Out of scope

- Landing open inventory/supplier stacks (#1100–#1121).
- Adding `purchase_decision_events` / `suppliers` (not yet in the backend owned set).
- Relativizing `purchase_lines_rls.test.sql` fixture dates.
- MOQ / lead time / shelf life / safety stock / expiration tips already open.

## Verification

- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- focused `tests/security.test.ts` + `tests/purchaseLineLedgerMigration.test.ts`
- `npm test`
