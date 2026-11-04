# Insights recalculation dispatch (2026-11-04)

## Problem

Scheduled open/mid/close recalculation cycles only ran when an operator opened
Home (Today tip #1091 is open but not landed). Managers who live on Insights to
review the Daily Brief and learning signals never triggered due cycles, so
findings and briefs could render pre-recalculation state while Home alone kept
the ledger moving.

## Change

- `app/(tabs)/insights.tsx`: call `runScheduledRecalculations` before finding
  decision flush and brief/insights load; clear attention on restaurant switch;
  show the same recalculation StatusNotice as Home (reuses existing
  `home.recalculation.*` copy) with Activity deep-link
- Document Home, Today, and Insights as session surfaces in
  `scheduledRecalculations.ts` (Today dispatch remains open tip #1091)
- Pin the contract in `tests/pilotUiSafety.test.ts`
- Update the forecast row in `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`

## Relationship to open tips

- Complements open #1091 (Today recalculation dispatch); Alone-OK — do not
  re-touch Today or Home dispatch paths
- Does not supersede #192 (close-cycle waste/variance), #717 (machine-runner),
  or #349/#716 (run-history hub)

## Intentionally not done

- Machine-runner / cron for unattended recalculation
- Close-cycle waste/variance differentiation (open #192)
- Dispatch from non-planning hubs (Orders, Inventory, Settings)
- Recalculation run-history hub; Insights still deep-links to Activity

## Verification

- `npm run typecheck`
- focused `tests/pilotUiSafety.test.ts`
- `npm run security:static` / `npm run security:backend`
- `npm test` when available

## Product note

Controlled pilot-ready codebase. Insights now keeps the operating loop fresh
for managers who skip Home/Today. Does not unblock live POS/Gmail or App Store
submission.
