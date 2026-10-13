# MISE-005PD floor-notes title ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-floor-notes-title-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Application `normalizeOperatorTaskTitle` / `normalizeFloorNoteTitle`
Unicode-trimmed and `\s`-collapsed titles via
`value.trim().replace(/\s+/g, " ")`. Em-space padding invented a clean
single-line title before local floor-note / operator-task rows stored it
(`'\u2003Check walk-in\u2003'.trim().replace(/\s+/g, " ") === 'Check walk-in'`).

## Change

- Add `services/application/floorNotesTitleIdentity.ts` with ASCII C
  display prep (NBSP fold + C whitespace collapse + ASCII space trim).
- Route `normalizeOperatorTaskTitle` through soft
  `canonicalizeFloorNotesTitle` (empty → `""`; soft truncate at 120; no
  new throw on live create/migrate).
- Leave `normalizeOperatorTaskBody` / restaurantId / taskId paths alone
  (open #730 / #766; body is a separate multiline free-text tip).
- Focused inventing proofs in `tests/floorNotesTitleAsciiC.test.ts`.

## Verification

- Focused AsciiC + existing floorNotes: 14/14 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK. Keep module separate from #730 floor-note restaurant, #766
floor-notes taskId, #822 restaurant-tasks title, and body free-text tips.
