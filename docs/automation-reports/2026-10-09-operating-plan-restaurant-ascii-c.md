# MISE-005LF operating-plan restaurant workspace ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-operating-plan-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Finding

`buildDailyOperatingPlan` and `fetchDailyOperatingPlan` used Unicode
`restaurantId.trim()` before tenant-scope filtering and repository reads. NBSP
or em-space padding invents the unpadded workspace identity on the Daily
Operating Plan / Today path.

## Change

- Added `services/domain/operatingPlanRestaurantIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed domain `buildDailyOperatingPlan` through
  `requireCanonicalOperatingPlanRestaurantId` (preserves
  `A restaurant is required to build an operating plan.`).
- Routed application `fetchDailyOperatingPlan` through
  `requireCanonicalOperatingPlanWorkspaceId` (preserves
  `Missing restaurant workspace.`).
- Non-UUID demo workspace tokens remain valid; case is unchanged.
- Left scheduled-recalculation (#735), recalculation-run transport (#734),
  recalculation-schedule (#733), restaurant-memory (#731), and other sibling
  restaurant tips untouched.
- Left non-identity `.trim()` sites in operating-plan copy/evidence alone.

## Tests

- `tests/operatingPlanRestaurantAsciiC.test.ts` inventing proofs for NBSP and
  em-space, ordinary ASCII padding, and empty/control/over-long rejection.

## Do not

- Re-tip this operating-plan restaurant_id path after merge.
- Bundle sibling restaurant-workspace tips in the same PR.
- Add a UUID shape requirement on this restaurant_id path.
