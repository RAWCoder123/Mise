# Storage locations + ledgered inventory transfers (2026-08-27)

Branch: `cursor/mise-storage-locations-transfer`
Base: `origin/main` @ `20b28e5`

## Completed

- Additive migration `20260827220000_storage_locations_and_transfer.sql`:
  - `storage_locations` + `inventory_location_balances` (member SELECT, RPC writes)
  - reserved **Main** auto-ensure; manager+ `create_storage_location`
  - staff+ `transfer_inventory` moves station balances only
  - appends `inventory_events` with `event_type=transfer`, **quantity 0**
  - projection stamp treats transfer as on-hand no-op; trigger rejects non-zero transfer qty
  - activity type `inventory_transfer_recorded`
- Domain `services/domain/inventoryTransfer.ts` + demo helpers (schema v14 seeds Main/Walk-in/Line)
- Repository/application wiring; Inventory detail transfer + add-station UI (EN/ES/zh-Hans)
- Security pins in `security-backend` / `security-static`; unit + pgTAP stubs

## Verification

- `npm run typecheck`
- focused `tests/inventoryTransfer.test.ts` + security pin
- `npm test`
- `npm run security:static`
- `npm run security:backend`

## Notes

- Does not wholesale resume closed #26; rebuilt against current ledger authority.
- Receive putaway / waste station attribution remain later slices (avoid #196–#198 conflict).
- Does not overlap open #214 staff waste.
