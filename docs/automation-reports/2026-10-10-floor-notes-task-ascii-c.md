# MISE-005MJ: pin floor-notes taskId to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-floor-notes-task-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins floor-notes / operator-task application `completeOperatorTask` and
`reopenOperatorTask` `taskId` (and `completeFloorNote` via `noteId`) to
ASCII-only end trim so NBSP/em-space padding cannot invent a normalized task
identity before AsyncStorage complete/reopen writes.

- Adds `services/domain/floorNotesObjectIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes complete/reopen `taskId` through `requireCanonicalFloorNotesTaskId`.
- Preserves `Missing operator task id.` for inventing/invalid tokens.
- Leaves restaurant workspace on Unicode trim (owned by #730 / MISE-005LA).
- Leaves title/body/dueAt normalize surfaces alone.
- Non-UUID generated tokens intentionally preserved (no UUID shape gate).

## Merge note

When landing with #730, keep both restaurant and task branches in
`floorNotes.ts`. Drop any assertion that `input.taskId.trim()` still Unicode-
trims on complete/reopen; this tip owns that object identity. #730 owns
restaurant `Missing restaurant workspace.` / `requireCanonicalFloorNoteRestaurantId`.

## Verification

- `tests/floorNotesObjectAsciiC.test.ts`: 4/4
- `tests/floorNotes.test.ts`: 9/9
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)

## Do not

- Re-tip this floor-notes taskId object path after merge.
- Bundle restaurant (#730) or sibling object tips in the same PR.
- Rewrite restaurant `restaurantId.trim()` / workspace helpers in this tip.
- Add UUID shape requirement on this object path (generated tokens use prefixes).
