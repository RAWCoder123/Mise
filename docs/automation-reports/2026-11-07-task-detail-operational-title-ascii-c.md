# MISE-005ZB Task detail operational presentation.title ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-task-detail-operational-title-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Task detail always rendered raw `presentation.title` into the operational hero
title Text. When an operational Today task has no presentation descriptor,
`presentOperationalTodayTask` returns `title: task.title` as a raw
pass-through. Empty / Unicode-only-space titles are non-nullish (and
Unicode-only-space is truthy), so blank-looking task identity appeared on Task
detail with no intentional localized none marker. Unicode `.trim()` on padded
titles would invent a clean display title.

## Fix

- Soft-null via `normalizeTaskDetailOperationalTitle` in
  `presentationTaskDetailOperationalTitleIdentity` (ASCII C single-line: end
  trim only; preserve NBSP; full C0/DEL reject) before the operational hero
  title Text render path.
- Soft-null falls through to localized `t("tasks.operational.title.none")`
  (EN/ES/zh-Hans).
- Leave Task detail sharedTask.title (#1159), Create Task list/choice tips
  (#1152/#1153), Operating Plan Timeline a11y presentation.title (#1077),
  Create Task list-row a11y (#1072), form save-path title (#880),
  restaurant-tasks domain title (#822), Home / Ask Mise presentation.title
  surfaces, and `presentation.detail` alone.

## Verification

- focused `tests/taskDetailOperationalTitleAsciiC.test.ts` (assertion call sites
  counted from source: 76)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1159` Task detail sharedTask.title
- `#1152` / `#1153` Create Task title display tips
- `#1077` Operating Plan Timeline a11y presentation.title
- Home Approvals / Ask Mise presentation.title consumers
- `presentation.detail`
