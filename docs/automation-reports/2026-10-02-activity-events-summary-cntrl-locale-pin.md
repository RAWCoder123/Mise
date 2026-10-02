# MISE-005EZ activity_events.summary cntrl locale pin

## Summary

CHECK-only locale pin for append-only activity feed summaries:

- Reattach `activity_events_summary_check` — keep `length(trim(summary)) between 1 and 1000`, add multiline-aware ASCII control rejection under COLLATE `"C"`:
  `summary collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`
- Allows LF/TAB/CR; rejects other C0 controls and DEL (same class as `supplier_orders.operator_note` / `unsafeSupplierSendMultilineControlPattern`).
- LF policy: most writers are single-line `format()`, but supplier-delivery memory updates copy `left(coalesce(correction, statement), 1000)` into summary. Operator `correction` is free-form and may contain LF, so full `[[:cntrl:]]` would break those updates. Multiline allowlist is required.
- No TypeScript domain writer change (avoids composing against activity_events.title tip #560 which owns `services/domain/activityEvents.ts`).

Does not rewrite activity RPCs, title (#560), restaurant_memories.correction/statement (#563), or operator_note (#551).

## Verification

- `npm run typecheck` — passed
- focused `activityEventsSummaryCntrlLocalePin` — 4/4
- `npm test` — 680 pass / 0 fail / 7 cancelled
- pgTAP plan **14** counted from 14 assertion call sites (Docker unavailable in this environment)
