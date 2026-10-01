# Inventory detail soft-refresh draft preserve (2026-08-25)

## Verdict

Inventory item detail no longer wipes operator-entered par/reorder (or ops quantity/note) drafts on focus soft-refresh, and soft-refresh load failures fail closed without discarding prior outlook or local drafts.

## Why

`useFocusEffect` reloads the detail screen whenever it regains focus. The previous success path always reseeding `parLevel` / `reorderThreshold` from the server, and the failure path cleared `outlook` entirely. Mid-edit managers lost unsaved settings, and a transient network error erased the last known item evidence from state.

## Changes

- Soft vs hard load gated by `hasLoadedRef` + `loadedItemIdRef`
- Soft refresh invalidates `loadedRestaurantId` so mutations stay closed until proof returns
- Soft success updates outlook/queue but preserves local par, reorder, quantity, and note drafts
- Soft failure sets `hubLoadError` without clearing prior outlook/queue/drafts
- Restaurant or item identity change still hard-resets all drafts
- `RetryNotice` surfaces when the hub load fails

## Paths

- `app/inventory/[id].tsx`
- `tests/hubLoadState.test.ts`
- `tests/clientTenantSafety.test.ts`

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts`

## Do not redo

- Inventory count draft preserve (#155)
- Mutation draft restaurant-switch (#154)
- Sales-import restaurant-switch (#153)
- Hub fail-closed stacks (#150–#152)
- Pilot readiness UI (#145/#148/#149)
- Open pilot scopes #130–#135
