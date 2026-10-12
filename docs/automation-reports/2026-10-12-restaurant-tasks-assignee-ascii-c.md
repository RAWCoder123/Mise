# MISE-005OC: pin restaurant-tasks assigneeUserId to ASCII C

Date: 2026-10-12

## Inventing proof

Domain `optionalText` Unicode-trimmed `assigneeUserId` on
`normalizeCreateRestaurantTaskInput` and `restaurantTaskFromPersistedRow`.
NBSP / em-space padding invented a durable assignee identity before create RPC
arguments or hydrated task rows stored it:

- `'\u00a0staff-1\u00a0'.trim() === 'staff-1'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty values (ASCII whitespace or Unicode-only spaces) remain `null` — an
unassigned task is ordinary. Non-string, over-long, control-bearing, or
Unicode-padded non-empty tokens throw `Task assignee is invalid.`

## Change

- Add `services/domain/restaurantTasksAssigneeIdentity.ts`
- Route create + hydrate `assigneeUserId` through
  `normalizeCanonicalRestaurantTasksAssigneeUserId`
- Leave sibling `requiredText` / `optionalText` surfaces (`restaurantId`,
  `clientTaskId`, `correlationId`, `dependencyIds`, related ids, `createdBy`,
  `completedBy`, title/detail) on Unicode trim for separate tips

## Verification

- Focused `tests/restaurantTasksAssigneeAsciiC.test.ts`
- Existing `tests/restaurantTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808 clientTaskId, #809 correlationId,
#810 dependencyIds, #739 restaurant workspace, and #762 application taskId; do
not merge error contracts. When landing with sibling durable-key tips, drop
mutual Unicode-trim cross-assertions (especially #810's assertion that
`assigneeUserId` still Unicode-trims, and this tip's assertions that
`dependencyIds` / `clientTaskId` / `correlationId` still Unicode-trim).
