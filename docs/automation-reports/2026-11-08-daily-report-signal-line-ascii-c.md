# MISE-005ZU: pin Daily Report signal.line to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-daily-report-signal-line-ascii-c`  
Baseline: `origin/main` @ `78da7376`

## Summary

Daily Report closeout always passed raw `signal.line` into the signal-row
Text. Those lines come from free-form insight fields via `pickSignalLine`
(`recommended_action` / `why_it_matters` trimmed, then
`description` / `title` fallthrough). Empty / Unicode-only-space descriptions
rendered blank-looking signal bodies; Unicode `.trim()` on padded action/why
fields would invent a clean signal line before display.

## Changes

- Add `services/domain/presentationDailyReportSignalLineIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls)
- Route Daily Report `{signal.line}` through
  `normalizeDailyReportSignalLine` so unsafe lines fall through to new
  localized `dailyReport.signal.line.none` (EN / ES / zh-Hans)
- Leave advice action.title (#1173) / action.detail (#1174), askBriefingText
  (#866), learning memoryCopy / memoryNextStep / credibilityNextStep
  (#1175–#1177), credibilityLabel (#258), Insights signal presentation tips
  (#1166–#1168), and empty closeout placeholder localization (#258) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the full
  signalLine Text with no localized none fallback
- `"\u2003Review waste before closeout\u2003".trim() === "Review waste before closeout"`
  inventing equality (domain action/why trim path)
- Source path: `pickSignalLine` → insight free-form fields → always-pass
  `{signal.line}`
- ASCII C soft-null restores `dailyReport.signal.line.none`

## Verification

- Focused `tests/dailyReportSignalLineAsciiC.test.ts` — 5/5
- Assertion call sites counted from source: **61**
- `npm run typecheck` — passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited `recalculationCycles`)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
