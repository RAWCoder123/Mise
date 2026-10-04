# MISE-005GW: restaurant_autonomy_rules.supplier_name cntrl locale pin

## Summary

Additive CHECK-only migration attaches `restaurant_autonomy_rules_supplier_name_check`
as null OR `length(trim(supplier_name)) between 1 and 160` plus
`supplier_name collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. MISE-003C added
`supplier_id` and `restaurant_autonomy_rules_supplier_scope_check`
(`(supplier_name is null) = (supplier_id is null)`), but left `supplier_name`
length/cntrl ungated. This tip locks the same 1..160 bound used by
`inventory_items.supplier_name` and closes LC_CTYPE dump/restore drift for
autonomy-rule supplier-scope display labels (cntrl-only; does not expand to a
charset allowlist).

`supplier_name` is classified as a nullable single-line scoped supplier display
label, not operator free-form multiline prose.

## Scope

- CHECK-only; does not rewrite `upsert_restaurant_autonomy_rule` or durable
  supplier_id authority
- Leaves `restaurant_autonomy_rules_supplier_scope_check`, `execute_guard`,
  `operational_category`, `communication_type`, and `spend_limit` untouched
- Alone-OK versus open supplier_name sibling tips on other tables (#612/#611/#610)

## Verification

- `npm run typecheck` — passed
- focused `restaurantAutonomyRulesSupplierNameCntrlLocalePin` — 4/4 passed
- `npm test` — 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan **14** from 14 assertion call sites (Docker/pgTAP unavailable here)
