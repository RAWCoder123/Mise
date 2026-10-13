# MISE-005PE floor-notes body ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-floor-notes-body-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Application `normalizeOperatorTaskBody` / `normalizeFloorNoteBody`
Unicode end-trimmed through `replace(/^\s+/, "").replace(/\s+$/, "")` and
collapsed per-line non-newline whitespace with `[^\S\n]+`. Em-space padding
invented a clean free-text body before local floor-note / operator-task rows
stored it (`'\u2003Ask prep\u2003'.replace(/^\s+/, "").replace(/\s+$/, "") ===
'Ask prep'`; mid-line em-space likewise collapsed into ordinary ASCII spaces).

## Change

- Add `services/application/floorNotesBodyIdentity.ts` with ASCII C
  multiline free-text prep (NBSP fold + C-end trim only; preserve internal
  LF/TAB/CR).
- Route `normalizeOperatorTaskBody` through soft
  `canonicalizeFloorNotesBody` (empty → `null`; soft truncate at 2000; no
  new throw on live create/migrate).
- Leave title / restaurantId / taskId paths alone (open #838 / #730 / #766).
- Focused inventing proofs in `tests/floorNotesBodyAsciiC.test.ts`.

## Verification

- Focused AsciiC + existing floorNotes: 14/14 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from #838 floor-notes title, #730 floor-note
restaurant, #766 floor-notes taskId, and restaurant-tasks detail (#823).
When landing with #838, drop #838's assertion that body still uses `\s`
end-trim / `[^\S\n]` collapse.
