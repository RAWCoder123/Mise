# MISE-005ABH Daily Report closeout day.operatingSummary ASCII C

Date: 2026-11-09

## Summary

Soft-null empty / Unicode-padded / control-bearing `day.operatingSummary` before
rendering the Daily Report closeout summaryCopy so blank-looking or
Unicode-trimmed operating-summary identity cannot invent clean summary text.
Present-but-unsafe values fall through to localized
`dailyReport.day.operatingSummary.none` (EN Summary / ES Resumen / zh-Hans 摘要).
Uses operator_note-style multiline allowlist (preserve LF/TAB/CR; fold NBSP).

## Inventing proof

- Prior always-pass
  `<Text style={styles.summaryCopy}>{visibleReport.day.operatingSummary}</Text>`
- `buildDailyOpsReport` assigns opaque free-string `summary.operatingSummary`
  into `day.operatingSummary`
- Unicode-only-space blank-looking summaryCopy (`Boolean("\u2003") === true`)
- Unicode trim invents clean operating summary
  (`"\u2003Two items need attention before tomorrow.\u2003".trim() ===
  "Two items need attention before tomorrow."`)
- Soft-null restores localized `dailyReport.day.operatingSummary.none` while
  sibling `day.restaurantName` / `day.miseStatus` still receive raw values on
  this tip

## Changes

- `services/domain/presentationDailyReportDayOperatingSummaryIdentity.ts`
- `app/more/daily-report.tsx`
- `i18n/catalog.ts` — EN/ES/zh-Hans `dailyReport.day.operatingSummary.none`
- `tests/dailyReportDayOperatingSummaryAsciiC.test.ts`
- This report

## Ownership

Owns only Daily Report closeout summaryCopy `day.operatingSummary` →
`dailyReport.day.operatingSummary.none`. Leaves Daily Report closeout
`day.restaurantName` (#1218), Daily Report Badge `day.miseStatus` (#1215),
Daily Report `signal.line` (#1179), advice `action.detail` (#1174), learning
`memoryCopy` (#1175), Ask Mise briefing.lead status (#1214), closeout date
Badge, and operatingSummary attention-template i18n (#257) alone.

## Verification

- Focused `tests/dailyReportDayOperatingSummaryAsciiC.test.ts` 5/5
  (87 assertion call sites counted from source)
- `npm run typecheck` passed
- `npm test` — see tip commit notes
- No migration
