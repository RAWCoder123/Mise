# MISE-005OD: pin restaurant-tasks relatedInventoryItemId to ASCII C

Date: 2026-10-12

## Inventing proof

Domain `optionalText` Unicode-trimmed `relatedInventoryItemId` on
`normalizeCreateRestaurantTaskInput` and `restaurantTaskFromPersistedRow`.
NBSP / em-space padding invented a durable inventory item identity before
create RPC arguments or hydrated task rows stored it:

- `'\u00a0item-1\u00a0'.trim() === 'item-1'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty values (ASCII whitespace or Unicode-only spaces) remain `null` — an
unrelated task is ordinary. Non-string, over-long, control-bearing, or
Unicode-padded non-empty tokens throw `Related inventory item is invalid.`

## Change

- Add `services/domain/restaurantTasksRelatedInventoryItemIdentity.ts`
- Route create + hydrate `relatedInventoryItemId` through
  `normalizeCanonicalRestaurantTasksRelatedInventoryItemId`
- Leave sibling `requiredText` / `optionalText` surfaces (`restaurantId`,
  `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`,
  `relatedOrderId`, `relatedRecommendationId`, `createdBy`, `completedBy`,
  title/detail) on Unicode trim for separate tips

## Verification

- Focused `tests/restaurantTasksRelatedInventoryItemAsciiC.test.ts`
- Existing `tests/restaurantTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808 clientTaskId, #809 correlationId,
#810 dependencyIds, #811 assigneeUserId, #739 restaurant workspace, and #762
application taskId; do not merge error contracts. When landing with sibling
durable-key tips, drop mutual Unicode-trim cross-assertions (especially
#811's assertion that `relatedInventoryItemId` still Unicode-trims, and this
tip's assertions that `assigneeUserId` / `dependencyIds` / `clientTaskId` /
`relatedOrderId` / `relatedRecommendationId` still Unicode-trim).
