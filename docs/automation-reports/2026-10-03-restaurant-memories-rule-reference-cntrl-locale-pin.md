# MISE-005GQ: restaurant_memories.rule_reference cntrl locale pin

## Summary

Additive CHECK-only migration attaches `restaurant_memories_rule_reference_check`
as null OR `length(trim(rule_reference)) between 1 and 240` plus
`rule_reference collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. This tip locks the same
240 bound used by sibling restaurant-memory / action-ledger ID/ref columns
(`dedupe_key`, `idempotency_key`, `trigger_reference`, `rollback_reference`) and
closes LC_CTYPE dump/restore drift for memory-to-rule correlation text
(cntrl-only; does not expand to a charset allowlist).

`rule_reference` is classified as a single-line system reference label, not
operator free-form multiline prose.

## Scope

- CHECK-only; does not rewrite memory or autonomy-rule writers
- Leaves source (#566), statement (#563), correction (#565), dedupe_key (#570),
  and memory vocabulary (#511) untouched
- Alone-OK versus open restaurant_memories sibling tips on other columns

## Verification

- `npm run typecheck` — passed
- focused `restaurantMemoriesRuleReferenceCntrlLocalePin` — 4/4 passed
- `npm test` — 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan **14** from 14 assertion call sites (Docker/pgTAP unavailable here)
