# MISE-005OB restaurant-tasks dependencyIds ASCII C

Date: 2026-10-12

## Inventing proof

Domain `requiredText` Unicode-trimmed each `dependencyIds` token on
`normalizeCreateRestaurantTaskInput` and `restaurantTaskFromPersistedRow`.
NBSP/em-space padding invented a valid durable dependency identity
(`'\u00a0task-a\u00a0'.trim() === 'task-a'`).

## Change

- Add `services/domain/restaurantTasksDependencyIdentity.ts`
- Route create + hydrate `dependencyIds` through ASCII-C require
- Leave sibling `requiredText` / `optionalText` surfaces on Unicode trim
  (`restaurantId`, `clientTaskId`, `correlationId`, `assigneeUserId`,
  related ids, `createdBy`, `completedBy`, title/detail free-text)

## Error contract

- Non-string → `Dependency id is required.`
- Empty / Unicode-padded / over-long / control → `Dependency id is invalid.`

## Verification

- Focused `restaurantTasksDependencyAsciiC` tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808 clientTaskId, #809 correlationId,
#739 restaurant workspace, and #762 application taskId; do not merge error
contracts. When landing with sibling durable-key tips (`clientTaskId`,
`correlationId`, `assigneeUserId`, related ids, `createdBy`/`completedBy`),
drop mutual Unicode-trim cross-assertions.
