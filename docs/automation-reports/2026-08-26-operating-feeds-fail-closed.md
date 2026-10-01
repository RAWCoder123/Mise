# Operating feeds fail-closed (2026-08-26)

## Problem

`fetchOperatingBrief` and `fetchDailyOperatingPlan` swallowed activity,
awaiting-decision Mise actions, and finding-decision loads with
`.catch(() => [])`. Partial repository failure could hide approval cards and
invent an empty “what changed” feed while Home/Today still looked healthy.
Related empty-array/null catches on Today floor notes, open count sessions,
and daily-report auxiliaries had the same false-healthy shape.

## Change

Propagate auxiliary feed failures so hub load errors surface RetryNotice
instead of a fabricated empty operational state.

## Paths

- `services/application/operatingBrief.ts`
- `services/application/operatingPlan.ts`
- `services/application/today.ts`
- `services/application/dailyReport.ts`
- `app/(tabs)/today.tsx`
- `app/(tabs)/inventory.tsx`
- `tests/operatingFeedsFailClosed.test.ts`

## Out of scope / do not redo

- Home/Activity `hubLoadState` soft-refresh gating (#176 / #180)
- Pilot readiness UI/RPC gates (#177–#181)
- Secondary-hub soft-refresh stacks (#172–#175)

## Verification

- `npm run typecheck`
- `npm test`
