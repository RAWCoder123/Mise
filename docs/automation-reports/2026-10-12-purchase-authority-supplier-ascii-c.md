# MISE-005NU: pin purchase-authority supplierId to ASCII C

Date: 2026-10-12  
Branch: `cursor/mise-purchase-authority-supplier-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `normalizePurchaseAuthorityResult` used Unicode `boundedString` trim on
`evidence.supplierId` before storing durable purchase-authority supplier
identity. NBSP/em-space padding around a valid supplier token Unicode-trimmed
to that token and invented a clean supplier identity used for readiness
(`Boolean(supplierId)`).

`'\u00a0aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\u00a0'.trim()` equals the bare
UUID while ASCII-C canonicalize returns `null`. Soft empty / non-string still
becomes `""` so readiness fails closed without throwing.

## Change

- Added `services/domain/purchaseAuthoritySupplierIdentity.ts`
- Routed `normalizePurchaseAuthorityResult` supplierId through ASCII-C normalize
- Preserved `Purchase authority supplierId is invalid.` for inventing /
  over-long / control inputs; length capped at 80
- Left sibling `boundedString` surfaces (`recommendationId`, `inventoryItemId`,
  `countEventId`, recipe-revision keys, descriptions, metadata) on Unicode trim

## Verification

- focused AsciiC + purchaseAuthority: 11/11
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 689 total / 682 pass / 0 fail / 7 cancelled (pre-existing
  recalculationCycles cancelledByParent flakes)

## Merge notes

Alone-OK. Keep modules separate from purchaseLines creditsLineId (#802) and
mise-actions approvedBy (#800). Do not merge error contracts. When a sibling
recommendationId / inventoryItemId tip lands later, drop the cross-assertion
that those fields still Unicode-trim.
