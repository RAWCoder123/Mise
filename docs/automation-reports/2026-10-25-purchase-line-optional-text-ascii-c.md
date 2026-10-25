# MISE-005PW purchase-line optional unit/currency/pack ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-purchase-line-optional-text-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

`normalizePurchaseLineInput` routed `unitOfMeasure`, `currency`, and `packSize`
through local `optionalBoundedText` Unicode `.trim()`. Em-space / NBSP padding
invented clean durable ledger tokens before ingestion
(`'\u00a0USD\u00a0'.trim() === 'USD'`, `'\u2003lb\u2003'.trim() === 'lb'`,
`'\u00a012ct\u00a0'.trim() === '12ct'`).

Open #668 / MISE-005IZ only pins client unit-dimension helpers and does not
own this optionalBoundedText surface.

## Change

- Add `PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS = 80`,
  `PURCHASE_LINE_CURRENCY_MAX_CHARACTERS = 3`, and
  `PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS = 80` to
  `services/domain/securityLimits.ts`.
- Add `services/domain/purchaseLineOptionalTextIdentity.ts` with ASCII C
  single-line identity prep (ASCII end trim only; fail closed when Unicode
  trim would still strip end padding; full C0/DEL control rejection).
- Route `normalizePurchaseLineInput` unit / currency / pack through
  fail-closed `normalizeCanonicalPurchaseLineUnitOfMeasure` /
  `normalizeCanonicalPurchaseLineCurrency` /
  `normalizeCanonicalPurchaseLinePackSize` (soft empty → `null`; over-long /
  unsafe controls / Unicode-padded tokens keep the prior
  `${label} must be bounded printable text.` message).
- Remove the now-unused local `optionalBoundedText` helper.
- Leave required `boundedText(rawItemDescription)` and `isoDate` on Unicode
  trim for later alone-OK tips.
- Leave open purchase-line object-identity tips (#728 / #764 / #768 / #802)
  and unit-helper tip #668 alone.
- Focused inventing proofs in
  `tests/purchaseLineOptionalTextAsciiC.test.ts`.

## Verification

- Focused AsciiC + purchaseLines: see commit evidence
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: see commit evidence
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from creditsLineId (#802), sourceDocumentReference
(#768), lineId (#764), restaurant workspace (#728), and unit helpers (#668).
When landing beside those tips, do not share identity modules. Do not assert
that `boundedText(rawItemDescription)` or `isoDate` still Unicode-trim once a
later tip owns them.
