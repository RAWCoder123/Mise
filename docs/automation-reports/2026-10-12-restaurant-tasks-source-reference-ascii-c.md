# MISE-005OL: pin restaurant-tasks sourceReference to ASCII C

Date: 2026-10-12

## Inventing proof

Domain `optionalText` Unicode-trimmed `sourceReference` on
`normalizeCreateRestaurantTaskInput` and `restaurantTaskFromPersistedRow`.
NBSP / em-space padding invented a durable source-reference key before create
RPC arguments or hydrated task rows stored it:

- `'\u00a0inventory-risk:item-1\u00a0'.trim() === 'inventory-risk:item-1'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty values (ASCII whitespace or Unicode-only spaces) remain `null` — a
task without a source reference is ordinary. Non-string, over-long (over 240),
control-bearing, or Unicode-padded non-empty tokens throw
`Task source reference is invalid.`

## Change

- Add `services/domain/restaurantTasksSourceReferenceIdentity.ts`
- Route create + hydrate `sourceReference` through
  `normalizeCanonicalRestaurantTasksSourceReference`
- Leave sibling `requiredText` / `optionalText` surfaces (`restaurantId`,
  `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`,
  `relatedInventoryItemId`, `relatedOrderId`, `relatedRecommendationId`,
  `relatedSupplierName`, `createdBy`, `completedBy`, `locationId`,
  title/detail) on Unicode trim for separate tips

## Verification

- Focused `tests/restaurantTasksSourceReferenceAsciiC.test.ts`
- Existing `tests/restaurantTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808 clientTaskId, #809 correlationId,
#810 dependencyIds, #811 assigneeUserId, #812 relatedInventoryItemId,
#813 relatedOrderId, #814 relatedRecommendationId, #815 createdBy,
#816 completedBy, #817 locationId, #739 restaurant workspace, and #762
application taskId; do not merge error contracts. When landing with sibling
durable-key tips, drop mutual Unicode-trim cross-assertions (especially
assertions that `sourceReference` still Unicode-trims, and this tip's
assertions that `relatedSupplierName` / `relatedRecommendationId` /
`relatedOrderId` / `relatedInventoryItemId` / `assigneeUserId` / `locationId` /
`clientTaskId` / `createdBy` / `completedBy` / `dependencyIds` still
Unicode-trim).
