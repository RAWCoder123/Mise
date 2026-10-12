# MISE-005NY purchaseAuthority recipe-revision keys ASCII C

Date: 2026-10-12

## Summary

Pins domain `normalizePurchaseAuthorityResult` `evidence.recipeRevisions` map
keys to ASCII-C canonicalize so NBSP/em-space padding cannot invent a durable
recipe / menu revision identity via Unicode `trim()`.

## Inventing proof

`normalizePurchaseAuthorityResult` previously Unicode-trimmed recipe-revision
keys through shared `boundedString(key, 80)` before storing them as
purchase-authority evidence. NBSP/em-space padding invented a valid key:

```text
'\u00a0menu-1\u00a0'.trim() === 'menu-1'
```

ASCII-C canonicalize returns `null`. Soft-empty / non-string keys are omitted.
Inventing / over-long / control keys throw
`Purchase authority recipe revision key is invalid.` Length stays capped at 80
without silent truncation inventing a shorter key.

## Change

- Adds `services/domain/purchaseAuthorityRecipeRevisionIdentity.ts`
- Routes recipe-revision map keys through ASCII-C normalize in
  `normalizePurchaseAuthorityResult`
- Leaves sibling `boundedString` / `nullableString` surfaces
  (`recommendationId`, `inventoryItemId`, `supplierId`, `countEventId`,
  `countedAt`, descriptions, metadata) alone

## Verification

- focused AsciiC + purchaseAuthority tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK. Keep modules separate from #806 countEventId, #805 inventoryItemId,
#804 recommendationId, and #803 supplierId; do not merge error contracts. When
co-landing with those tips, drop mutual cross-assertions that the sibling field
still Unicode-trims.
