# Restaurant-wide inventory movements browser (2026-08-31)

Tip: `cursor/mise-inventory-movements-browser`
Base: `origin/main` @ `20b28e5`

## Problem

Operators could not browse the restaurant-wide append-only inventory ledger.
`listInventoryEvents` powered waste, count evidence, deliveries, and pilot
readiness, but there was no More-hub UI with event-type filters. PR #285 covers
per-item history on inventory detail only.

## Fix

- `fetchRestaurantInventoryMovements` joins ledger rows with current item names,
  maps feed filters onto event types (`adjustment` → adjustment+correction),
  and reports truncation for the bounded newest-first window (80).
- Shared `inventoryLedgerPresentation` helpers for signed quantity / message keys
  (merge-friendly with #285).
- More → Inventory movements screen with scrollable event-type pills, fail-closed
  restaurant-switch clearing, retry, empty, truncation notice, and deep-link to
  inventory detail when the item still exists.
- EN / ES / zh-Hans copy including missing `inventory.ops.event.*` labels.

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/restaurantInventoryMovements.test.ts` (4/4)
- `npm run security:static`
- `npm test` (see commit notes)

## Out of scope

- Per-item history on inventory detail (#285)
- Repository `inventoryItemId` filter (#285)
- Purchase-unit correction / substitutions CRUD (Codex)
- Inventing MOQ / lead time / expiration columns
