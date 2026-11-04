# Daily Report recalculation dispatch (2026-11-04)

## Problem

Scheduled open/mid/close recalculation cycles only ran when an operator opened
Home on `main` (Today tip #1091, Insights tip #1092, Ask Mise tip #1093, and
Daily Brief tip #1094 are open but not landed). Operators who open Daily Report
from More during or after service never triggered due cycles, so the closeout
report composed from today summary and insights could reflect pre-recalculation
state while Home alone kept the ledger moving.

## Proof this surface reads planning state

- `app/more/daily-report.tsx` loads `fetchDailyOpsReport` on focus.
- `services/application/dailyReport.ts` loads `fetchTodaySummary` (inventory
  health, operational tasks, outlook-backed counts) and `fetchInsights`, plus
  sales trend, inventory outlooks, waste analysis, and supplier reliability.
- `regenerateOperationalSignals` replaces pending recommendations and insights
  that those loaders consume.
- Without dispatch, managers who skip Home/Today/Insights/Ask Mise/Daily Brief
  and open Daily Report read stale planning state. This path is distinct from
  Daily Brief: it calls `fetchDailyOpsReport` directly rather than composing
  phase briefs that happen to include the report.

## Change

- `app/more/daily-report.tsx`: call `runScheduledRecalculations` before
  `fetchDailyOpsReport`; clear attention on restaurant switch; show the same
  recalculation StatusNotice as Home (reuses existing `home.recalculation.*`
  copy) with Activity deep-link
- Document Home, Today, Insights, Ask Mise, Daily Brief, and Daily Report as
  session surfaces in `scheduledRecalculations.ts` (sibling hub dispatch remain
  open tips)
- Pin the contract in `tests/pilotUiSafety.test.ts`
- Update the forecast row in `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`

## Relationship to open tips

- Complements open #1091 (Today), #1092 (Insights), #1093 (Ask Mise), and
  #1094 (Daily Brief); Alone-OK — does not re-touch those hubs or Home
- Does not supersede #192 (close-cycle waste/variance), #717 (machine-runner),
  or #349/#716 (run-history hub)
- Landing order note: `scheduledRecalculations.ts` comment lists session
  surfaces; rebase with #1091/#1092/#1093/#1094 may need a one-line comment merge

## Intentionally not done

- Machine-runner / cron for unattended recalculation
- Close-cycle waste/variance differentiation (open #192)
- Dispatch from non-planning hubs (Orders, Inventory, Settings)
- Recalculation run-history hub; Daily Report still deep-links to Activity
- Further session surfaces without inventing proof they read planning state

## Verification

- `npm run typecheck`
- focused `tests/pilotUiSafety.test.ts`
- `npm run security:static` / `npm run security:backend`
- `npm test` when available

## Product note

Controlled pilot-ready codebase. Daily Report now keeps the operating loop fresh
for operators who skip Home/Today/Insights/Ask Mise/Daily Brief and open the
closeout report from More. Does not unblock live POS/Gmail or App Store
submission.
