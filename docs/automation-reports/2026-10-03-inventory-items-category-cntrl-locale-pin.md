# MISE-005GE: inventory_items.category cntrl locale pin

## Summary

Additive CHECK-only migration attaches `inventory_items_category_check` as
`length(trim(category)) between 1 and 120` plus
`category collate "C" !~ '[[:cntrl:]]'`.

`inventory_items.category` was NOT NULL text with no table-level length or
control gate. `save_restaurant_setup` already trims and refuses length outside
1..120. The shared `inventory_items_operational_values_check` still covers only
item_name / unit / supplier_name / quantities, so this tip uses a dedicated
CHECK and stays alone-OK versus MISE-005FU/005FV/005FW.

Classification: single-line inventory catalog category labels (not multiline
free-form prose).

## Scope

- CHECK-only; does not rewrite setup/save inventory writers
- Does not reattach `inventory_items_operational_values_check`
- Leaves item_name / unit / supplier_name cntrl tips, pos_sales.category (#594),
  and menu_items.category untouched

## Verification

- `npm run typecheck`
- focused `inventoryItemsCategoryCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
