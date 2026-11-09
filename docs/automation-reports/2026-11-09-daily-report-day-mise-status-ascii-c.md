# MISE-005ABD Daily Report Badge day.miseStatus ASCII C

Date: 2026-11-09
Branch: `cursor/mise-daily-report-day-mise-status-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Daily Report closeout previously always passed raw `day.miseStatus` into the
warning Badge via `<Badge label={visibleReport.day.miseStatus} tone="warning" />`.
That field is `summary.miseStatus`. Empty / Unicode-only-space statuses rendered
blank-looking status identity on the Daily Report closeout Badge; Unicode
`.trim()` on padded statuses would invent a clean status label.

Open #1214 pins Ask Mise briefing.lead `{status}` only and left Daily Report
Badge `day.miseStatus` raw. Open #264 / #256 localize known Ready/Watch/
Attention / monitoring strings but do not pin Daily Report Badge presentation
under ASCII C (and #264's `.trim()` path would invent).

## Changes

- Add `services/domain/presentationDailyReportDayMiseStatusIdentity.ts`
  (single-line ASCII C end trim; preserve NBSP; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route Daily Report Badge `day.miseStatus` through
  `normalizeDailyReportDayMiseStatus` with localized
  `dailyReport.day.miseStatus.none` (EN Unknown / ES Desconocido / zh-Hans 未知)
  on soft-null
- Leave Ask Mise briefing.lead status (#1214), Ask Mise briefing.lead
  restaurant.name (#1211), Daily Report restaurantName / operatingSummary, the
  closeout date Badge, learning.credibilityLabel (#1203), and Ask Mise /
  Daily Report miseStatus i18n (#264 / #256) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the Badge label
  with no localized none fallback
- `"\u2003Watch\u2003".trim() === "Watch"` inventing equality
- ASCII C soft-null restores `dailyReport.day.miseStatus.none`

## Alone-OK

No migration. Alone-OK on main beside #1214 / #1211 / #1203 / #264 / #256;
ordinary conflicts possible only if another tip rewrites the same Daily Report
Badge `day.miseStatus` interpolation or the shared `app/more/daily-report.tsx`
import block. Does not share identity modules with those tips.

## Verification

- Focused `tests/dailyReportDayMiseStatusAsciiC.test.ts`: 5/5
  (74 assertion call sites counted from source)
- `npm run typecheck`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles withTimeout cancelledByParent; fixed in #1183, not landed)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
