# MISE-005NX: pin purchase-authority countEventId to ASCII C

Date: 2026-10-12

## Inventing proof

`normalizePurchaseAuthorityResult` previously used Unicode
`nullableString(evidencePayload.countEventId, 80)` /
`boundedString(...).trim()`. NBSP / em-space padding around a valid count-event
id invented a durable `countEventId` before it was stored as purchase-authority
evidence:

- `'\u00a0count-1\u00a0'.trim() === 'count-1'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty / non-string values remain `null` (prior `nullableString` contract).
Inventing, over-long, or control-bearing tokens throw
`Purchase authority countEventId is invalid.` Length capped at 80.

## Change

- Add `services/domain/purchaseAuthorityCountEventIdentity.ts`
- Route domain `normalizePurchaseAuthorityResult` through
  `normalizeCanonicalPurchaseAuthorityCountEventId`
- Leave sibling `boundedString` / `nullableString` surfaces
  (`recommendationId`, `inventoryItemId`, `supplierId`, `countedAt`,
  `canonicalUnit`, recipe-revision keys) alone

## Verification

- Focused `tests/purchaseAuthorityCountEventAsciiC.test.ts`
- Existing `tests/purchaseAuthority.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #805 inventoryItemId, #804 recommendationId,
and #803 supplierId; do not merge error contracts. When landing with #805, drop
this tip's cross-assertion that inventoryItemId still Unicode-trims and drop
#805's cross-assertion that countEventId still Unicode-trims. When landing with
#804 / #803, drop mutual recommendationId / supplierId Unicode-trim
cross-assertions.
