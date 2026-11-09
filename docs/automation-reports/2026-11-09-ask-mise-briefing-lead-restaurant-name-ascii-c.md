# MISE-005AAZ Ask Mise briefing.lead restaurant.name ASCII C

Date: 2026-11-09

## Summary

Ask Mise briefing answers interpolated raw `restaurant.name` into
`ask.answer.briefing.lead`. Empty / Unicode-only-space names are truthy and
rendered blank-looking inside grounded briefing copy; Unicode `.trim()` on
padded names would invent a clean restaurant identity.

## Fix

- Add `services/domain/presentationAskMiseBriefingLeadRestaurantNameIdentity.ts`
  (ASCII C single-line prep; soft-null empty / Unicode-padded / controls)
- Soft-null Ask Mise briefing.lead restaurant names through
  `normalizeAskMiseBriefingLeadRestaurantName` with localized
  `ask.answer.briefing.lead.none` (EN / ES / zh-Hans)
- Focused inventing / fallback-bypass proofs in
  `tests/askMiseBriefingLeadRestaurantNameAsciiC.test.ts`

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still interpolated into
  `ask.answer.briefing.lead`
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality with
  a clean restaurant name
- ASCII C soft-null restores `ask.answer.briefing.lead.none`

## Leave alone

- Ask Mise greeting.body restaurant.name (#1045 / MISE-005WK)
- Ask Mise greeting firstName (#961 / MISE-005TW)
- Ask Mise thinkingSteps restaurant.name (#1210 / MISE-005AAY)
- Home greeting restaurant.name (#1044 / MISE-005WJ)
- Autonomy subtitle restaurant.name (#1043 / MISE-005WI)
- Ask Mise answer-text attentionTitles (#1209 / MISE-005AAX)
- Ask Mise answer-text topTaskTitles (#1164 / MISE-005ZF)
- Ask Mise message.title / bubble chrome on `app/ask-mise.tsx`

## Verification

- Focused tip tests: 1/1 (79 assertion call sites counted from source)
- `npm run typecheck`: passed
- `npm test`: 684 total / 677 pass / 0 fail / 7 cancelled (inherited
  withTimeout cancelledByParent; fixed in #1183, not landed)
- No migration

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
