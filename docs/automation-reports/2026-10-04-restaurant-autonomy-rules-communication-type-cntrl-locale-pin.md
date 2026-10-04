# MISE-005GX: restaurant_autonomy_rules.communication_type cntrl locale pin

## Summary

Additive CHECK-only migration attaches `restaurant_autonomy_rules_communication_type_check`
as null OR `length(trim(communication_type)) between 1 and 80` plus
`communication_type collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. Writers already
normalize via `nullif(left(trim(...), 80), '')` (foundation) /
`nullif(pg_catalog.left(pg_catalog.btrim(...), 80), '')` (MISE-003C). This tip
locks that 1..80 bound under COLLATE C and closes LC_CTYPE dump/restore drift
for autonomy-rule scoped channel labels (cntrl-only; does not expand to a
charset allowlist).

`communication_type` is classified as a nullable single-line scoped channel
label, not operator free-form multiline prose. It participates in
`restaurant_autonomy_rules_scope_key`, so control-character drift would also
break uniqueness continuity across restore.

## Scope

- CHECK-only; does not rewrite `upsert_restaurant_autonomy_rule` or durable
  supplier_id authority
- Leaves `restaurant_autonomy_rules_supplier_name_check` (#613),
  `supplier_scope_check`, `execute_guard`, `operational_category`, and
  `spend_limit` untouched
- Alone-OK versus open supplier_name tip on the same table (#613) and
  supplier_name sibling tips on other tables (#612/#611/#610)

## Verification

- `npm run typecheck` — passed
- focused `restaurantAutonomyRulesCommunicationTypeCntrlLocalePin` — 4/4 passed
- `npm test` — 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan **14** from 14 assertion call sites (Docker/pgTAP unavailable here)
