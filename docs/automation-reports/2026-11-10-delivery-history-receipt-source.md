# Delivery history receipt source labels (2026-11-10)

## Defect

Log Delivery history merged every ledger receipt into identical quantity rows.
Operators could not tell an ad-hoc `operator_receipt` (Log Delivery / Inventory
detail receive) from an order-path `supplier_delivery` (Mark Received), which
makes double-count review and supplier attribution harder even when metadata
already carries `supplierName`.

## Fix

- Domain: `services/domain/deliveryHistorySource.ts` classifies receipt sources
  and soft-reads `metadata.supplierName`
- Merge: `DeliveryHistoryEntry` now carries `sourceKind` + `supplierName`
- UI: history cards show a source badge (EN / ES / zh-Hans) and optional supplier line
- Tests: classification + merge source preservation

## Alone-OK

Does not stamp `supplier_id` (#1241 / #1243), change receive quantities (#392),
add conflict guards (#267), or invent lot expiration (#1237). Soft-read only.

## Verification

- `npm run typecheck`
- Focused: `tests/deliveryHistorySource.test.ts` + `tests/deliveryHistory.test.ts` (7/7)
- Assertion call sites counted from source: **37**
- `npm run security:static`
- `npm run design:static`

Baseline: `origin/main` @ `78da7376`

## Classification

Controlled pilot-ready operator clarity tip. Not App Store submission-ready.
