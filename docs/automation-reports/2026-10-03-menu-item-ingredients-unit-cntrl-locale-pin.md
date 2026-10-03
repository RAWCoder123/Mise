# MISE-005GJ: menu_item_ingredients.unit cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`menu_item_ingredients_unit_check` as
`length(trim(unit)) between 1 and 40` plus
`unit collate "C" !~ '[[:cntrl:]]'`.

`menu_item_ingredients.unit` was NOT NULL text with no table-level
length or control gate. Atomic setup and recipe upsert writers already enforce
`length(trim(unit)) between 1 and 40` before insert/update.
`menu_item_ingredients_quantity_used_per_sale_check` and
`menu_item_ingredients_menu_item_name_check` (#599) stay untouched,
so this tip stays alone-OK versus quantity bounds / menu_item_name and versus
inventory_items.unit (#586) / inventory_count_lines.unit (#593) /
purchase_recommendations.unit (#590) stacks.

Classification: single-line recipe ingredient unit-of-measure labels (not
multiline free-form prose).

## Scope

- CHECK-only; does not rewrite setup / recipe writers
- Does not reattach `menu_item_ingredients_quantity_used_per_sale_check`
- Does not reattach `menu_item_ingredients_menu_item_name_check`
- Leaves sibling unit stacks untouched

## Verification

- `npm run typecheck`
- focused `menuItemIngredientsUnitCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
