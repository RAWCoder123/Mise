# MISE-005OA restaurant-tasks correlationId ASCII C

Date: 2026-10-12

## Inventing proof

Domain `requiredText` Unicode-trimmed `correlationId` on
`restaurantTaskFromPersistedRow`. NBSP/em-space padding invented a valid
durable correlation identity
(`'\u00a0correlation-1\u00a0'.trim() === 'correlation-1'`). Hosted
`correlation_id` is UUID-shaped; fixtures may use other durable tokens.

## Change

- Add `services/domain/restaurantTasksCorrelationIdentity.ts`
- Route hydrate `correlationId` through ASCII-C require
- Leave sibling `requiredText` / `optionalText` surfaces on Unicode trim
  (`restaurantId`, `clientTaskId`, `dependencyIds`, `assigneeUserId`,
  related ids, `createdBy`, `completedBy`, title/detail free-text)

## Error contract

- Non-string → `Task correlation id is required.`
- Empty / Unicode-padded / over-long / control → `Task correlation id is invalid.`

## Verification

- Focused `restaurantTasksCorrelationAsciiC` tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808 clientTaskId, #739 restaurant
workspace, and #762 application taskId; do not merge error contracts. When
landing with sibling durable-key tips (`clientTaskId`, `dependencyIds`,
`assigneeUserId`, related ids, `createdBy`/`completedBy`), drop mutual
Unicode-trim cross-assertions.
