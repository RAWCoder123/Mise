# Purchase-unit operator quantities (2026-11-10)

## Summary

Inventory detail and Log Delivery showed on-hand in `item.unit` (for example lb)
but asked operators to type canonical g/ml/each. Entering `5` while reading
`24 lb on hand` wrote 5g — a silent undercount. Count sessions already convert
native `counted_quantity * canonical_quantity_per_unit` on approve; ad-hoc ops
now match that contract.

## Changes

- Domain: `services/domain/inventoryOperatorQuantity.ts`
- Application: `queueInventoryPurchaseUnitOperation` converts purchase units and
  stamps `purchase_unit_quantity` / `purchase_unit` / `canonical_quantity_per_unit`
- Validation: optional purchase-unit evidence metadata on `requireInventoryOperation`
- UI: Inventory detail + Log Delivery labels/hints use `item.unit`
- EN / ES / zh-Hans copy

## Out of scope

- Supplier-order Mark Received canonical posting (#392)
- Display-only conversion factor tip (#335)
- Receipt expiration dating (#1237)
- Usage/adjustment ledger paths

## Verification

- `npm run typecheck`
- Focused `tests/inventoryOperatorQuantity.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
