# Location balance sync on quantity writes (2026-07-31)

## Completed

- Fast-forwarded `cursor/mise-product-inspection-82f9` from tip `cursor/mise-product-inspection-47c1`.
- Added domain planner `planLocationBalanceReconcile` so Main absorbs increases and Main-then-others absorb decreases.
- Demo schema v8 seeds Main balances for every inventory item and reconciles on create/setup/count/waste/receive/POS/update.
- Hosted path: migration `20260731173000_sync_location_balances_on_quantity_writes.sql` adds `private.reconcile_inventory_location_balances_to_on_hand` plus an `inventory_items` trigger on `current_quantity` changes.
- Transfer service RPC now uses the shared reconcile helper before moving station stock.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- Domain/demo coverage in `tests/inventoryTransfer.test.ts` and `tests/demoWorkflows.test.ts`

## Remaining

- Docker + hosted `verify:private-beta-security` re-proof including this migration.
- Founder privacy/support HTTPS URLs, Apple/TestFlight, live POS/Gmail remain external blockers.
