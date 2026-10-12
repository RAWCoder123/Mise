# MISE-005ON: pin restaurant-tasks title to ASCII C display prep

Date: 2026-10-12

## Inventing proof

Domain `requiredText` Unicode-trimmed and `\s`-collapsed `title` on
`normalizeCreateRestaurantTaskInput` and `restaurantTaskFromPersistedRow`.
Em-space padding invented a clean single-line title before create RPC
arguments or hydrated task rows stored it:

- `'\u2003Confirm chicken count\u2003'.trim().replace(/\s+/g, " ") ===
  'Confirm chicken count'`
- ASCII C display prep leaves the em-space alone and does not invent equality
  with the unpadded title

NBSP padding is folded to a plain space (intentional parity with
relatedSupplierName / `private.normalize_supplier_display_name` / MISE-005B /
#410 / #691 / #692 / #821). Empty-after-prep values (ASCII whitespace,
NBSP-only, or Unicode-only spaces) remain invalid for this required field —
`Task title is invalid.` Non-string tokens throw `Task title is required.`
Over-long (over 160) or control-bearing tokens throw
`Task title is invalid.`

## Change

- Add `services/domain/restaurantTasksTitleIdentity.ts`
- Route create + hydrate `title` through
  `requireCanonicalRestaurantTasksTitle`
- Leave sibling `requiredText` / `optionalText` surfaces (`restaurantId`,
  `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`,
  `relatedInventoryItemId`, `relatedOrderId`, `relatedRecommendationId`,
  `relatedSupplierName`, `sourceReference`, `createdBy`, `completedBy`,
  `locationId`, detail, completionResult) on Unicode trim for separate tips

## Verification

- Focused `tests/restaurantTasksTitleAsciiC.test.ts`
- Existing `tests/restaurantTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808 clientTaskId, #809 correlationId,
#810 dependencyIds, #811 assigneeUserId, #812 relatedInventoryItemId,
#813 relatedOrderId, #814 relatedRecommendationId, #815 createdBy,
#816 completedBy, #817 locationId, #820 sourceReference, #821
relatedSupplierName, #739 restaurant workspace, #762 application taskId,
#691 suppliers-settings display name, and #692 supplier display-name
validation; do not merge error contracts or share helper modules. When
landing with sibling durable-key / display tips, drop mutual Unicode-trim
cross-assertions (especially assertions that `title` still Unicode-trims, and
this tip's assertions that `relatedSupplierName` / `sourceReference` /
`relatedRecommendationId` / `relatedOrderId` / `relatedInventoryItemId` /
`assigneeUserId` / `locationId` / `clientTaskId` / `createdBy` /
`completedBy` / `dependencyIds` / `detail` / `completionResult` still
Unicode-trim). Distinct from open SQL cntrl pin #556.
