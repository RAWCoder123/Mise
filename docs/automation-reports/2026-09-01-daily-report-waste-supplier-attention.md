# Daily Report waste/supplier attention fail-closed (2026-09-01)

Tip: `cursor/mise-daily-report-waste-supplier-attention`
Base: `origin/main` @ `20b28e5`

## Problem

`buildDailyOpsReport` could emit manager advice `all-clear` when waste analysis
status was `attention` or supplier reliability had `attentionSupplierCount > 0`.
Those signals were attached to the report body but ignored by
`rankManagerActions`, so closeout advice could contradict the waste and
supplier sections on the same screen.

## Fix

- Pass `wasteAnalysis` and `supplierReliability` into `rankManagerActions`
- When waste status is `attention`, add a `/more/waste` action with the lead item
- When suppliers are `watch`/`at_risk`, add an `/orders` action (urgent if any
  `at_risk`)
- Keep `all-clear` only when stock, orders, waste, supplier, and task blockers
  are all clear
- Extend `DailyOpsManagerAction.route` with `/more/waste`

## Paths

- `services/domain/dailyOpsReport.ts`
- `tests/dailyOpsReport.test.ts`

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/dailyOpsReport.test.ts` (6/6)
- `npm test` (635 pass / 0 fail / 7 cancelled — pre-existing hang)

## Classification impact

Still controlled-pilot / private-beta. Improves operator trust on Daily Report
closeout advice; does not change hosted auth, POS, or App Store blockers.
