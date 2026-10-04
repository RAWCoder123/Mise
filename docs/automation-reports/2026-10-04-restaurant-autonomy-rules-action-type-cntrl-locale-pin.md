# MISE-005GY: restaurant_autonomy_rules.action_type cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`restaurant_autonomy_rules_action_type_check` as
`length(trim(action_type)) between 1 and 120` plus
`action_type collate "C" !~ '[[:cntrl:]]'`.

The foundation column is NOT NULL text with no dedicated length or cntrl gate.
Writers already normalize via `left(trim(...), 120)`. This tip locks that
bound under COLLATE "C" so dump/restore cannot accept autonomy-rule action-key
bytes a restored C-locale path would refuse. Column is NOT NULL; no null OR
branch.

`action_type` is classified as a single-line autonomy-rule action key
(e.g. `send_supplier_order`), not free-form multiline prose. It participates
in `scope_key`.

## Scope

- CHECK-only; does not rewrite `upsert_restaurant_autonomy_rule`
- Leaves `communication_type_check` (#614), `supplier_name_check` (#613),
  `supplier_scope_check`, `execute_guard` (which also mentions `action_type`),
  `operational_category`, and `spend_limit` untouched
- Alone-OK versus open #614 / #613 / #612 / #611 / #610

## Verification

- `npm run typecheck` — passed
- focused `restaurantAutonomyRulesActionTypeCntrlLocalePin` — 4/4 passed
- `npm test` — 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan **14** from 14 assertion call sites (Docker/pgTAP unavailable here)
