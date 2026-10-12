# MISE-005OH: pin restaurant-tasks completedBy to ASCII C

Date: 2026-10-12

## Inventing proof

Domain `optionalText` Unicode-trimmed `completedBy` on
`restaurantTaskFromPersistedRow` only (create input does not carry completer;
server sets `completed_by` on completion). NBSP / em-space padding invented a
durable completer identity before hydrated task rows stored it:

- `'\u00a0manager-1\u00a0'.trim() === 'manager-1'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty values (ASCII whitespace or Unicode-only spaces) remain `null` — an
incomplete task is ordinary. Non-string, over-long, control-bearing, or
Unicode-padded non-empty tokens throw `Task completer is invalid.`

## Change

- Add `services/domain/restaurantTasksCompletedByIdentity.ts`
- Route hydrate `completedBy` through
  `normalizeCanonicalRestaurantTasksCompletedBy`
- Leave sibling `requiredText` / `optionalText` surfaces (`restaurantId`,
  `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`, related
  ids, `createdBy`, title/detail) on Unicode trim for separate tips

## Verification

- Focused `tests/restaurantTasksCompletedByAsciiC.test.ts`
- Existing `tests/restaurantTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808–#815 sibling durable-key tips; do not
merge error contracts. When landing with sibling durable-key tips, drop mutual
Unicode-trim cross-assertions (especially tips that still assert `completedBy`
Unicode-trims, and this tip's assertions that `assigneeUserId` / `createdBy` /
`clientTaskId` / `dependencyIds` / related ids still Unicode-trim).
