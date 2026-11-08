# MISE-005ZO: pin Daily Report advice action.title to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-daily-report-advice-action-title-ascii-c`

## Problem

Daily Report closeout advice rows always passed raw `action.title` into the
adviceTitle Text. Ranked actions can carry untrusted titles from attention
cards and urgent insights. Empty / Unicode-only-space titles rendered
blank-looking advice identity; Unicode `.trim()` on padded titles would invent
a clean advice label.

## Fix

- Add `services/domain/presentationDailyReportAdviceActionTitleIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls)
- Route Daily Report advice-row titles through
  `normalizeDailyReportAdviceActionTitle` with localized
  `dailyReport.advice.actionTitle.none` (EN Advice / ES Consejo / zh-Hans 建议)
- Leave `action.detail`, askBriefingText (#866), learning memoryCopy /
  memoryNextStep, Home ApprovalsSection card.title (#1049), and Insights
  How-Mise-knows memory tips (#1170 / #1171) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the adviceTitle Text
  with no localized none fallback
- `"\u2003Review chicken coverage\u2003".trim() === "Review chicken coverage"`
  inventing equality
- ASCII C soft-null restores `dailyReport.advice.actionTitle.none`

## Verification

- Focused `tests/dailyReportAdviceActionTitleAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm test`
- `npm run design:static`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
