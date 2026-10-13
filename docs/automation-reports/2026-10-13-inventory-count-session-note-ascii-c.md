# MISE-005PK inventory count-session opening note ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-inventory-count-session-note-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireInventoryCountSessionNote` (fed by application
`beginInventoryCountSession`) Unicode-trimmed count-session opening notes.
Em-space / NBSP padding invented a clean free-text body before begin-session
writes stored it
(`'\u2003Count before lunch rush\u2003'.trim() === 'Count before lunch rush'`).

## Change

- Add `services/domain/inventoryCountSessionNoteIdentity.ts` with ASCII C
  multiline free-text prep (NBSP fold + C-end trim only; preserve internal
  LF/TAB/CR).
- Route `requireInventoryCountSessionNote` through fail-closed
  `normalizeCanonicalInventoryCountSessionNote` (empty → `null`; over-long
  keeps the prior `240 characters` message; unsafe controls fail closed).
- Leave miseValidation `requireInventoryCountLineNote`, domain count-line note
  tip #827 / MISE-005OS, `generatedOrderMessage` display trim, and open SQL
  cntrl pin #552 / MISE-005EN alone.
- Focused inventing proofs in `tests/inventoryCountSessionNoteAsciiC.test.ts`.

## Verification

- Focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited withTimeout hang cancellations)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from inventory count-line note (#827),
supplier operator_note (#840), and SQL count-note cntrl pin (#552). When
landing with #827, keep the assertion that miseValidation line-note helpers
still Unicode-trim until their own tip.
