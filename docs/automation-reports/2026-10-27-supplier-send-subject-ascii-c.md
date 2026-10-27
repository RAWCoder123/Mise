# MISE-005SA demo supplier-send subject ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-supplier-send-subject-ascii-c`

## Problem

`services/domain/supplierSendContent.ts` `normalizedSubject` built
`${restaurantName} order for ${supplierName}`, collapsed CR/LF runs, then
Unicode-trimmed before storing `subject` on the durable demo send snapshot and
content fingerprint. Unicode trim invents a clean subject
(`'\u2003Harbor Kitchen order for Acme Foods\u2003'.trim() ===
'Harbor Kitchen order for Acme Foods'`). Leading em-space on `restaurantName`
likewise invents a clean subject start. Soft empty / Unicode-only space also
invented the invalid-subject / null branch via `'\u2003'.trim() === ''`.

Open #708 / MISE-005KM pins demo From/To mailbox identity. Open #681 /
MISE-005JL pins supplier-recipient / preview email. Open #425 / MISE-005Q pins
hosted subject COLLATE shape. None own this demo subject Unicode-trim sink.
Tip them separately.

## Change

- New `services/domain/supplierSendSubjectIdentity.ts` (MISE-005SA)
- Soft empty / Unicode-only space → `null` (`send_subject_invalid`)
- ASCII whitespace still trims clean before length / control gates
- Unicode-padded / control → `null` (no invent into fingerprint)
- Wire `normalizedSubject` through `buildSupplierSendSubject`
- Leave From/To mailbox bare `normalizedEmail` to open #708 / MISE-005KM
- Leave order-message Notes: prep to open #847 / MISE-005PM

## Landing notes

Alone-OK with #708 / #681 / #425 / #847 / #840. Keep
`supplierSendSubjectIdentity.ts` separate from mailbox helpers in
`supplierSendContent.ts` (#708) and `generatedOrderMessageIdentity.ts` (#847).
When landing with #708, drop this tip’s assertion that main still uses bare
`function normalizedEmail(` / lacks `normalizeSupplierSendEmail(` once #708
owns that mailbox path.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
- Docker pgTAP unavailable in this environment
