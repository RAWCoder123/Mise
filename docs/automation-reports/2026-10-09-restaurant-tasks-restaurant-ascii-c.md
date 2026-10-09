# MISE-005LI restaurant-tasks restaurant workspace ASCII C

Date: 2026-10-09

## Finding

`listSharedRestaurantTasks` and `reopenSharedRestaurantTask` used Unicode
`restaurantId.trim()` before tenant-scope filtering and reopen. NBSP or em-space
padding invents the unpadded workspace identity on the shared restaurant-tasks
path.

## Change

- Added `services/domain/restaurantTasksRestaurantIdentity.ts` with ASCII-only
  end trim and fail-closed canonicalize.
- Routed application list through `requireCanonicalRestaurantTasksWorkspaceId`
  (`Missing restaurant workspace.`).
- Routed application reopen restaurant half through
  `requireCanonicalRestaurantTasksReopenRestaurantId`
  (`Restaurant and task are required.`).
- Left `taskId.trim()` and domain `requiredText` create/complete paths alone.
- Left sibling restaurant tips (#738–#729 and earlier) untouched.

## Verification

- Focused `tests/restaurantTasksRestaurantAsciiC.test.ts`
- `npm run typecheck`
- Existing restaurant-task tests as applicable
