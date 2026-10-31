# MISE-005UU: pin purchase-authority providerWindowFrom to ASCII C

Date: 2026-10-31

## Inventing proof

`normalizePurchaseAuthorityResult` previously used Unicode
`nullableString(evidencePayload.providerWindowFrom, 20)` /
`boundedString(...).trim()`. NBSP / em-space padding around a valid provider
window start date invented a durable `providerWindowFrom` before it was stored
as purchase-authority evidence:

- `'\u20032026-08-01\u2003'.trim() === '2026-08-01'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty / non-string values remain `null` (prior `nullableString` contract).
Inventing, over-long, or control-bearing tokens throw
`Purchase authority providerWindowFrom is invalid.` Length capped at 20.

## Change

- Add `services/domain/purchaseAuthorityProviderWindowFromIdentity.ts`
- Route domain `normalizePurchaseAuthorityResult` through
  `normalizeCanonicalPurchaseAuthorityProviderWindowFrom`
- Leave sibling `boundedString` / `nullableString` surfaces
  (`evaluatedAt`, blocker descriptions, `recommendationId`, `inventoryItemId`,
  `supplierId`, `countEventId`, `countedAt`, `canonicalUnit`,
  `providerWindowTo`, `providerWindowCompletedAt`, recipe-revision keys,
  metadata keys/values) alone

## Verification

- Focused `tests/purchaseAuthorityProviderWindowFromAsciiC.test.ts`
- Existing `tests/purchaseAuthority.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #984 canonicalUnit, #983 countedAt,
#982 evaluatedAt, #981 descriptions, #806 countEventId, #805 inventoryItemId,
#804 recommendationId, #803 supplierId, and future `providerWindowTo` /
`providerWindowCompletedAt` tips; do not merge error contracts. When landing
with #983 / #984, drop mutual cross-assertions that the sibling field still
Unicode-trims. When landing a later providerWindowTo tip, drop this tip's
cross-assertion that providerWindowTo still Unicode-trims.
