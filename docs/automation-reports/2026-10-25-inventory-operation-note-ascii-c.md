# MISE-005PT inventory-operation note ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-inventory-operation-note-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireInventoryOperation` routed notes through
`optionalBoundedText` Unicode `.trim()`, and the inventory detail screen
pre-trimmed with `noteText.trim() || undefined`. Em-space / NBSP padding
invented a clean free-text body before the note was stored in ledger
metadata
(`'\u2003Chilled on arrival\u2003'.trim() === 'Chilled on arrival'`).

## Change

- Add `INVENTORY_OPERATION_NOTE_MAX_CHARACTERS = 500` to
  `services/domain/securityLimits.ts`.
- Add `services/domain/inventoryOperationNoteIdentity.ts` with ASCII C
  multiline free-text prep (NBSP fold + C-end trim only; preserve internal
  LF/TAB/CR).
- Route `requireInventoryOperation` note through fail-closed
  `normalizeCanonicalInventoryOperationNote` (empty → `null`; over-long keeps
  the prior `Enter a shorter note.` message; unsafe controls fail closed with
  `Enter a valid note.`).
- Inventory detail UI submit via soft `canonicalizeInventoryOperationNote`
  (no pre-inventing Unicode trim).
- Leave `sourceReference` / `reasonCode` on `optionalBoundedText` Unicode
  trim, and leave count-line / count-session / supplier operator_note tips
  alone.
- Focused inventing proofs in `tests/inventoryOperationNoteAsciiC.test.ts`.

## Verification

- Focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: see commit evidence
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from inventory count-line note (#827 / #846),
count-session note (#845), supplier operator_note (#840), and floor-notes /
waste / deliveryHistory free-text tips. When landing with sibling tips, keep
the assertion that `sourceReference` / `reasonCode` still call
`optionalBoundedText` until those paths are tipped separately.
