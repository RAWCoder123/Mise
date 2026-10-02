# MISE-005EX operational_issues.explanation cntrl locale pin

## Summary

CHECK-only locale pin for durable operational-issue explanations:

- Reattach `operational_issues_explanation_check` — keep `length(trim(explanation)) between 1 and 2000`, add ASCII control rejection under COLLATE `"C"`:
  `explanation collate "C" !~ '[[:cntrl:]]'`
- Single-line issue explanation field (copied from `purchase_recommendations.reason` by the sync trigger / backfill); full C0 + DEL rejection (same class as operational_issues.title / activity_events.title / failure_reason). Writers do not intentionally preserve LF/TAB, so this tip does not use the multiline allowlist.
- No TypeScript domain writer for issue explanations (SQL trigger / service-role inserts only), so this tip is CHECK-only.

Does not rewrite the purchase_recommendations sync trigger, title (#561) / dedupe_key bounds, or sibling tips (#560/#559/#558/#557/#556/#509/#508/#507/#456).

## Verification

- `npm run typecheck` — passed
- focused `operationalIssuesExplanationCntrlLocalePin` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable in this environment)
