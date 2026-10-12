# MISE-005NZ restaurant-tasks clientTaskId ASCII C

Date: 2026-10-12

## Inventing proof

Domain `requiredText` Unicode-trimmed `clientTaskId` on
`normalizeCreateRestaurantTaskInput` and `restaurantTaskFromPersistedRow`.
NBSP/em-space padding invented a valid durable client-task identity
(`'\u00a0client-task-1\u00a0'.trim() === 'client-task-1'`).

## Change

- Add `services/domain/restaurantTasksClientTaskIdentity.ts`
- Route create + hydrate `clientTaskId` through ASCII-C require
- Leave sibling `requiredText` / `optionalText` surfaces on Unicode trim
  (`restaurantId`, `correlationId`, `dependencyIds`, `assigneeUserId`,
  related ids, title/detail free-text)

## Error contract

- Non-string → `Client task id is required.`
- Empty / Unicode-padded / over-long / control → `Client task id is invalid.`

## Verification

- Focused `restaurantTasksClientTaskAsciiC` tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #739 restaurant workspace and #762
application taskId; do not merge error contracts. When landing with later
sibling durable-key tips (`correlationId`, `dependencyIds`,
`assigneeUserId`, related ids), drop mutual Unicode-trim cross-assertions.
