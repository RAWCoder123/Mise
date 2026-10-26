# MISE-005QZ Log Delivery note ASCII C (2026-10-26)

## Summary

`app/more/log-delivery.tsx` Unicode-trimmed the operator delivery note before
`queueInventoryOperation` (`note: noteText.trim() || undefined`), so NBSP /
em-space padding invented equality with a clean free-text note
(`'\u2003Chilled on arrival\u2003'.trim() === 'Chilled on arrival'`).

## Change

- Reuse `services/domain/inventoryOperationNoteIdentity.ts` (MISE-005PT / open
  #854) — do not invent a second log-delivery identity module
- Add `INVENTORY_OPERATION_NOTE_MAX_CHARACTERS = 500` so the shared module can
  load (identical to #854)
- Wire Log Delivery submit through soft `canonicalizeInventoryOperationNote`
- Leave inventory detail UI `noteText.trim()` and
  `requireInventoryOperation` `optionalBoundedText(input.note, ...)` to open
  #854
- Leave count-sheet / count-line / supplier operator_note tips alone

## Alone-OK merge notes

Alone-OK with open #854. Keep `inventoryOperationNoteIdentity.ts` and the
`INVENTORY_OPERATION_NOTE_MAX_CHARACTERS` constant byte-identical to #854.
This tip owns only `app/more/log-delivery.tsx`. When landing with #854, drop
this tip's assertions that inventory detail still Unicode-trims and that
`requireInventoryOperation` still routes notes through `optionalBoundedText`
once #854 owns those paths. Do not tip #854 as covering Log Delivery; do not
tip this as a substitute for #854.

## Verification

- focused `tests/logDeliveryNoteAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
