# MISE-005ZQ Daily Report learning.memoryCopy ASCII C

Date: 2026-11-08

## Summary

Daily Report Learning & credibility previously truthy-gated and always passed raw
`learning.memoryCopy` into the summaryCopy Text. That field is
`learningMemory?.operatorCopy ?? null` — free-text restaurant learning evidence.
Empty / Unicode-only-space copies rendered blank-looking learning body copy;
Unicode `.trim()` on padded copies would invent a clean learning summary.

## Changes

- Add `services/domain/presentationDailyReportLearningMemoryCopyIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls)
- Route Daily Report learning memoryCopy through
  `normalizeDailyReportLearningMemoryCopy` with localized
  `dailyReport.learning.memoryCopy.none` (EN Summary / ES Resumen / zh-Hans 摘要)
  when the raw field is present-but-unsafe
- Null raw memoryCopy (no learning memory) still omits the Text
- Leave `memoryNextStep` / `credibilityNextStep`, advice action.title (#1173),
  action.detail (#1174), askBriefingText (#866), Insights How-Mise-knows
  operatorCopy (#1170) / nextStep (#1171), and Home ApprovalsSection card.title
  (#1049) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the summaryCopy Text
  with no localized none fallback
- `"\u2003Friday dinner demand is usually higher.\u2003".trim() ===
  "Friday dinner demand is usually higher."` inventing equality
- ASCII C soft-null restores `dailyReport.learning.memoryCopy.none`

## Verification

- Focused `tests/dailyReportLearningMemoryCopyAsciiC.test.ts` (6/6; 87 assertion
  call sites from source)
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
