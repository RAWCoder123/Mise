# MISE-005XX: pin Today floor-notes row a11y note.title to ASCII C

Date: 2026-11-04

## Defect

Today floor-notes row accessibility always passed raw `note.title` into
`today.floorNotes.rowAccessibility`. Empty and Unicode-only-space titles are
non-nullish (and Unicode-only-space is truthy), so VoiceOver / TalkBack could
announce blank-looking floor-note identity with no intentional localized none
marker. Separately, Unicode `.trim()` on NBSP / em-space padding would invent a
clean a11y title token.

## Fix

- Soft-null via `normalizeTodayFloorNotesRowTitle` (ASCII C single-line: end
  trim only; preserve NBSP; full C0/DEL reject).
- Soft-null falls through to localized `t("today.floorNotes.rowTitle.none")`
  (EN/ES/zh-Hans).

## Alone-OK

Leave display Text `{note.title}`, floor-note body, create-path
`normalizeFloorNoteTitle` / #838, Create Task list-row a11y title (#1072), and
Activity expand a11y title (#1071) alone.

## Verification

- Focused `tests/todayFloorNotesRowTitleAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
