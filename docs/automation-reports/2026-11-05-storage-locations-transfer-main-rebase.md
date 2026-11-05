# Storage locations + ledgered inventory transfers (main rebase 2026-11-05)

Branch: `cursor/mise-storage-locations-transfer-main-rebase`
Supersedes conflicting tip: #215 (`cursor/mise-storage-locations-transfer`)
Base: `origin/main` @ `78da7376` (MISE-005A)

## Completed

- Rebased additive storage-station foundation onto current main after MISE-004C / MISE-005A.
- Forward-dated migration to `20261105010000_storage_locations_and_transfer.sql` (after `20260903120000` purchase-line ledger and open `20261104233000` ingredient-substitutions tip).
- Union-merged security allowlists with `purchase_lines` + storage tables.
- Union-merged activity event types with purchase-line ledger + `inventory_transfer_recorded`.
- Demo hydrate marks missing `storageLocations` / `inventoryLocationBalances` as migrated so v14 stores gain station seeds without inventing on-hand.

## Behavior (unchanged from #215)

- Managers create stations; staff transfer between stations without changing restaurant on-hand.
- Transfers append quantity-0 `inventory_events` (`event_type=transfer`) so projection cannot inflate inventory.
- Inventory detail transfer + add-station UI (EN/ES/zh-Hans).

## Unlocks

- #219 receive/waste station attribution
- #234 per-line put-away

## Verification

- `npm run typecheck`
- focused inventory transfer + security pins
- `npm test`
- `npm run security:static`
- `npm run security:backend`
