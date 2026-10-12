# MISE-005OG restaurant-tasks createdBy ASCII C

Date: 2026-10-12

## Inventing proof

Domain `requiredText` Unicode-trimmed `createdBy` on
`restaurantTaskFromPersistedRow`. NBSP/em-space padding invented a valid
durable creator identity
(`'\u00a0manager-1\u00a0'.trim() === 'manager-1'`). Hosted `created_by` is
UUID-shaped; fixtures may use other durable tokens.

## Change

- Add `services/domain/restaurantTasksCreatedByIdentity.ts`
- Route hydrate `createdBy` through ASCII-C require
- Leave sibling `requiredText` / `optionalText` surfaces on Unicode trim
  (`restaurantId`, `clientTaskId`, `correlationId`, `dependencyIds`,
  `assigneeUserId`, related ids, `completedBy`, title/detail free-text)

## Error contract

- Non-string → `Task creator is required.`
- Empty / Unicode-padded / over-long / control → `Task creator is invalid.`

## Verification

- Focused `restaurantTasksCreatedByAsciiC` tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808–#814 sibling durable-key tips,
#739 restaurant workspace, and #762 application taskId; do not merge error
contracts. When landing with sibling durable-key tips, drop mutual
Unicode-trim cross-assertions (especially tips that still assert `createdBy`
Unicode-trims).
