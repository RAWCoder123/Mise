# MISE-005GI: menu_item_ingredients.menu_item_name cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`menu_item_ingredients_menu_item_name_check` as
`length(trim(menu_item_name)) between 1 and 200` plus
`menu_item_name collate "C" !~ '[[:cntrl:]]'`.

`menu_item_ingredients.menu_item_name` was NOT NULL text with no table-level
length or control gate. Atomic setup and recipe upsert writers already enforce
`length(trim(menu_item_name)) between 1 and 200` before insert/update.
`menu_item_ingredients_quantity_used_per_sale_check` and `unit` stay untouched,
so this tip stays alone-OK versus quantity bounds / unit and versus
menu_items.name (#597) / inventory/pos_sales/purchase/count-line /
pos_catalog_item_mappings.external_name (#598) stacks.

Classification: single-line recipe / menu item labels (not multiline free-form
prose).

## Scope

- CHECK-only; does not rewrite setup / recipe / POS identity writers
- Does not reattach `menu_item_ingredients_quantity_used_per_sale_check`
- Leaves `unit` and sibling item_name stacks untouched

## Verification

- `npm run typecheck`
- focused `menuItemIngredientsMenuItemNameCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
