# Today recalculation dispatch (2026-08-26)

## Problem

Scheduled recalculation cycles (`daily_open`, `mid_shift`, `close`) were only
dispatched when an authenticated session opened Home. Managers who live on
Today during service never triggered mid-shift or close recomputes, so the
operating plan, brief, and recommendations could stay anchored to the last Home
visit.

## Change

- `app/(tabs)/today.tsx` calls `runScheduledRecalculations` before loading the
  operating plan / brief / finding queue / floor notes.
- Surfaces dead-lettered or unreadable recalculation schedule attention with the
  same StatusNotice contract as Home (reuses `home.recalculation.*` copy).
- Clears recalculation attention on restaurant switch.
- Documents Home + Today as the session surfaces in
  `services/application/scheduledRecalculations.ts`.
- Updates `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md` forecast row.

## Out of scope

- Machine-runner / unattended cron (still required for restaurants nobody opens).
- Differentiating close reconciliation work from open/mid_shift recomputes.
- POS sync → planning activity `sequenceId` correlation.

## Verification

- `npm run typecheck`
- `npm test` (includes new pin in `tests/pilotUiSafety.test.ts`)
