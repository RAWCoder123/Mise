# MISE-005NW: pin purchase-authority inventoryItemId to ASCII C

Date: 2026-10-12  
Branch: `cursor/mise-purchase-authority-inventory-item-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `normalizePurchaseAuthorityResult` used Unicode `boundedString` trim on
`evidence.inventoryItemId` before storing durable purchase-authority
inventory-item identity. NBSP/em-space padding around a valid inventory-item
token Unicode-trimmed to that token and invented a clean inventory-item
identity stored as purchase-authority evidence.

`'\u00a0item-1\u00a0'.trim()` equals `item-1` while ASCII-C canonicalize returns
`null`. Soft empty / non-string still becomes `""` so missing inventory-item
evidence stays soft-empty without throwing.

## Change

- Added `services/domain/purchaseAuthorityInventoryItemIdentity.ts`
- Routed `normalizePurchaseAuthorityResult` inventoryItemId through ASCII-C
  normalize
- Preserved `Purchase authority inventoryItemId is invalid.` for inventing /
  over-long / control inputs; length capped at 80
- Left sibling `boundedString` surfaces (`recommendationId`, `supplierId`,
  `countEventId`, recipe-revision keys, descriptions, metadata) on Unicode trim

## Verification

- focused AsciiC + purchaseAuthority tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK. Keep modules separate from purchase-authority recommendationId (#804)
and supplierId (#803). Do not merge error contracts. When landing with #804,
drop the cross-assertion here that `recommendationId` still Unicode-trims, and
drop #804's cross-assertion that `inventoryItemId` still Unicode-trims. When
landing with #803, drop the cross-assertion here that `supplierId` still
Unicode-trims, and drop #803's cross-assertion that `inventoryItemId` still
Unicode-trims. When a sibling `countEventId` tip lands later, drop the
cross-assertion that `countEventId` still Unicode-trims.
