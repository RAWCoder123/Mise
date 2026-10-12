# MISE-005NV: pin purchase-authority recommendationId to ASCII C

Date: 2026-10-12  
Branch: `cursor/mise-purchase-authority-recommendation-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `normalizePurchaseAuthorityResult` used Unicode `boundedString` trim on
`evidence.recommendationId` before storing durable purchase-authority
recommendation identity. NBSP/em-space padding around a valid recommendation
token Unicode-trimmed to that token and invented a clean recommendation
identity stored as purchase-authority evidence.

`'\u00a0rec-1\u00a0'.trim()` equals `rec-1` while ASCII-C canonicalize returns
`null`. Soft empty / non-string still becomes `""` so missing recommendation
evidence stays soft-empty without throwing.

## Change

- Added `services/domain/purchaseAuthorityRecommendationIdentity.ts`
- Routed `normalizePurchaseAuthorityResult` recommendationId through ASCII-C
  normalize
- Preserved `Purchase authority recommendationId is invalid.` for inventing /
  over-long / control inputs; length capped at 80
- Left sibling `boundedString` surfaces (`supplierId`, `inventoryItemId`,
  `countEventId`, recipe-revision keys, descriptions, metadata) on Unicode trim

## Verification

- focused AsciiC + purchaseAuthority tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK. Keep modules separate from purchase-authority supplierId (#803) and
purchaseLines creditsLineId (#802). Do not merge error contracts. When landing
with #803, drop the cross-assertion here that `supplierId` still Unicode-trims,
and drop #803's cross-assertion that `recommendationId` still Unicode-trims.
When a sibling inventoryItemId / countEventId tip lands later, drop the
cross-assertion that those fields still Unicode-trim.
