# Team + Log Delivery soft-refresh draft preserve (2026-08-25)

## Goal

Close the remaining hub soft-refresh gaps after suppliers/order/inventory draft-preserve work: Team invite drafts and Log Delivery quantity/note drafts must survive focus reloads, while soft-refresh failures stay fail-closed for display and mutations.

## Changes

### Team (`app/settings/team.tsx`)

- Soft vs hard load via `hasLoadedRef`.
- Soft refresh invalidates `loadedRestaurantId` so invites/role edits stay closed until proof returns.
- Soft success updates the member directory without touching invite email/role drafts.
- Soft failure sets `loadError` without clearing prior members or invite drafts.
- Restaurant switch still hard-resets invite drafts and member state.
- Load errors use `RetryNotice` with EN/ES/zh-Hans accessibility copy.

### Log Delivery (`app/more/log-delivery.tsx`)

- Soft vs hard load via `hasLoadedRef`.
- Soft refresh invalidates readiness while preserving quantity, note, search query, and selection drafts.
- Soft success refreshes inventory/history and rebinds selection to the latest same-id item when present.
- Soft failure keeps prior lists/drafts for retry while hub readiness fails closed.

### i18n

- Added `team.empty.retryAccessibility` in EN, ES, and zh-Hans.

### Tests

- `tests/hubLoadState.test.ts` contracts for Team and Log Delivery soft-refresh.
- `tests/clientTenantSafety.test.ts` pins `hasLoadedRef` + draft-preserve comments.

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts`

## Do not redo

- Suppliers (#158), order detail (#157), inventory detail (#156), count (#155), mutation drafts (#154), sales-import (#153), Home/secondary hubs (#150–#152), readiness (#145/#148/#149).
- Open #130–#135 first-loop / count freshness / planning stale / Gmail / receive / recipe unlink scopes.
