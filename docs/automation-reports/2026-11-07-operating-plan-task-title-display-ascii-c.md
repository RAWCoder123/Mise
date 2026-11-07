# MISE-005ZC Operating Plan Timeline display presentation.title ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-operating-plan-task-title-display-ascii-c`  
Classification: controlled pilot-ready integrity tip (not App Store submission-ready)

## Problem

Today's OperatingPlanTimeline always rendered raw `presentation.title` into the
visible task-title Text. Operator-authored restaurant-task titles and
descriptor-less operational Today titles flow through
`presentOperatingPlanItem` / `presentOperationalTodayTask` without soft-null.
Empty / Unicode-only-space titles are non-nullish (and Unicode-only-space is
truthy), so blank-looking task identity appeared on the timeline with no
intentional localized none marker. Unicode `.trim()` on padded titles would
invent a clean display title. Open #1077 already pins the a11y interpolation of
the same field and explicitly deferred this display Text.

## Fix

- Soft-null via `normalizeOperatingPlanTaskTitleDisplay` in
  `presentationOperatingPlanTaskTitleDisplayIdentity` (ASCII C single-line: end
  trim only; preserve NBSP; full C0/DEL reject) before the timeline task-title
  Text render path.
- Soft-null falls through to localized `t("today.task.title.none")`
  (EN/ES/zh-Hans).
- Leave Operating Plan Timeline a11y presentation.title (#1077),
  presentation.detail a11y (#1078), Task detail operational presentation.title
  (#1160), Create Task / Activity / Phase Brief / Home Approvals a11y title
  tips, and Home / Ask Mise presentation.title surfaces alone.

## Verification

- focused `tests/operatingPlanTaskTitleDisplayAsciiC.test.ts` (77 assertion call
  sites counted from source; 6/6 passed)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Leave-alone

- `#1077` Operating Plan Timeline a11y presentation.title
- `#1078` Operating Plan Timeline a11y presentation.detail
- `#1160` Task detail operational presentation.title
- Home / Ask Mise presentation.title consumers
- `presentation.detail` display Text
