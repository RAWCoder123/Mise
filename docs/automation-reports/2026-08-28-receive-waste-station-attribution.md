# Receive putaway + waste station attribution (2026-08-28)

Branch: `cursor/mise-receive-waste-station-attribution` (bases on #215 storage locations)

## Closed
- Domain planners: `planReceiveLocationPutaway`, `planLocationBalanceReconcile`, waste station assert/deduction
- Migration `20260828010000_receive_putaway_waste_station_attribution.sql`
  - Private putaway + waste station helpers
  - `record_supplier_delivery` wrapper applies optional per-line `storageLocationId` putaway
  - Operator waste/receipt station attribution via inventory_events triggers (append-only safe)
- Demo parity for receive putaway and waste station deduction
- Orders receive put-away chooser; inventory waste/receive station chooser; EN/ES/zh-Hans
- Tests: `tests/inventoryStationAttribution.test.ts`, pgTAP stub, security pin

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
