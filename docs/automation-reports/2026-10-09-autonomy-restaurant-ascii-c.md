# MISE-005LK: pin autonomy restaurant workspace to ASCII C

Date: 2026-10-09  
Base: `origin/main` @ `78da737`

## Finding

Unicode `restaurantId.trim()` on autonomy application list, save, and safe-default
entry points invented a workspace identity from NBSP/em-space padding before
repository autonomy reads/writes and restaurant-scope validation.

## Change

- Added `services/domain/autonomyRestaurantIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed application `fetchAutonomyRules`, `saveAutonomyRule`, and
  `createSafeDefaultAutonomyRules` restaurant workspace through
  `requireCanonicalAutonomyWorkspaceId` (preserves
  `Missing restaurant workspace.`).
- Preserved non-UUID demo workspace tokens; left sibling restaurant tips and
  supplier-scoped autonomy field trims for separate PRs.

## Verification

- Focused: `tests/autonomyRestaurantAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static` / `npm run security:backend`

## Do not

- Re-tip this autonomy restaurant_id path after merge.
- Bundle sibling restaurant-workspace tips in the same PR.
- Add a UUID shape requirement on this restaurant_id path.
