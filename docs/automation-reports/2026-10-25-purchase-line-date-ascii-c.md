# MISE-005PX purchase-line ISO calendar date ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-purchase-line-date-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

`normalizePurchaseLineInput` routed `transactionDate` and `receivedDate`
through local `isoDate` Unicode `.trim()`. Em-space / NBSP padding invented
clean durable ledger calendar tokens before ingestion
(`'\u00a02026-10-01\u00a0'.trim() === '2026-10-01'`,
`'\u20032026-10-01\u2003'.trim() === '2026-10-01'`).

Open #398 only adds lookback/future skew bounds and does not own this Unicode
trim inventing surface. Open #857 owns optional unit/currency/pack and leaves
`isoDate` alone.

## Change

- Add `services/domain/purchaseLineIsoDateIdentity.ts` with ASCII C single-line
  ISO calendar-date identity prep (ASCII end trim only; fail closed when
  Unicode trim would still strip end padding; full C0/DEL control rejection;
  `YYYY-MM-DD` + real UTC calendar day).
- Route `normalizePurchaseLineInput` transaction / received dates through
  fail-closed `normalizeCanonicalPurchaseLineIsoDate` (absent/empty
  `receivedDate` stays `null`; Unicode-padded / control / non-ISO tokens keep
  the prior `${label} must be an ISO calendar date.` message).
- Remove the now-unused local `isoDate` helper.
- Leave required `boundedText(rawItemDescription)` and optional
  `optionalBoundedText` unit/currency/pack on Unicode trim for later / sibling
  tips (#857).
- Leave open purchase-line object-identity tips (#728 / #764 / #768 / #802),
  unit-helper tip #668, and date-bounds tip #398 alone.
- Focused inventing proofs in `tests/purchaseLineIsoDateAsciiC.test.ts`.

## Verification

- Focused `purchaseLineIsoDateAsciiC` + `purchaseLines`: 35/35
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 687 pass / 0 fail / 0 cancelled
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from optional unit/currency/pack (#857),
creditsLineId (#802), sourceDocumentReference (#768), lineId (#764),
restaurant workspace (#728), unit helpers (#668), and date-window bounds
(#398). When landing beside #857, drop mutual Unicode-trim cross-assertions
on sibling `optionalBoundedText` / `boundedText(rawItemDescription)` fields
once those tips own them. Do not assert that `boundedText(rawItemDescription)`
still Unicode-trims once a later tip owns it.
