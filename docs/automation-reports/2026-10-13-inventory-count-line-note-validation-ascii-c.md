# MISE-005PL miseValidation inventory count-line note ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-inventory-count-line-note-validation-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireInventoryCountLineNote` (fed by application
`saveInventoryCountLines` via `requireInventoryCountLineUpdates`)
Unicode-trimmed count-line notes. Em-space / NBSP padding invented a clean
free-text body before save-line writes stored it
(`'\u2003Spill during prep\u2003'.trim() === 'Spill during prep'`).

## Change

- Add `services/domain/inventoryCountLineNoteIdentity.ts` with ASCII C
  multiline free-text prep (NBSP fold + C-end trim only; preserve internal
  LF/TAB/CR).
- Route `requireInventoryCountLineNote` through fail-closed
  `normalizeCanonicalInventoryCountLineNote` (empty → `null`; over-long
  keeps the prior `240 characters` message; unsafe controls fail closed).
- Leave miseValidation `requireInventoryCountSessionNote`, domain count-line
  note tip #827 / MISE-005OS Unicode-trim contracts, `generatedOrderMessage`
  display trim, inventoryItemId Map-key trim, and open SQL cntrl pin #552 /
  MISE-005EN alone.
- Focused inventing proofs in
  `tests/inventoryCountLineNoteValidationAsciiC.test.ts`.

## Verification

- Focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 687 pass / 0 fail
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with open domain tip #827 / MISE-005OS: both introduce
`inventoryCountLineNoteIdentity.ts` with the same canonical/normalize helpers;
on land, keep one module and wire both domain merge/plan and miseValidation
require. Keep module separate from count-session opening note (#845), supplier
operator_note (#840), and SQL count-note cntrl pin (#552). When landing with
#845, drop #845's assertion that miseValidation line-note helpers still
Unicode-trim. When landing with #827, drop this tip's assertion that domain
merge/plan still Unicode-trims, and drop #827's assertion that miseValidation
count-note helpers still Unicode-trim.
