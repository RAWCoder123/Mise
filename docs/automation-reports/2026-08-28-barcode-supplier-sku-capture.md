# Barcode → supplier_sku match + manager capture

Date: 2026-08-28  
Branch: `cursor/mise-barcode-supplier-sku-capture`  
Base: `origin/main` @ `20b28e5`

## Problem

Scan-item matching ignored `supplier_items.supplier_sku`, so real case UPCs and
supplier codes never resolved to inventory. Managers also had no permissioned
way to capture an unmatched barcode onto the catalog (client DML on
`supplier_items` is revoked).

## Change

1. Domain matching ranks exact/normalized `supplier_sku` hits just below exact
   inventory id matches, resolving SKUs by `inventory_item_id` or
   supplier_id + name + unit identity.
2. `capture_inventory_item_supplier_sku` SECURITY DEFINER RPC (manager+) writes
   the trimmed SKU, binds `inventory_item_id`, conflicts with other items, audits
   `inventory_barcode_sku_captured`, and stays authenticated-EXECUTE only.
3. Demo + hosted repositories mirror the capture path; scan UI loads the barcode
   catalog, matches SKUs, and lets managers link an unmatched scan.

## Verification

- `npm run typecheck`
- `npm test` (targeted barcode suites + full suite)
- Static pins in `tests/inventoryBarcodeSkuCapture.test.ts`

## Out of scope

- Open stacks #130–#217
- Receive putaway / waste station attribution
- Overdue mute category
- Live camera E2E on device
