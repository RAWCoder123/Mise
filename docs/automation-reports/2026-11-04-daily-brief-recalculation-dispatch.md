# Daily Brief recalculation dispatch (2026-11-04)

## Problem

Scheduled open/mid/close recalculation cycles only ran when an operator opened
Home on `main` (Today tip #1091, Insights tip #1092, and Ask Mise tip #1093 are
open but not landed). Operators who open Daily Brief from More during service
never triggered due cycles, so phase findings composed from the operating plan,
operating brief, and daily ops report could reflect pre-recalculation state
while Home alone kept the ledger moving.

## Proof this surface reads planning state

- `app/more/daily-brief.tsx` loads `fetchDailyPhaseBriefs` on focus.
- `services/application/dailyPhaseBrief.ts` composes
  `fetchDailyOperatingPlan`, `fetchOperatingBrief`, and `fetchDailyOpsReport`
  (the report itself loads today summary and insights).
- Without dispatch, managers who skip Home/Today/Insights/Ask Mise and open
  Daily Brief read stale planning state.

## Change

- `app/more/daily-brief.tsx`: call `runScheduledRecalculations` before
  `fetchDailyPhaseBriefs`; clear attention on restaurant switch; show the same
  recalculation StatusNotice as Home (reuses existing `home.recalculation.*`
  copy) with Activity deep-link
- Document Home, Today, Insights, Ask Mise, and Daily Brief as session surfaces
  in `scheduledRecalculations.ts` (sibling hub dispatch remain open tips)
- Pin the contract in `tests/pilotUiSafety.test.ts`
- Update the forecast row in `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`

## Relationship to open tips

- Complements open #1091 (Today), #1092 (Insights), and #1093 (Ask Mise);
  Alone-OK — does not re-touch those hubs or Home
- Does not supersede #192 (close-cycle waste/variance), #717 (machine-runner),
  or #349/#716 (run-history hub)
- Landing order note: `scheduledRecalculations.ts` comment lists session
  surfaces; rebase with #1091/#1092/#1093 may need a one-line comment merge

## Intentionally not done

- Machine-runner / cron for unattended recalculation
- Close-cycle waste/variance differentiation (open #192)
- Dispatch from Daily Report (next Alone-OK session surface after inventing
  proof remains distinct: direct `fetchDailyOpsReport` without Daily Brief)
- Dispatch from non-planning hubs (Orders, Inventory, Settings)
- Recalculation run-history hub; Daily Brief still deep-links to Activity

## Verification

- `npm run typecheck`
- focused `tests/pilotUiSafety.test.ts`
- `npm run security:static` / `npm run security:backend`
- `npm test` when available

## Product note

Controlled pilot-ready codebase. Daily Brief now keeps the operating loop fresh
for operators who skip Home/Today/Insights/Ask Mise and open phase priorities
from More. Does not unblock live POS/Gmail or App Store submission.
