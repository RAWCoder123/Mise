# MISE-005EY restaurant_memories.statement cntrl locale pin

## Summary

CHECK-only locale pin for durable restaurant-memory statements:

- Reattach `restaurant_memories_statement_check` — keep `length(trim(statement)) between 1 and 1000`, add ASCII control rejection under COLLATE `"C"`:
  `statement collate "C" !~ '[[:cntrl:]]'`
- Single-line learned-pattern prose minted by `format()` writers; full C0 + DEL rejection (same class as operational_issues.title / explanation / activity_events.title). Writers do not intentionally preserve LF/TAB, so this tip does not use the multiline allowlist.
- Operator free-form corrections remain on the separate `correction` column and are intentionally out of scope.
- No TypeScript domain writer for statements (SQL memory writers only), so this tip is CHECK-only.

Does not rewrite `update_restaurant_memory`, correction/source/dedupe_key bounds, memory vocabulary (#511), activity_events.summary/title (#560), or operational_issues.explanation (#562).

## Verification

- `npm run typecheck` — passed
- focused `restaurantMemoriesStatementCntrlLocalePin` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable in this environment)
