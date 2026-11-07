# MISE-005ZD Home HomeTaskRow display presentation.title ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-home-task-row-title-display-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Home Top-tasks `HomeTaskRow` always rendered raw `presentation.title` into
`OperationalRow`. Operator-authored restaurant-task titles and descriptor-less
operational Today titles flow through `presentOperationalTodayTask` without
soft-null. Empty / Unicode-only-space titles are non-nullish (and
Unicode-only-space is truthy), so blank-looking task identity appeared on Home
Top-tasks rows with no intentional localized none marker. Unicode `.trim()` on
padded titles would invent a clean display title. Open #1161 / #1160 fixed
sibling presentation.title surfaces and explicitly left Home / Ask Mise alone.

## Fix

- Soft-null via `normalizeHomeTaskRowTitleDisplay` in
  `presentationHomeTaskRowTitleDisplayIdentity` (ASCII C single-line: end trim
  only; preserve NBSP; full C0/DEL reject) before the HomeTaskRow
  OperationalRow title prop.
- Soft-null falls through to localized `t("home.tasks.row.title.none")`
  (EN/ES/zh-Hans).
- Leave Ask Mise priority presentation.title, Operating Plan Timeline display
  (#1161) and a11y (#1077), Task detail operational (#1160) /
  sharedTask.title (#1159), Home ActivityRow event.title (#1149), Create Task
  list title (#1152), and `presentation.detail` alone.

## Verification

- focused `tests/homeTaskRowTitleDisplayAsciiC.test.ts` (80 assertion call
  sites counted from source; 6 tests)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- Ask Mise priority `presentation.title` display (next inventing tip)
- `#1161` Operating Plan Timeline display presentation.title
- `#1077` Operating Plan Timeline a11y presentation.title
- `#1160` Task detail operational presentation.title
- `#1159` Task detail sharedTask.title
- `#1149` Home ActivityRow event.title
- `presentation.detail` display Text
