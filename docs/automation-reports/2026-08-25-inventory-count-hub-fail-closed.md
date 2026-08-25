# Inventory count hub fail-closed (2026-08-25)

## Gap

`app/inventory/count.tsx` already imported `resolveRestaurantScopedHubLoadState`, but:

1. `visibleDetail` still used `loadedRestaurantId === restaurant?.id`, so a soft-refresh load error left the prior count session lines on screen.
2. `loadError: Boolean(error)` treated mutation failures (save/submit/approve) as hub load failures, which disabled `actionsEditable` and blocked retries after a failed save.

## Fix

- Split `hubLoadError` from mutation `error`.
- Gate `visibleDetail` with `hubReady ? detail : null`.
- Clear session drafts on load failure; show RetryNotice only for hub load errors.
- Keep mutation errors as StatusNotice without locking the hub.
- Gate start/approve/cancel through hub-ready action helpers.

## Pins

- `tests/clientTenantSafety.test.ts` — count screen in shared hub consumer set
- `tests/hubLoadState.test.ts` — count path in consumer file list

## Verification

- `npm run typecheck`
- `npx tsx --test tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts`
