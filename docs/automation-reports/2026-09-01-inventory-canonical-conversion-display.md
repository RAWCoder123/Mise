# Inventory verified canonical conversion display (2026-09-01)

## Status
Shipped on `cursor/mise-product-inspection-348f`.

## Behavior
- When an inventory item is verified and carries a finite positive
  `canonical_quantity_per_unit`, inventory detail shows
  `Verified conversion: 1 {purchase unit} = {factor} {g|ml|each}`.
- Falls back to the prior unit-letter-only copy when verified but the factor is
  missing or invalid (never invents grams/ml/each).
- Complements open #187 verification form; does not add verification writes.

## Verification
- `tests/inventoryCanonicalConversionPresentation.test.ts`
- `npm run typecheck`
- Focused presentation tests + broader `npm test` as available

## Do not redo
Duplicate conversion display while this tip is open. Avoid overlapping #187
verification form or purchase-unit correction (#331) write paths.
