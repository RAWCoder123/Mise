# POS mappings soft-refresh draft preserve (2026-08-25)

## Problem

`/settings/pos-mappings` hard-loaded on every focus, wiped the review queue on
soft-refresh failure, and left verify/reject actionable without shared
restaurant-scoped hub readiness. Operator menu-item selections were lost when a
refocus or post-decision reload failed.

## Change

- Soft vs hard load via `hasLoadedRef`.
- Soft refresh invalidates readiness (`loadedRestaurantId = null`) so mutations
  stay closed until proof returns.
- Soft failure keeps prior queue + menu-item selection drafts; hard failure
  clears them.
- Restaurant switch hard-resets queue, selections, expansion, and notices.
- `visibleQueue` and `actionsEditable` gate display and mutations through
  `resolveRestaurantScopedHubLoadState` /
  `presentRestaurantScopedHubActionsEditable`.

## Paths

- `app/settings/pos-mappings.tsx`
- `tests/posMappingReviewWorkflow.test.ts`
- `tests/hubLoadState.test.ts`
- `tests/clientTenantSafety.test.ts`

## Verification

- `npm run typecheck`
- `node --test tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts tests/posMappingReviewWorkflow.test.ts`

## Notes

- Prefer this over #151’s pos-mappings wipe-on-error path for this screen.
- Does not change Square mapping RPC/auth authority.
