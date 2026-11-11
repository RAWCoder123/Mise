# Surface inventory on-hand valuation on the Inventory hub (2026-11-11)

## Summary

Operators could see projected stock health on Inventory but not the currency value of on-hand stock. Mise already stores `estimated_unit_cost` per purchase unit and uses it for waste/spend/readiness, so this tip exposes a deterministic on-hand valuation without inventing costs.

## Changes

- Domain `buildInventoryOnHandValuation`: tenant-scoped sum of `current_quantity * estimated_unit_cost`, incomplete when unit cost is missing/non-positive
- Presentation helpers for complete / incomplete / missing-cost copy and appending valuation to the existing health risk body
- Inventory hub health card body + accessibility include the valuation line when the hub is ready
- EN / ES / zh-Hans catalog keys

## Out of scope

- Theoretical recipe food cost
- Purchase-line invoice nets (#1238)
- Changing recommendations, purchase authority, or ledger writes

## Verification

- `npm run typecheck`
- Focused `tests/inventoryValuation.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
