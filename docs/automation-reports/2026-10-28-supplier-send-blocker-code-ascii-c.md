# MISE-005SV supplier-send blocker-code ASCII C (2026-10-28)

## Summary

Stop Unicode trim on order-detail `safeBlockerCodes` from inventing clean
supplier-send blocker routing tokens via NBSP/em-space padding
(`'\u2003send_content_changed\u2003'.trim() === 'send_content_changed'`).

## Change

- Add `services/domain/supplierSendBlockerCodeIdentity.ts`
- Route `app/orders/[id].tsx` `safeBlockerCodes` through soft
  `normalizeSupplierSendBlockerCodes` (ASCII end trim, fail-closed when Unicode
  padding remains, soft-drop unsafe/over-long, max 80 chars / 20 entries)
- Leave hosted `parseSupplierSendBlockerCodes` alone (exact Set membership, no
  trim)
- Leave open Gmail error-message tip (#930 / MISE-005SR) Unicode
  `.trim().slice(0, 320)` haystack alone
- Leave order-detail `operator_note` / `generatedOrderMessage` alone for open
  #840 / MISE-005PF

## Inventing proof

Prior path: `entry.trim()` invented a clean blocker code into
`supplierSendBlockerNotice` exact-string recovery branches.

## Alone-OK merge notes

Alone-OK with open #930 / #840 / #929 / #933. Keep
`supplierSendBlockerCodeIdentity.ts` separate from Gmail / Square /
operator_note identity modules. Do not tip #930 as covering order-detail
blocker routing; do not tip this as a substitute for #930.

## Verification

- focused `tests/supplierSendBlockerCodeAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
