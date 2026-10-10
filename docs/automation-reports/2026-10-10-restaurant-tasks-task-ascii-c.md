# MISE-005MF: pin restaurant-tasks taskId to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-restaurant-tasks-task-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins restaurant-tasks application `reopenSharedRestaurantTask` `taskId` to
ASCII-only end trim so NBSP/em-space padding cannot invent a normalized task
identity before reopen writes.

- Adds `services/domain/restaurantTasksObjectIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes `reopenSharedRestaurantTask` `taskId` through
  `requireCanonicalRestaurantTasksTaskId`.
- Preserves `Restaurant and task are required.` for the task half.
- Leaves restaurant workspace on Unicode trim (owned by #739 / MISE-005LI).
- Leaves `completeSharedRestaurantTask` input pass-through alone.
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).

## Merge note

When landing with #739, keep both restaurant and task branches in
`restaurantTasks.ts`. Drop any assertion that `taskId.trim()` still Unicode-
trims on reopen; this tip owns that object identity. #739 owns restaurant
`Missing restaurant workspace.` and the restaurant half of
`Restaurant and task are required.`

## Verification

- `tests/restaurantTasksObjectAsciiC.test.ts`: 4/4
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)

## Do not

- Re-tip this restaurant-tasks taskId object path after merge.
- Bundle restaurant (#739) or sibling object tips in the same PR.
- Rewrite restaurant `restaurantId.trim()` / workspace helpers in this tip.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).
