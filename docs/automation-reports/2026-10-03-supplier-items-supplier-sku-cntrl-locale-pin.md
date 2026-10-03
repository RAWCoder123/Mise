# MISE-005GM: supplier_items.supplier_sku cntrl locale pin

## Summary

Additive CHECK-only migration attaches `supplier_items_supplier_sku_check`
as null OR `length(trim(supplier_sku)) between 1 and 64` plus
`supplier_sku collate "C" !~ '[[:cntrl:]]'`.

The backbone column was nullable text with no length or cntrl gate.
`supplier_items_operational_values_check` only requires non-empty
supplier_name / item_name / unit. Open #218 barcode capture writers already
bound SKUs to `INVENTORY_BARCODE_SKU_MAX_CHARACTERS = 64` with bare
`[[:cntrl:]]` rejection; this tip locks that length bound under COLLATE "C"
so dump/restore cannot accept vendor SKU / barcode bytes a restored C-locale
path would refuse.

`supplier_sku` is classified as a single-line vendor catalog SKU / barcode
label (not free-form multiline prose).

## Scope

- CHECK-only; does not rewrite `capture_inventory_item_supplier_sku` (#218)
- Leaves `supplier_items_operational_values_check`, pack_quantity,
  canonical_unit (#491), verification_status, and supplier_id_required
  untouched
- Alone-OK versus feature PRs #218 / #334 (not locale pins)

## Verification

- `npm run typecheck` passed
- focused `supplierItemsSupplierSkuCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable in this environment)
