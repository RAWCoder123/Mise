# MISE-005GF: menu_items.category cntrl locale pin

## Summary

Additive CHECK-only migration attaches `menu_items_category_check` as
`length(trim(category)) between 1 and 120` plus
`category collate "C" !~ '[[:cntrl:]]'`.

`menu_items.category` was nullable text with no table-level length or control
gate. Square catalog sync writers persist
`left(coalesce(catalog_item->>'category', 'Square'), 80)`, a subset of the
shared catalog category bound used by `inventory_items.category` and
`pos_sales.category`. NULL remains allowed via PostgreSQL CHECK null semantics.
`menu_items_recipe_authority_check` stays untouched, so this tip stays alone-OK
versus recipe authority and versus inventory/pos_sales/purchase/count-line
stacks.

Classification: single-line menu/POS catalog category labels (not multiline
free-form prose).

## Scope

- CHECK-only; does not rewrite Square sync / POS catalog writers
- Does not reattach `menu_items_recipe_authority_check`
- Leaves `inventory_items.category` (#595) and `pos_sales.category` (#594)
  untouched

## Verification

- `npm run typecheck`
- focused `menuItemsCategoryCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
