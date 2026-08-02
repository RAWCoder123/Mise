# Waste station attribution (2026-08-02)

## Gap
Inventory waste reduced restaurant on-hand and reconciled station balances Main-first, so spoilage from Walk-in/Line silently drained Main. Receive already supported put-away stations; waste did not.

## Change
- Domain: `assertWasteStationAvailability`, `planWasteLocationDeduction`, waste metadata station fields.
- Migration `20260802160000_waste_station_attribution.sql`:
  - `private.apply_inventory_waste_station_deduction`
  - `service_record_inventory_waste_and_signals(..., p_storage_location_id default null)`
- Demo/hosted/Edge/application paths pass optional `storageLocationId`.
- Inventory detail waste card reuses location chips; history shows station name.
- i18n EN/ES/zh-Hans.
- pgTAP `waste_station_attribution.test.sql` + unit/security contract coverage.

## Behavior
1. Validate chosen station can cover applied waste quantity.
2. Reduce restaurant on-hand (trigger reconciles Main-first).
3. For non-Main targets, move the Main-first reduction back onto the chosen station.
4. Ledger metadata stores `storage_location_id` / `storage_location_name`.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` still pending in this environment

## Classification
Still **controlled pilot-ready** pending Docker/hosted re-proof and founder App Store/credentials steps.
