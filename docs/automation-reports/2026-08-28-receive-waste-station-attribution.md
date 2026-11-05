# Receive putaway + waste station attribution (rebased 2026-11-05)

Branch: `cursor/mise-receive-waste-station-attribution-main-rebase`
Depends on: #1100 (`cursor/mise-storage-locations-transfer-main-rebase`) — supersedes #215 base used by original #219.

## Closed
- Domain planners: `planReceiveLocationPutaway`, `planLocationBalanceReconcile`, waste station assert/deduction
- Migration `20261105020000_receive_putaway_waste_station_attribution.sql` (ordered after storage locations `20261105010000`)
  - Private putaway + waste station helpers
  - `record_supplier_delivery` wrapper applies optional per-line `storageLocationId` putaway
  - Operator waste/receipt station attribution via inventory_events triggers (append-only safe)
- Demo parity for receive putaway and waste station deduction
- Orders receive put-away chooser; inventory waste/receive station chooser; EN/ES/zh-Hans
- Tests: `tests/inventoryStationAttribution.test.ts`, pgTAP stub, security pin
- Preserves MISE-004C purchase-line activity allowlist assertions from #1100

## Behavior
1. Receive increases restaurant on-hand, then lands the increase on Main and moves it to the chosen station when non-Main.
2. Waste validates the chosen station, reconciles Main-first, then attributes spoilage to that station.
3. Empty balances stay lazy unless a non-Main station is chosen.
4. Supplier delivery putaway skips the receipt trigger path to avoid double-credit.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
