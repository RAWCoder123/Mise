# MISE-005ZR Daily Report learning.memoryNextStep ASCII C

Date: 2026-11-08

## Summary

Daily Report Learning & credibility previously always passed raw
`learning.memoryNextStep` into the metaLine Text when non-nullish via
`memoryNextStep ?? credibilityNextStep`. That field is
`learningMemory?.nextStep ?? null` — free-text restaurant learning evidence.
Empty / Unicode-only-space next steps rendered blank-looking learning meta
copy; Unicode `.trim()` on padded next steps would invent a clean next-step
line. Null raw memoryNextStep still falls through to credibilityNextStep.

## Changes

- Add `services/domain/presentationDailyReportLearningMemoryNextStepIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls)
- Route Daily Report learning memoryNextStep through
  `normalizeDailyReportLearningMemoryNextStep` with localized
  `dailyReport.learning.memoryNextStep.none` (EN Next step / ES Siguiente /
  zh-Hans 下一步) when the raw field is present-but-unsafe
- Null raw memoryNextStep still falls through to credibilityNextStep
- Leave `credibilityNextStep`, `memoryCopy` (#1175), advice action.title
  (#1173), action.detail (#1174), askBriefingText (#866), Insights
  How-Mise-knows nextStep (#1171) / operatorCopy (#1170), and Home
  ApprovalsSection card.title (#1049) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` and `"\u2003" ?? credibilityNextStep === "\u2003"`
  previously still rendered as the metaLine Text with no localized none
  fallback
- `"\u2003Review the next Friday.\u2003".trim() === "Review the next Friday."`
  inventing equality
- ASCII C soft-null restores `dailyReport.learning.memoryNextStep.none`

## Verification

- Focused `tests/dailyReportLearningMemoryNextStepAsciiC.test.ts` (6/6; 95
  assertion call sites from source)
- `npm run typecheck`: passed
- `npm run security:static` + `security:backend`: passed
- `npm run design:static`: passed
- `npm test`: 689 total / 682 pass / 0 fail / 7 cancelled (inherited cancelled
  suite; no new failure)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
