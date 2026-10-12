# MISE-005NT: pin purchaseLines creditsLineId to ASCII C

Date: 2026-10-12

## Inventing proof

`normalizePurchaseLineInput` previously used Unicode `creditsLineId?.trim() || null`.
NBSP / em-space padding around a valid credit-offset id invented a durable
`creditsLineId` before ledger ingestion or correction:

- `'\u00a0' + id + '\u00a0'.trim() === id`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty values (ASCII whitespace or Unicode-only spaces) remain `null` —
an unmatched credit is ordinary. Non-string, over-long, control-bearing, or
Unicode-padded non-empty tokens throw `Purchase line creditsLineId is invalid.`

## Change

- Add `services/domain/purchaseLinesCreditsLineIdentity.ts`
- Route domain `normalizePurchaseLineInput` through
  `normalizeCanonicalPurchaseLinesCreditsLineId`
- Leave application restaurant (#728), lineId (#764), and sourceDocumentReference
  (#768) on Unicode trim
- Leave other `normalizePurchaseLineInput` field trim surfaces alone

## Verification

- Focused `tests/purchaseLinesCreditsLineAsciiC.test.ts`
- Existing `tests/purchaseLines.test.ts` credit linkage cases
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. When landing with #764 / #768 / #728, keep modules separate and do
not merge error contracts. Drop any assertion that domain
`creditsLineId?.trim()` still Unicode-trims once this tip lands.
