# MISE-005AAX Ask Mise answer-text attentionTitles ASCII C

Date: 2026-11-09

## Summary

Ask Mise stock and orders replies interpolated raw `attentionCards[].title`
into answer copy via `attentionTitles.join("; ")`. Empty / Unicode-only-space
titles are truthy and rendered blank-looking inside grounded replies; Unicode
`.trim()` on padded titles would invent a clean attention label.

## Fix

- Add `services/domain/presentationAskMiseAnswerAttentionTitleIdentity.ts`
  (ASCII C single-line prep; soft-null empty / Unicode-padded / controls)
- Soft-null Ask Mise answer-text `attentionTitles` through
  `normalizeAskMiseAnswerAttentionTitle` with localized
  `ask.answer.attentionTitle.none` (EN / ES / zh-Hans)
- Focused inventing / fallback-bypass proofs in
  `tests/askMiseAnswerAttentionTitleAsciiC.test.ts`

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still joined into `{items}`
- `"\u2003Chicken thigh low\u2003".trim() === "Chicken thigh low"` inventing
  equality with a clean attention title
- ASCII C soft-null restores `ask.answer.attentionTitle.none`

## Leave alone

- Home ApprovalsSection card.title (#1049 / MISE-005WO)
- Ask Mise answer-text topTaskTitles (#1164 / MISE-005ZF)
- Ask Mise priority-list presentation.title (#1163)
- Ask Mise greeting restaurant.name (#1045) / firstName (#961)
- Insights InsightListRow presentation.title (#1185)
- Daily Brief Board finding.title (#1145)
- Ask Mise message.title / bubble chrome on `app/ask-mise.tsx`

## Verification

- Focused tip tests: 1/1 (67 assertion call sites counted from source)
- `npm run typecheck`: passed
- `npm test`: see PR notes
- No migration

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
