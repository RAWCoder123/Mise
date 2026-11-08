# MISE-005ZP: pin Daily Report advice action.detail to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-daily-report-advice-action-detail-ascii-c`

## Problem

Daily Report closeout advice rows always passed raw `action.detail` into the
summaryCopy Text. Ranked actions can carry untrusted details from attention
cards (`card.detail`) and urgent insights
(`recommended_action || description`). Empty / Unicode-only-space details
rendered blank-looking advice body copy; Unicode `.trim()` on padded details
would invent a clean advice detail label.

## Fix

- Add `services/domain/presentationDailyReportAdviceActionDetailIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls)
- Route Daily Report advice-row details through
  `normalizeDailyReportAdviceActionDetail` with localized
  `dailyReport.advice.actionDetail.none` (EN Details / ES Detalles / zh-Hans 详情)
- Leave `action.title` (#1173 / MISE-005ZO), askBriefingText (#866), learning
  memoryCopy / memoryNextStep, Home ApprovalsSection card.title (#1049), and
  Insights How-Mise-knows memory tips (#1170 / #1171) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the summaryCopy Text
  with no localized none fallback
- `"\u2003Review critical coverage before the next service\u2003".trim() ===
  "Review critical coverage before the next service"` inventing equality
- ASCII C soft-null restores `dailyReport.advice.actionDetail.none`

## Verification

- Focused `tests/dailyReportAdviceActionDetailAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test`
- `npm run design:static`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
