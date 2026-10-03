# MISE-005GG: menu_items.name cntrl locale pin

## Summary

Additive CHECK-only migration attaches `menu_items_name_check` as
`length(trim(name)) between 1 and 200` plus
`name collate "C" !~ '[[:cntrl:]]'`.

`menu_items.name` was NOT NULL text with no table-level length or control
gate. Square catalog sync writers persist
`left(trim(...external_name...), 160)`, a subset of the recipe-setup
`menu_item_name` writer bound (1..200) that can create `menu_items` via
`assign_recipe_menu_item_identity`. `menu_items_recipe_authority_check`
and `menu_items.category` (#596) stay untouched, so this tip stays alone-OK
versus recipe authority / category and versus inventory/pos_sales/purchase/
count-line stacks.

Classification: single-line menu/POS catalog item labels (not multiline
free-form prose).

## Scope

- CHECK-only; does not rewrite Square sync / POS catalog / recipe identity
  writers
- Does not reattach `menu_items_recipe_authority_check` or
  `menu_items_category_check`
- Leaves sibling item_name / category stacks untouched

## Verification

- `npm run typecheck`
- focused `menuItemsNameCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
