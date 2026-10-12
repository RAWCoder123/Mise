# MISE-005OM: pin restaurant-tasks relatedSupplierName to ASCII C display prep

Date: 2026-10-12

## Inventing proof

Domain `optionalText` Unicode-trimmed `relatedSupplierName` on
`normalizeCreateRestaurantTaskInput` and `restaurantTaskFromPersistedRow`.
Em-space padding invented a clean supplier display name before create RPC
arguments or hydrated task rows stored it:

- `'\u2003Regional Protein Co\u2003'.trim() === 'Regional Protein Co'`
- ASCII C display prep leaves the em-space alone and does not invent equality
  with the unpadded name

NBSP padding is folded to a plain space (intentional parity with
`private.normalize_supplier_display_name` / MISE-005B / #410 / #691 / #692).
Soft-empty values (ASCII whitespace, NBSP-only, or Unicode-only spaces) remain
`null` — a task without a related supplier is ordinary. Non-string,
over-long (over 200), or control-bearing tokens throw
`Related supplier is invalid.`

## Change

- Add `services/domain/restaurantTasksRelatedSupplierNameIdentity.ts`
- Route create + hydrate `relatedSupplierName` through
  `normalizeCanonicalRestaurantTasksRelatedSupplierName`
- Leave sibling `requiredText` / `optionalText` surfaces (`restaurantId`,
  `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`,
  `relatedInventoryItemId`, `relatedOrderId`, `relatedRecommendationId`,
  `sourceReference`, `createdBy`, `completedBy`, `locationId`,
  title/detail) on Unicode trim for separate tips

## Verification

- Focused `tests/restaurantTasksRelatedSupplierNameAsciiC.test.ts`
- Existing `tests/restaurantTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808 clientTaskId, #809 correlationId,
#810 dependencyIds, #811 assigneeUserId, #812 relatedInventoryItemId,
#813 relatedOrderId, #814 relatedRecommendationId, #815 createdBy,
#816 completedBy, #817 locationId, #820 sourceReference, #739 restaurant
workspace, #762 application taskId, #691 suppliers-settings display name, and
#692 supplier display-name validation; do not merge error contracts or share
helper modules. When landing with sibling durable-key tips, drop mutual
Unicode-trim cross-assertions (especially assertions that
`relatedSupplierName` still Unicode-trims, and this tip's assertions that
`sourceReference` / `relatedRecommendationId` / `relatedOrderId` /
`relatedInventoryItemId` / `assigneeUserId` / `locationId` / `clientTaskId` /
`createdBy` / `completedBy` / `dependencyIds` still Unicode-trim). Distinct
from open SQL cntrl pin #558.
