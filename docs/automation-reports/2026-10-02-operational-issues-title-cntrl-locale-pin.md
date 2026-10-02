# MISE-005EW operational_issues.title cntrl locale pin

## Summary

CHECK-only locale pin for durable operational-issue titles:

- Reattach `operational_issues_title_check` — keep `length(trim(title)) between 1 and 160`, add ASCII control rejection under COLLATE `"C"`:
  `title collate "C" !~ '[[:cntrl:]]'`
- Single-line issue title field; full C0 + DEL rejection (same class as activity_events.title / restaurant_tasks.title / restaurants.name).
- No TypeScript domain writer for issue titles (SQL trigger / service-role inserts only), so this tip is CHECK-only.

Does not rewrite the purchase_recommendations sync trigger, explanation/dedupe_key bounds, or sibling tips (#560/#559/#558/#557/#556/#509/#508/#507/#456).

## Verification

- `npm run typecheck` — passed
- focused `operationalIssuesTitleCntrlLocalePin` — 3/3
- `npm test` — 679 pass / 0 fail / 7 cancelled
- pgTAP plan **12** counted from 12 assertion call sites (Docker unavailable in this environment)
