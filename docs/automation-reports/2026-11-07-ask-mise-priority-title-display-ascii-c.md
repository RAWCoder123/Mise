# MISE-005ZE Ask Mise priority presentation.title ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-ask-mise-priority-title-display-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Ask Mise priority cards always rendered raw `presentation.title` into the
priority title Text. Operator-authored restaurant-task titles and
descriptor-less operational Today titles flow through
`presentOperationalTodayTask` without soft-null. Empty / Unicode-only-space
titles are non-nullish (and Unicode-only-space is truthy), so blank-looking
task identity appeared on Ask Mise priority cards with no intentional
localized none marker. Unicode `.trim()` on padded titles would invent a clean
display title. Open #1162 / #1161 / #1160 fixed sibling presentation.title
surfaces and explicitly left Ask Mise priority display alone.

## Fix

- Soft-null via `normalizeAskMisePriorityTitle` in
  `presentationAskMisePriorityTitleIdentity` (ASCII C single-line: end trim
  only; preserve NBSP; full C0/DEL reject) before the Ask Mise priority title
  Text render path.
- Soft-null falls through to localized `t("ask.priority.title.none")`
  (EN/ES/zh-Hans).
- Leave Home HomeTaskRow display presentation.title (#1162), Operating Plan
  Timeline display (#1161) and a11y (#1077), Task detail operational (#1160) /
  sharedTask.title (#1159), Home ActivityRow event.title (#1149), Create Task
  list title (#1152), `presentation.detail`, and `askMise` answer-text
  `topTaskTitles` interpolation alone.

## Verification

- focused `tests/askMisePriorityTitleDisplayAsciiC.test.ts` (83 assertion call
  sites counted from source; 6 tests)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1162` Home HomeTaskRow display presentation.title
- `#1161` Operating Plan Timeline display presentation.title
- `#1077` Operating Plan Timeline a11y presentation.title
- `#1160` Task detail operational presentation.title
- `#1159` Task detail sharedTask.title
- `#1149` Home ActivityRow event.title
- `services/ai/askMise.ts` answer-text `topTaskTitles` (separate tip)
- `presentation.detail` display Text
