# MISE-005UR: pin purchase-authority evaluatedAt to ASCII C

Date: 2026-10-31

## Inventing proof

`normalizePurchaseAuthorityResult` previously used Unicode
`boundedString(payload.evaluatedAt, 80)` / `.trim().slice(0, 80)`. NBSP /
em-space padding around a valid evaluation timestamp invented a durable
`evaluatedAt` before it was stored on `PurchaseAuthorityResult`:

- `'\u20032026-08-21T12:00:00.000Z\u2003'.trim() === '2026-08-21T12:00:00.000Z'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty / non-string / Unicode-only space / over-long / control-bearing
tokens soft-null into the intentional `new Date(0).toISOString()` epoch
fallback (prior `boundedString(...) || epoch` contract). Length capped at 80.

## Change

- Add `services/domain/purchaseAuthorityEvaluatedAtIdentity.ts`
- Route domain `normalizePurchaseAuthorityResult` through
  `normalizeCanonicalPurchaseAuthorityEvaluatedAt`
- Leave sibling `boundedString` / `nullableString` surfaces
  (`recommendationId`, `inventoryItemId`, `supplierId`, `countEventId`,
  `countedAt`, `canonicalUnit`, provider windows, recipe-revision keys,
  blocker descriptions, metadata keys/values) alone

## Verification

- Focused `tests/purchaseAuthorityEvaluatedAtAsciiC.test.ts`
- Existing `tests/purchaseAuthority.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #981 blocker descriptions, #819 metadata
values, #818 metadata keys, #807 recipe-revision keys, #806 countEventId,
#805 inventoryItemId, #804 recommendationId, and #803 supplierId; do not
merge contracts. When landing with #806, drop this tip's cross-assertion that
countEventId still Unicode-trims and drop #806's cross-assertion that
evaluatedAt still Unicode-trims (if present). When landing with #981, drop
this tip's cross-assertion that blocker descriptions still Unicode-trim and
drop #981's cross-assertion that evaluatedAt still Unicode-trims (if present).
