# Supplier delivery canonical receipt quantity (2026-09-04)

## Problem

Supplier-order receive lines carry **purchase-unit** quantities (same unit as
recommendations / `inventory_items.unit`) while labeling `canonicalUnit` as the
verified ledger unit (`g` / `ml` / `each`). Hosted `record_supplier_delivery`
passed those purchase-unit amounts straight into `record_inventory_event`.
Projection then divides by `canonical_quantity_per_unit`, so a **24 lb** receive
on a lbs→g item (~453.592) added only ~**0.05 lb** of on-hand.

Demo mode masked the bug by bumping native `current_quantity` directly and
skipping inventory ledger rows.

## Fix

- Domain helper `purchaseUnitsToCanonicalQuantity` documents and validates the
  purchase→canonical multiply.
- Additive migration replaces
  `record_supplier_delivery_mise_003b_name_base` so net received purchase units
  are multiplied by the **receive target** item’s verified
  `canonical_quantity_per_unit` before the ledger write. Delivery item rows stay
  purchase-unit evidence. Metadata records `purchaseUnitQuantity` and
  `canonicalQuantityPerUnit`.
- Demo receive writes converted `supplier_delivery` ledger receipts when units
  are verified; unverified demo fallback still bumps native on-hand only.

## Verification

- `npm run typecheck`
- focused `tests/supplierDeliveryCanonical.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## Out of scope

- Historical under-converted hosted receipts (no invented backfill)
- MOQ / lead_time / expiration
- Open stacks #147–#391 (waste floor, stockout metadata, usage/adjust UI, etc.)
