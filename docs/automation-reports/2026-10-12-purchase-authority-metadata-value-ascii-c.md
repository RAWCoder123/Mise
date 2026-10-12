# MISE-005OK purchaseAuthority metadata string values ASCII C

Date: 2026-10-12

## Summary

Pins domain `normalizePurchaseAuthorityResult` `sanitizeMetadata` string values
to ASCII-C canonicalize so NBSP/em-space padding cannot invent a durable
purchase-authority blocker metadata string value via Unicode `trim()`.

## Inventing proof

`sanitizeMetadata` previously Unicode-trimmed metadata string values through
shared `boundedString(value, 120)` before storing them as purchase-authority
blocker evidence. Hosted blockers place durable identity tokens in those values
(for example `menuItemId` and `supplierOrderId`). NBSP/em-space padding invented
a valid value:

```text
'\u00a0bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb\u00a0'.trim()
  === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
```

ASCII-C canonicalize returns `null`. Soft-empty / non-string values remain
`""` to preserve the prior `boundedString` contract. Inventing / over-long /
control values throw `Purchase authority metadata value is invalid.` Length
stays capped at 120 without silent truncation inventing a shorter value.

## Change

- Adds `services/domain/purchaseAuthorityMetadataValueIdentity.ts`
- Routes metadata string values through ASCII-C normalize in `sanitizeMetadata`
- Leaves sibling `boundedString` / `nullableString` surfaces
  (`recommendationId`, `inventoryItemId`, `supplierId`, `countEventId`,
  `countedAt`, recipe-revision keys, descriptions, metadata map keys,
  evaluatedAt) alone

## Verification

- focused AsciiC + purchaseAuthority tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK. Keep modules separate from #818 metadata keys, #807 recipe-revision
keys, #806 countEventId, #805 inventoryItemId, #804 recommendationId, and #803
supplierId; do not merge error contracts. When co-landing with those tips, drop
mutual cross-assertions that the sibling field still Unicode-trims.

## Next siblings

- Prefer land/rebase open stacks #348–#818 and #192
- Next prove-before-tip: remaining Unicode-trim inventing durable-identity
  paths that use the trimmed result; restaurantTasks presentation surfaces
  (`relatedSupplierName`, `sourceReference`, title/detail/completionResult)
  remain lower priority than durable identity
