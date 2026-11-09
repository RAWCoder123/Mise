# MISE-005ABA Ask Mise prep/waste insight titles ASCII C

Date: 2026-11-09

## Summary

Ask Mise prep and waste replies interpolated raw `presentInsight(...).title`
into answer copy via `prepTitles` / `wasteTitles` joins. Structured insight
rules embed free-form menu / inventory item names into those titles. Empty /
Unicode-only-space / Unicode-padded item names still produce truthy composed
titles that rendered blank-looking inside grounded replies; Unicode `.trim()`
on padded composed titles would invent a clean insight label.

## Fix

- Add `services/domain/presentationAskMisePrepWasteInsightTitleIdentity.ts`
  (ASCII C single-line prep; soft-null empty / Unicode-padded / controls)
- Soft-null Ask Mise answer-text prep / waste insight titles through
  `normalizeAskMisePrepWasteInsightTitle` with localized
  `ask.answer.prepWasteInsightTitle.none` (EN / ES / zh-Hans)
- Focused inventing / fallback-bypass proofs in
  `tests/askMisePrepWasteInsightTitleAsciiC.test.ts`

## Inventing / bypass proof

- `"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"` inventing of the
  free-form menu name before template composition
- `"\u2003Chicken Bowl depends on low stock\u2003".trim() === "Chicken Bowl depends on low stock"`
  inventing equality with a clean composed prep title
- Unicode-padded / Unicode-only-space menu names still compose truthy titles
  (`"\u2003Chicken Bowl\u2003 depends on low stock"`, `"\u2003 depends on low stock"`)
  that previously joined into `{items}`
- ASCII C soft-null restores `ask.answer.prepWasteInsightTitle.none`
- Distinct from Insights InsightListRow presentation.title (#1185): Ask Mise
  sales `presentedInsight.title` path left raw on this tip

## Leave alone

- Insights InsightListRow presentation.title (#1185 / MISE-005ZZ)
- Ask Mise answer-text attentionTitles (#1209 / MISE-005AAX)
- Ask Mise answer-text topTaskTitles (#1164 / MISE-005ZF)
- Ask Mise sales / priorities / briefing `presentedInsight.title`
- Ask Mise greeting restaurant.name (#1045) / firstName (#961)
- Daily Brief Board finding.title (#1145)
- Ask Mise message.title / bubble chrome on `app/ask-mise.tsx`

## Verification

- Focused tip tests: 1/1 (85 assertion call sites counted from source)
- `npm run typecheck`: required
- `npm test`: see PR notes
- No migration

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
