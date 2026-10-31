# MISE-005US: pin purchase-authority countedAt to ASCII C

Date: 2026-10-31

## Inventing proof

`normalizePurchaseAuthorityResult` previously used Unicode
`nullableString(evidencePayload.countedAt, 80)` /
`boundedString(...).trim()`. NBSP / em-space padding around a valid inventory
count timestamp invented a durable `countedAt` before it was stored as
purchase-authority evidence:

- `'\u20032026-08-19T12:00:00.000Z\u2003'.trim() === '2026-08-19T12:00:00.000Z'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty / non-string values remain `null` (prior `nullableString` contract).
Inventing, over-long, or control-bearing tokens throw
`Purchase authority countedAt is invalid.` Length capped at 80.

## Change

- Add `services/domain/purchaseAuthorityCountedAtIdentity.ts`
- Route domain `normalizePurchaseAuthorityResult` through
  `normalizeCanonicalPurchaseAuthorityCountedAt`
- Leave sibling `boundedString` / `nullableString` surfaces
  (`evaluatedAt`, blocker descriptions, `recommendationId`, `inventoryItemId`,
  `supplierId`, `countEventId`, `canonicalUnit`, provider windows,
  recipe-revision keys, metadata keys/values) alone

## Verification

- Focused `tests/purchaseAuthorityCountedAtAsciiC.test.ts`
- Existing `tests/purchaseAuthority.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #982 evaluatedAt, #981 descriptions,
#806 countEventId, #805 inventoryItemId, #804 recommendationId, #803
supplierId, and future `canonicalUnit` / provider-window tips; do not merge
error contracts. When landing with #806, drop this tip's cross-assertion that
countEventId still Unicode-trims and drop #806's cross-assertion that
countedAt still Unicode-trims. When landing with #982, drop mutual evaluatedAt
Unicode-trim cross-assertions. When landing with a later canonicalUnit tip,
drop mutual canonicalUnit Unicode-trim cross-assertions.
