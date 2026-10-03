# MISE-005GO: supplier_items.pack_size cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`supplier_items_pack_size_check` as null OR
`length(trim(pack_size)) between 1 and 80` plus
`pack_size collate "C" !~ '[[:cntrl:]]'`.

The backbone column was nullable text with no length or cntrl gate.
`supplier_items_operational_values_check` only requires non-empty
supplier_name / item_name / unit. `purchase_lines.pack_size` on main already
gates null OR length(btrim) 1..80 plus bare `[[:cntrl:]]`. This tip locks that
length bound under COLLATE "C" so dump/restore cannot accept vendor catalog
pack-size label bytes a restored C-locale path would refuse.

`pack_size` is classified as a single-line vendor catalog pack-size label
(e.g. "10 lb case", "6/1 GAL"), not free-form multiline prose.

## Scope

- CHECK-only; does not rewrite purchase-line writers or supplier catalog UI
- Leaves operational_values_check, supplier_sku (#603), pack_quantity,
  canonical_unit, verification_status untouched
- Alone-OK versus open #603 / #334 / #291 (different columns or read-only /
  pack-quantity feature work)

## Verification

- `npm run typecheck` passed
- focused `supplierItemsPackSizeCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable in this environment)
