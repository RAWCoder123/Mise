# Recipes soft-refresh draft preserve (2026-08-25)

## Gap

Operators editing recipe ingredient quantities lost mid-edit drafts whenever
Recipes soft-refreshed: `RecipeRow` reseeds local drafts from `item` on every
summary update, and focus/`scheduleReload` always ran a hard `load()` that set
full-screen loading and wiped interaction state. Soft-refresh failures also did
not distinguish hard vs soft loads for prior baselines.

Builder fields (`newMenuItemName`, `newInventoryItemName`, `newQuantity`) lived
on the parent and survived soft success, but restaurant-switch isolation needed
an explicit hard reset alongside quantity drafts.

## Fix

- `app/settings/recipes.tsx`: lift quantity drafts to parent; `hasLoadedRef`
  soft vs hard load; soft success merges drafts by mapping id; soft failure
  keeps prior summary + drafts; restaurant switch hard-resets quantity and
  builder drafts; invalidate readiness during soft refresh.
- Static pins in `tests/hubLoadState.test.ts` and `tests/clientTenantSafety.test.ts`.

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts`

## Do not redo

- Suppliers/team/order/inventory/autonomy/create-task draft preserve PRs (#155–#160)
- Claiming Recipes mapping coverage or unlink workflows beyond draft isolation
