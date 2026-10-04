# MISE-005GT: supplier_items.supplier_name cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`supplier_items_supplier_name_check` as
`length(trim(supplier_name)) between 1 and 160` plus
`supplier_name collate "C" !~ '[[:cntrl:]]'`.

The backbone column is NOT NULL text with no dedicated length or cntrl gate.
`supplier_items_operational_values_check` only requires non-empty
supplier_name / item_name / unit. `inventory_items.supplier_name` on main
already gates length(trim) 1..160. This tip locks that length bound under
COLLATE "C" so dump/restore cannot accept vendor catalog supplier-name bytes
a restored C-locale path would refuse. The shared operational_values_check
is left intact.

`supplier_name` is classified as a single-line vendor catalog supplier label
(e.g. "Sysco Fresh"), not free-form multiline prose.

## Scope

- CHECK-only; does not rewrite supplier catalog UI or barcode writers
- Leaves operational_values_check, unit (#609), item_name (#608),
  supplier_sku (#603), pack_size (#605), pack_quantity, canonical_unit,
  verification_status untouched
- Alone-OK versus open #609 / #608 / #603 / #605 / #334 / #291 / #218
  (different columns or feature work)

## Verification

- `npm run typecheck` passed
- focused `supplierItemsSupplierNameCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 13 from 13 assertion call sites (Docker/pgTAP unavailable in this environment)
