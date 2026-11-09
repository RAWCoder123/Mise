# MISE-005ABG Daily Report closeout day.restaurantName ASCII C

Date: 2026-11-09

## Summary

Soft-null empty / Unicode-padded / control-bearing `day.restaurantName` before
rendering the Daily Report closeout title so blank-looking or Unicode-trimmed
restaurant identity cannot invent clean title text. Present-but-unsafe values
fall through to localized `dailyReport.day.restaurantName.none`.

## Inventing proof

- Prior always-pass
  `<Text style={styles.closeoutTitle}>{visibleReport.day.restaurantName}</Text>`
- `buildDailyOpsReport` assigns opaque free-string `restaurantName` into
  `day.restaurantName`
- Unicode-only-space blank-looking closeout title (`Boolean("\u2003") === true`)
- Unicode trim invents clean restaurant name
  (`"\u2003Harbor Kitchen\u2003".trim() === "Harbor Kitchen"`)
- Soft-null restores localized `dailyReport.day.restaurantName.none` while
  sibling `day.miseStatus` / `operatingSummary` still receive raw values on this tip

## Changes

- `services/domain/presentationDailyReportDayRestaurantNameIdentity.ts`
- `app/more/daily-report.tsx`
- `i18n/catalog.ts` — EN/ES/zh-Hans `dailyReport.day.restaurantName.none`
- `tests/dailyReportDayRestaurantNameAsciiC.test.ts`
- This report

## Ownership

Owns only Daily Report closeout title `day.restaurantName` →
`dailyReport.day.restaurantName.none`. Leaves Daily Report Badge `day.miseStatus`
(#1215), Ask Mise briefing.lead restaurant.name (#1211), Ask Mise thinkingSteps
restaurant.name (#1210), Daily Report operatingSummary / date Badge, and
learning.credibilityLabel (#1203) alone.

## Verification

- Focused `tests/dailyReportDayRestaurantNameAsciiC.test.ts` 5/5
  (80 assertion call sites counted from source)
- `npm run typecheck` passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled
  (inherited `withTimeout cancelledByParent`; fixed in #1183, not landed)
- No migration
