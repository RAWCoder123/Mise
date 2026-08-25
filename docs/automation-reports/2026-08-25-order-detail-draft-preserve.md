# Order detail soft-refresh draft preserve (2026-08-25)

## Verdict

Supplier order detail no longer wipes operator-entered note drafts on soft refresh, and soft-refresh load failures fail closed without discarding prior order evidence or the local note draft.

## Why

Order detail soft-reloads after receive and send-preview recovery via `load(false)`. The previous success path always reseeding `operatorNote` from the server, and the failure path cleared `order` entirely. Mid-edit managers lost unsaved supplier notes, and a transient network error erased the last known order evidence from state.

## Changes

- Soft vs hard load gated by `hasLoadedRef` + `loadedOrderIdRef`
- Soft refresh invalidates `loadedRestaurantId` so mutations stay closed until proof returns
- Soft success updates order/email/send evidence but preserves the local operator note draft
- Soft failure sets `hubLoadError` without clearing prior order/evidence/drafts
- Restaurant or order identity change still hard-resets the note draft
- `RetryNotice` surfaces when the hub load fails

## Paths

- `app/orders/[id].tsx`
- `tests/hubLoadState.test.ts`
- `tests/clientTenantSafety.test.ts`

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts`

## Do not redo

- Inventory detail draft preserve (#156)
- Inventory count draft preserve (#155)
- Mutation draft restaurant-switch (#154)
- Sales-import restaurant-switch (#153)
- Hub fail-closed stacks (#150–#152)
- Pilot readiness UI (#145/#148/#149)
- Open pilot scopes #130–#135
