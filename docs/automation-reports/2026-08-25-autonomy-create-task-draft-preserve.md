# Autonomy + Create Task soft-refresh draft preserve (2026-08-25)

## Gap

Operators editing Autonomy spend/time/communication fields lost mid-edit drafts on every
focus reload because `load()` always reseeds `drafts` from the server. Soft-refresh
errors also cleared the path to prior rules without distinguishing hard vs soft loads.

Create Task retained title/body/checklist drafts across restaurant switches (tenant
draft leak) and did not invalidate hub readiness during soft refresh the way other
mutation hubs do.

## Fix

- `app/settings/autonomy.tsx`: `hasLoadedRef` soft vs hard load; soft success merges
  drafts by rule id; soft failure keeps prior rules + drafts; restaurant switch hard
  resets drafts.
- `app/more/create-task.tsx`: restaurant switch hard-resets create-form drafts; soft
  refresh invalidates readiness, preserves form drafts, and keeps prior lists on soft
  failure.
- Static pins in `tests/hubLoadState.test.ts` and `tests/clientTenantSafety.test.ts`.

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts`

## Do not redo

- Suppliers/team/order/inventory draft preserve PRs (#155–#159)
- Claiming Autonomy or Create Task are loop-ready beyond draft isolation
