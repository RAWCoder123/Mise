# Today recalculation dispatch (2026-10-08)

## Problem

Scheduled open/mid/close recalculation cycles only ran when an operator opened
Home. Managers who live on Today during service never triggered due cycles, so
the Daily Operating Plan could render pre-recalculation state while Home alone
kept the ledger moving.

## Change

- `app/(tabs)/today.tsx`: call `runScheduledRecalculations` before plan/brief
  load; clear attention on restaurant switch; show the same recalculation
  StatusNotice as Home (reuses existing `home.recalculation.*` copy)
- Document Home + Today as session surfaces in `scheduledRecalculations.ts`
- Pin the contract in `tests/pilotUiSafety.test.ts`
- Update the forecast row in `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`

## Relationship to open #189

This supersedes stale open PR #189 (`Dispatch scheduled recalculations from
Today before plan load`) against current `main`. Close #189 when this lands.

## Intentionally not done

- Machine-runner / cron for unattended recalculation (still external/auth work)
- Close-cycle waste/variance differentiation (open #192)
- Recalculation run-history hub (open #349); Today still deep-links to Activity

## Verification

- `npm run typecheck`
- focused `tests/pilotUiSafety.test.ts`
- `npm test` when available

## Product note

Controlled pilot-ready codebase. Today now keeps the operating loop fresh for
managers who skip Home. Does not unblock live POS/Gmail or App Store submission.
