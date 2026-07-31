# Storage locations and inventory transfer (2026-07-31)

## Completed

- Fast-forwarded `cursor/mise-product-inspection-47c1` from tip `cursor/mise-product-inspection-70cd`.
- Added restaurant-scoped `storage_locations` and `inventory_location_balances` with member SELECT + service/RPC mutations.
- Auto-ensures reserved **Main** location; managers can add named stations (Walk-in, Line, etc.).
- Staff+ can transfer quantity between locations via Edge `transfer_inventory` → service RPC.
- Transfers keep restaurant on-hand (`inventory_items.current_quantity`) unchanged and write `inventory_movements.reason = transfer`.
- Demo schema v7 seeds Main/Walk-in/Line; Inventory detail surfaces transfer + location create.

## Verification

- `npm run typecheck`
- `npm test` (237)
- `npm run security:backend`
- `npm run design:static`
- Domain coverage in `tests/inventoryTransfer.test.ts`; demo transfer + security contract tests.

## Remaining

- Docker + hosted `verify:private-beta-security` re-proof including this migration.
- Optional: keep location balances synced on waste/count/receive (currently reconciled at transfer time).
- Founder privacy/support HTTPS URLs, Apple/TestFlight, live POS/Gmail remain external blockers.
