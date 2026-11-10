# MISE-005ABY — Today floor-notes display note.title under ASCII C

Date: 2026-11-10  
Branch: `cursor/mise-today-floor-notes-title-display-ascii-c`  
Baseline: `origin/main` @ `78da7376`

## Summary

Pin Today hub floor-notes card display `note.title` through
`normalizeTodayFloorNotesTitleDisplay` (ASCII C single-line prep; soft-null on
empty / Unicode-padded / controls). Soft-null falls through to localized
`t("today.floorNotes.noteTitle.none")` (EN/ES/zh-Hans) so Unicode-only-space
cannot invent blank-looking floor-note identity and em-space / NBSP padding
cannot invent clean title equality via Unicode `.trim()`.

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered blank-looking card title Text
- `"\u2003Check walk-in\u2003".trim() === "Check walk-in"` inventing equality
- Prior always-pass path: `<Text style={styles.floorNoteTitle}>{note.title}</Text>`
- ASCII C soft-null restores intentional localized none copy

## Alone-OK

- Leave floor-notes row a11y `note.title` (#1084 / MISE-005XX) alone — that tip
  explicitly deferred display Text `{note.title}`
- Leave create-path `normalizeFloorNoteTitle` (#838) alone
- Leave floor-note body (#839) alone
- Leave Home HomeTaskRow display (#1162) and Timeline display (#1161) alone
- Ordinary conflict only on the Today display title Text line + new identity module

## Verification

- Focused `tests/todayFloorNotesTitleDisplayAsciiC.test.ts` (5/5; 66 assertion call sites from source)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` (688 total / 681 pass / 0 fail / 7 cancelled — inherited recalculationCycles timer flake; open #1183)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
