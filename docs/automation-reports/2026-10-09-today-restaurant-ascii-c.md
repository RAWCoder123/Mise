# MISE-005LG Today restaurant workspace ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-today-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Finding

`deriveOperationalTodayTasks` and `fetchTodaySummary` used Unicode
`restaurantId.trim()` before tenant-scope filtering and repository reads. NBSP
or em-space padding invents the unpadded workspace identity on the Today
command-center path.

## Change

- Added `services/domain/todayTasksRestaurantIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed domain `deriveOperationalTodayTasks` through
  `requireCanonicalTodayTasksRestaurantId` (preserves
  `A restaurant is required to derive Today tasks.`).
- Routed application `fetchTodaySummary` through
  `requireCanonicalTodayTasksWorkspaceId` (preserves
  `Missing restaurant workspace.`).
- Non-UUID demo workspace tokens remain valid; case is unchanged.
- Left operating-plan (#736), scheduled-recalculation (#735), recalculation-run
  transport (#734), recalculation-schedule (#733), restaurant-memory (#731),
  and other sibling restaurant tips untouched.
- Left `fetchDemoReadinessSummary` / `fetchSetupReadiness` alone (no inventing
  `.trim()` on those entry points).

## Tests

- `tests/todayTasksRestaurantAsciiC.test.ts` inventing proofs for NBSP and
  em-space, ordinary ASCII padding, and empty/control/over-long rejection.

## Do not

- Re-tip this Today restaurant_id path after merge.
- Bundle sibling restaurant-workspace tips in the same PR.
- Add a UUID shape requirement on this restaurant_id path.
