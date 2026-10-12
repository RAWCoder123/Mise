# MISE-005OF: pin restaurant-tasks relatedRecommendationId to ASCII C

Date: 2026-10-12

## Inventing proof

Domain `optionalText` Unicode-trimmed `relatedRecommendationId` on
`normalizeCreateRestaurantTaskInput` and `restaurantTaskFromPersistedRow`.
NBSP / em-space padding invented a durable recommendation identity before
create RPC arguments or hydrated task rows stored it:

- `'\u00a0recommendation-1\u00a0'.trim() === 'recommendation-1'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty values (ASCII whitespace or Unicode-only spaces) remain `null` — an
unrelated task is ordinary. Non-string, over-long, control-bearing, or
Unicode-padded non-empty tokens throw `Related recommendation is invalid.`

## Change

- Add `services/domain/restaurantTasksRelatedRecommendationIdentity.ts`
- Route create + hydrate `relatedRecommendationId` through
  `normalizeCanonicalRestaurantTasksRelatedRecommendationId`
- Leave sibling `requiredText` / `optionalText` surfaces (`restaurantId`,
  `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`,
  `relatedInventoryItemId`, `relatedOrderId`, `createdBy`, `completedBy`,
  title/detail) on Unicode trim for separate tips

## Verification

- Focused `tests/restaurantTasksRelatedRecommendationAsciiC.test.ts`
- Existing `tests/restaurantTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808 clientTaskId, #809 correlationId,
#810 dependencyIds, #811 assigneeUserId, #812 relatedInventoryItemId,
#813 relatedOrderId, #739 restaurant workspace, and #762 application taskId;
do not merge error contracts. When landing with sibling durable-key tips, drop
mutual Unicode-trim cross-assertions (especially #813's assertion that
`relatedRecommendationId` still Unicode-trims, and this tip's assertions that
`relatedOrderId` / `relatedInventoryItemId` / `assigneeUserId` /
`dependencyIds` / `clientTaskId` / `createdBy` / `completedBy` still
Unicode-trim).
