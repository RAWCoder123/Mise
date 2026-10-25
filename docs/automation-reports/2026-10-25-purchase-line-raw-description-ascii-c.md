# MISE-005PY purchase-line rawItemDescription ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-purchase-line-raw-description-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

`normalizePurchaseLineInput` routed required `rawItemDescription` through
local `boundedText` Unicode `.trim()`. Em-space / NBSP padding invented clean
durable ledger descriptions before ingestion
(`'\u00a0Chicken Thighs 40 LB\u00a0'.trim() === 'Chicken Thighs 40 LB'`,
`'\u2003Olive Oil\u2003'.trim() === 'Olive Oil'`).

Prior `boundedText` already rejected full C0/DEL including LF/TAB/CR, so this
is a single-line ledger evidence string (not operator_note-style multiline
fold). Open #857 / MISE-005PW owns optional unit/currency/pack;
open #858 / MISE-005PX owns ISO calendar dates — neither owns this required
description surface.

## Change

- Add `PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS = 500` to
  `services/domain/securityLimits.ts`.
- Add `services/domain/purchaseLineRawItemDescriptionIdentity.ts` with ASCII C
  single-line identity prep (ASCII end trim only; fail closed when Unicode
  trim would still strip end padding; full C0/DEL control rejection).
- Route `normalizePurchaseLineInput` raw description through fail-closed
  `normalizeCanonicalPurchaseLineRawItemDescription` (soft empty / over-long /
  unsafe controls / Unicode-padded / non-string keep the prior
  `Raw item description must be bounded printable text.` message).
- Leave local `boundedText` in place for sibling `optionalBoundedText`.
- Leave `optionalBoundedText` unit/currency/pack and `isoDate` on Unicode
  trim for later alone-OK tips (#857 / #858).
- Leave open purchase-line object-identity tips (#728 / #764 / #768 / #802)
  and unit-helper tip #668 alone.
- Focused inventing proofs in
  `tests/purchaseLineRawItemDescriptionAsciiC.test.ts`.

## Verification

- Focused AsciiC: 4/4 pass
- Focused purchaseLines: 35/35 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing timeout cancellations)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from optional text (#857), ISO dates (#858),
creditsLineId (#802), sourceDocumentReference (#768), lineId (#764),
restaurant workspace (#728), and unit helpers (#668). When landing beside
#857/#858, drop their assertions that `boundedText(rawItemDescription)` still
Unicode-trims. Do not assert that `optionalBoundedText` or `isoDate` still
Unicode-trim once those tips own them.
