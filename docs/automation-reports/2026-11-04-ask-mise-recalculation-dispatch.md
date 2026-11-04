# Ask Mise recalculation dispatch (2026-11-04)

## Problem

Scheduled open/mid/close recalculation cycles only ran when an operator opened
Home on `main` (Today tip #1091 and Insights tip #1092 are open but not landed).
Operators who stay in Ask Mise during service never triggered due cycles, so
deterministic answers grounded on today summary and insights could reflect
pre-recalculation state while Home alone kept the ledger moving.

## Change

- `app/ask-mise.tsx`: call `runScheduledRecalculations` before
  `fetchTodaySummary` / `fetchInsights`; clear attention on restaurant switch;
  show the same recalculation StatusNotice as Home (reuses existing
  `home.recalculation.*` copy) with Activity deep-link
- Document Home, Today, Insights, and Ask Mise as session surfaces in
  `scheduledRecalculations.ts` (Today/Insights dispatch remain open tips)
- Pin the contract in `tests/pilotUiSafety.test.ts`
- Update the forecast and Ask Mise rows in
  `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`

## Relationship to open tips

- Complements open #1091 (Today) and #1092 (Insights); Alone-OK — does not
  re-touch Home, Today, or Insights dispatch paths
- Does not supersede #192 (close-cycle waste/variance), #717 (machine-runner),
  or #349/#716 (run-history hub)

## Intentionally not done

- Machine-runner / cron for unattended recalculation
- Close-cycle waste/variance differentiation (open #192)
- Dispatch from Daily Brief / Daily Report (session surfaces still eligible
  after inventing proof they read planning state without the tipped hubs)
- Dispatch from non-planning hubs (Orders, Inventory, Settings)
- Recalculation run-history hub; Ask Mise still deep-links to Activity

## Verification

- `npm run typecheck`
- focused `tests/pilotUiSafety.test.ts`
- `npm run security:static` / `npm run security:backend`
- `npm test` when available

## Product note

Controlled pilot-ready codebase. Ask Mise now keeps the operating loop fresh
for operators who skip Home/Today/Insights and ask for priorities in chat.
Does not unblock live POS/Gmail or App Store submission.
