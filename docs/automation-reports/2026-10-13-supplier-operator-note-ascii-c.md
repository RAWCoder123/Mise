# MISE-005PF supplier operator_note ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-supplier-operator-note-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireSupplierOperatorNote`, orders UI
`operatorNote.trim()`, and demo `patch.operator_note?.trim()` Unicode-trimmed
supplier operator notes. Em-space padding invented a clean free-text body
before draft orders stored it
(`'\u2003Call on arrival\u2003'.trim() === 'Call on arrival'`).

## Change

- Add `services/domain/supplierOperatorNoteIdentity.ts` with ASCII C
  multiline free-text prep (NBSP fold + C-end trim only; preserve internal
  LF/TAB/CR).
- Route `requireSupplierOperatorNote` through fail-closed
  `normalizeCanonicalSupplierOperatorNote` (empty → `null`; over-long keeps
  the prior `2,000 characters` message; unsafe controls fail closed).
- Orders UI dirty-check / persist via soft `canonicalizeSupplierOperatorNote`
  and pass the raw note into `updateSupplierOrder` (no pre-inventing
  Unicode trim).
- Demo repository soft-canonicalizes operator_note patches.
- Leave count-line note helpers, `generatedOrderMessage` display trim, and
  open SQL cntrl pin #551 alone.
- Focused inventing proofs in `tests/supplierOperatorNoteAsciiC.test.ts`.

## Verification

- Focused AsciiC + ordersUi: 9/9 pass
- securityRemediation: 12/12 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from inventory count-line note (#827),
floor-notes body (#839), waste/deliveryHistory notes (#836/#837), and SQL
operator_note cntrl pin (#551). When landing with UI-dependent tips, keep the
ordersUi assertion that persist no longer uses `operatorNote.trim() || null`.
