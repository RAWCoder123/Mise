# MISE-005ZF Ask Mise answer-text topTaskTitles ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-ask-mise-answer-task-title-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Ask Mise briefing and general reply copy interpolated raw
`presentOperationalTodayTask(...).title` into answer-text `{tasks}` via
`topTaskTitles`. Operator-authored restaurant-task titles and descriptor-less
operational Today titles flow through `presentOperationalTodayTask` without
soft-null. Empty / Unicode-only-space titles are non-nullish (and
Unicode-only-space is truthy), so blank-looking task identity appeared inside
grounded answer copy with no intentional localized none marker. Unicode
`.trim()` on padded titles would invent a clean display title before join.
Open #1163 fixed the Ask Mise priority-card `presentation.title` Text and
explicitly left answer-text `topTaskTitles` alone.

## Fix

- Soft-null via `normalizeAskMiseAnswerTaskTitle` in
  `presentationAskMiseAnswerTaskTitleIdentity` (ASCII C single-line: end trim
  only; preserve NBSP; full C0/DEL reject) before joining into briefing /
  general answer-text `{tasks}`.
- Soft-null falls through to localized `t("ask.answer.taskTitle.none")`
  (EN/ES/zh-Hans).
- Leave Ask Mise priority-card display presentation.title (#1163), Home
  HomeTaskRow display presentation.title (#1162), Operating Plan Timeline
  display (#1161) and a11y (#1077), Task detail operational (#1160) /
  sharedTask.title (#1159), Home ActivityRow event.title (#1149), Create Task
  list title (#1152), and `presentation.detail` alone.

## Verification

- focused `tests/askMiseAnswerTaskTitleAsciiC.test.ts` (89 assertion call
  sites counted from source; 6 tests)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1163` Ask Mise priority presentation.title display
- `#1162` Home HomeTaskRow display presentation.title
- `#1161` Operating Plan Timeline display presentation.title
- `#1077` Operating Plan Timeline a11y presentation.title
- `#1160` Task detail operational presentation.title
- `#1159` Task detail sharedTask.title
- `#1149` Home ActivityRow event.title
- `presentation.detail` display Text
