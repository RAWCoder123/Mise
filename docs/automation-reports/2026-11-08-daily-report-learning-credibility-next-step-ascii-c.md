# MISE-005ZS Daily Report learning.credibilityNextStep ASCII C

Date: 2026-11-08

## Summary

Daily Report Learning & credibility previously always passed raw
`learning.credibilityNextStep` into the metaLine Text when
`memoryNextStep` was nullish via `memoryNextStep ?? credibilityNextStep`.
That field is `summary.credibility.nextStep`. Empty / Unicode-only-space
credibility next steps rendered blank-looking learning meta copy; Unicode
`.trim()` on padded credibility next steps would invent a clean next-step
line. Non-null raw memoryNextStep still passes through unchanged (leave
#1176 alone).

## Changes

- Add `services/domain/presentationDailyReportLearningCredibilityNextStepIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls)
- Route Daily Report learning credibilityNextStep through
  `normalizeDailyReportLearningCredibilityNextStep` with localized
  `dailyReport.learning.credibilityNextStep.none` (EN Next step / ES Siguiente /
  zh-Hans 下一步) on the null-memoryNextStep fallthrough
- Non-null raw memoryNextStep still passes through unchanged
- Leave `memoryNextStep` (#1176), `memoryCopy` (#1175), advice action.title
  (#1173), action.detail (#1174), askBriefingText (#866), Insights
  How-Mise-knows nextStep (#1171) / operatorCopy (#1170), and Home
  ApprovalsSection card.title (#1049) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` and
  `null ?? "\u2003" === "\u2003"` previously still rendered as the metaLine
  Text with no localized none fallback
- `"\u2003Keep reviewing outcomes.\u2003".trim() === "Keep reviewing outcomes."`
  inventing equality
- ASCII C soft-null restores `dailyReport.learning.credibilityNextStep.none`

## Verification

- Focused `tests/dailyReportLearningCredibilityNextStepAsciiC.test.ts` (6/6; 102
  assertion call sites from source)
- `npm run typecheck`: passed
- `npm run security:static` + `security:backend`: passed
- `npm run design:static`: passed
- `npm test`: 689 total / 682 pass / 0 fail / 7 cancelled (inherited cancelled
  suite; no new failure)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
