# Ask Mise waste ledger grounding (2026-08-31)

## Summary

Ask Mise waste answers now reason over authoritative `fetchWasteAnalysis` /
`WasteAnalysisSummary` evidence instead of inventing an all-clear from
overstock-style `insight_type === "waste"` heuristics.

## Behavior

- Waste intent answers require loaded waste analysis.
- Missing or failed waste analysis fails closed (`ask.answer.waste.unavailable`)
  and never claims waste is clear.
- `recommendedAction` maps to concrete operator next steps:
  - `start_logging` → no ledger records in window
  - `review_repeat_item` → named repeat items + review Waste
  - `complete_cost_setup` → unfinished verified cost/conversion
  - `keep_logging` → within baseline; keep logging
- Ask Mise screen loads waste analysis beside Today summary/insights with
  restaurant-switch and stale-request guards.
- Daily Report briefing passes the same analysis object when available.
- EN / ES / zh-Hans catalog coverage for answers, thinking steps, and suggestion.

## Paths

- `services/ai/askMise.ts`
- `app/ask-mise.tsx`
- `services/application/dailyReport.ts`
- `i18n/catalog.ts`
- `tests/askMise.test.ts`
- `docs/automation-reports/2026-08-31-ask-waste-analysis-grounding.md`

## Verification

- `npm run typecheck`
- `node --test --import tsx tests/askMise.test.ts`
- Targeted suite / full `npm test` as available

## Out of scope

- Does not merge or rebase open Ask Mise stacks (#149 readiness, #174 soft-refresh,
  #264 briefing i18n); expect ordinary rebase when those land.
- Does not change Waste hub recovery CTAs (#308) or waste reason categories (#301).
- Does not invent waste when the ledger is empty — empty is `start_logging`, not clear.
