# MISE-005ZG Task detail operational presentation.detail ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-task-detail-operational-detail-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Task detail always rendered raw `presentation.detail` into the operational
instructions body Text. When an operational Today task has no presentation
descriptor, `presentOperationalTodayTask` returns
`detail: \`${evidenceLabel}: ${task.detail}\`` as an evidence-prefixed
pass-through of the free-text task detail. Empty / Unicode-only-space free-text
details still produce a non-nullish, truthy instructions body
(`"Evidence: \u2003"`), so blank-looking task instructions appeared on Task
detail with no intentional localized none marker. Unicode `.trim()` on a padded
composed detail would invent by stripping trailing Unicode padding before
render; the free-text portion alone also invents fully via `.trim()`.

## Fix

- Soft-null via `normalizeTaskDetailOperationalDetail` in
  `presentationTaskDetailOperationalDetailIdentity` (ASCII C single-line: end
  trim only; preserve NBSP; full C0/DEL reject) before the operational
  instructions body Text render path.
- Soft-null falls through to localized `t("tasks.operational.detail.none")`
  (EN/ES/zh-Hans).
- Leave Task detail operational presentation.title (#1160), sharedTask.title
  (#1159), sharedTask.detail (#1025), Operating Plan Timeline a11y
  presentation.detail (#1078), Timeline display / a11y title (#1161 / #1077),
  Home / Ask Mise presentation.title consumers, and Insights signal
  presentation.detail alone.

## Verification

- focused `tests/taskDetailOperationalDetailAsciiC.test.ts` (assertion call
  sites counted from source: 79)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1160` Task detail operational presentation.title
- `#1159` Task detail sharedTask.title
- `#1025` Task detail sharedTask.detail / `tasks.shared.noInstructions`
- `#1078` Operating Plan Timeline a11y presentation.detail
- Home / Ask Mise / Timeline presentation.title consumers
- Insights signal `presentation.detail`
