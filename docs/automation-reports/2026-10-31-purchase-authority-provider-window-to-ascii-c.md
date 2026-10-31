# MISE-005UV: pin purchase-authority providerWindowTo to ASCII C

Date: 2026-10-31

## Inventing proof

`normalizePurchaseAuthorityResult` previously used Unicode
`nullableString(evidencePayload.providerWindowTo, 20)` /
`boundedString(...).trim()`. NBSP / em-space padding around a valid provider
window end date invented a durable `providerWindowTo` before it was stored as
purchase-authority evidence:

- `'\u20032026-08-28\u2003'.trim() === '2026-08-28'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty / non-string values remain `null` (prior `nullableString` contract).
Inventing, over-long, or control-bearing tokens throw
`Purchase authority providerWindowTo is invalid.` Length capped at 20.

## Change

- Add `services/domain/purchaseAuthorityProviderWindowToIdentity.ts`
- Route domain `normalizePurchaseAuthorityResult` through
  `normalizeCanonicalPurchaseAuthorityProviderWindowTo`
- Leave sibling `boundedString` / `nullableString` surfaces
  (`evaluatedAt`, blocker descriptions, `recommendationId`, `inventoryItemId`,
  `supplierId`, `countEventId`, `countedAt`, `canonicalUnit`,
  `providerWindowFrom`, `providerWindowCompletedAt`, recipe-revision keys,
  metadata keys/values) alone

## Verification

- Focused `tests/purchaseAuthorityProviderWindowToAsciiC.test.ts`
- Existing `tests/purchaseAuthority.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #985 providerWindowFrom, #984
canonicalUnit, #983 countedAt, #982 evaluatedAt, #981 descriptions,
#806 countEventId, #805 inventoryItemId, #804 recommendationId,
#803 supplierId, and future `providerWindowCompletedAt` tips; do not merge
error contracts. When landing with #985 / #983 / #984, drop mutual
cross-assertions that the sibling field still Unicode-trims. When landing a
later providerWindowCompletedAt tip, drop this tip's cross-assertion that
providerWindowCompletedAt still Unicode-trims.
