# MISE-005PC deliveryHistory note ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-delivery-history-note-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Application `mergeDeliveryHistoryEntries` / `noteFromMetadata` Unicode-trimmed
receipt `metadata.note` via `note.trim()`. Em-space padding invented a clean
free-text body (`'\u2003Morning drop\u2003'.trim() === 'Morning drop'`).

## Change

- Add `services/application/deliveryHistoryNoteIdentity.ts` with ASCII C
  multiline free-text prep (NBSP fold + C-end trim only; preserve internal
  LF/TAB/CR).
- Route `noteFromMetadata` through soft `canonicalizeDeliveryHistoryNote`
  (empty → `null`; no new soft truncate; evidence/merge does not newly throw).
- Leave wasteAnalysis / supplierReliability delivery-notes paths alone
  (open #836 / #835).
- Focused inventing proofs in `tests/deliveryHistoryNoteAsciiC.test.ts`.

## Verification

- Focused AsciiC + deliveryHistory: 9/9 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles timer flake)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from #836 waste notes, #835 supplierReliability
delivery notes, #827 count-line notes, and restaurantId tip stacks.
