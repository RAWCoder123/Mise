# MISE-005OJ purchaseAuthority metadata keys ASCII C

Date: 2026-10-12

## Summary

Pins domain `normalizePurchaseAuthorityResult` `sanitizeMetadata` map keys to
ASCII-C canonicalize so NBSP/em-space padding cannot invent a durable
purchase-authority blocker metadata key via Unicode `trim()`.

## Inventing proof

`sanitizeMetadata` previously Unicode-trimmed metadata keys through shared
`boundedString(key, 60)` before storing them as purchase-authority blocker
evidence. NBSP/em-space padding invented a valid key:

```text
'\u00a0countedAt\u00a0'.trim() === 'countedAt'
```

ASCII-C canonicalize returns `null`. Soft-empty / non-string keys are omitted.
Inventing / over-long / control keys throw
`Purchase authority metadata key is invalid.` Length stays capped at 60 without
silent truncation inventing a shorter key.

## Change

- Adds `services/domain/purchaseAuthorityMetadataKeyIdentity.ts`
- Routes metadata map keys through ASCII-C normalize in `sanitizeMetadata`
- Leaves sibling `boundedString` / `nullableString` surfaces
  (`recommendationId`, `inventoryItemId`, `supplierId`, `countEventId`,
  `countedAt`, recipe-revision keys, descriptions, metadata string values)
  alone

## Verification

- focused AsciiC + purchaseAuthority tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK. Keep modules separate from #807 recipe-revision keys, #806
countEventId, #805 inventoryItemId, #804 recommendationId, and #803 supplierId;
do not merge error contracts. When co-landing with those tips, drop mutual
cross-assertions that the sibling field still Unicode-trims.

## Next siblings

- Prefer land/rebase open stacks #348–#817 and #192
- Proved non-inventing this run: mise-actions `requestedBy` remains pass-through
  / null (create + hydrate) — do not tip as inventing
- Next prove-before-tip: purchaseAuthority metadata string values if durable
  identity; restaurantTasks presentation surfaces (`relatedSupplierName`,
  `sourceReference`, title/detail/completionResult) are lower priority;
  mise-actions restaurant/subject/idempotency/action/approvedBy/rollback already
  tipped on open PRs
