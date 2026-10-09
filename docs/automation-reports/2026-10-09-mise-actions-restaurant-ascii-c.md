# MISE-005LH: pin Mise-actions restaurant workspace to ASCII C

Date: 2026-10-09  
Base: `origin/main` @ `78da737`

## Finding

Unicode `restaurantId.trim()` on Mise-action domain and application entry points
invented a workspace identity from NBSP/em-space padding before:

- prepared-action construction;
- idempotency-key formation;
- outcome measurement;
- action list / decide / supplier-send lookup tenant-scope checks.

## Change

- Added `services/domain/miseActionsRestaurantIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed domain `createPreparedAction`, `miseActionIdempotencyKey`, and
  `measureOutcome` through the helpers while preserving
  `Mise actions require a restaurant id.` and
  `Outcomes require a restaurant id.`
- Routed application `fetchMiseActions`, `fetchSupplierSendAction`,
  `decideMiseAction`, and `approveSupplierSendContent` restaurant workspace
  through `requireCanonicalMiseActionsWorkspaceId` (preserves
  `Missing restaurant workspace.`).
- Preserved non-UUID demo workspace tokens; left sibling restaurant tips for
  separate PRs.

## Verification

- Focused: `tests/miseActionsRestaurantAsciiC.test.ts`
- Regression: `tests/miseActions.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static` / `npm run security:backend`

## Do not

- Re-tip this Mise-actions restaurant_id path after merge.
- Bundle sibling restaurant-workspace tips in the same PR.
- Add a UUID shape requirement on this restaurant_id path.
