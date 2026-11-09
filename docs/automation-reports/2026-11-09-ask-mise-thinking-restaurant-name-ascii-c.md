# MISE-005AAY Ask Mise thinkingSteps restaurant.name ASCII C

Date: 2026-11-09

## Summary

Ask Mise thinking steps interpolated raw `restaurant.name` into
`ask.thinking.restaurant` via `buildThinkingSteps`. Empty / Unicode-only-space
names are truthy and rendered blank-looking inside grounded thinking copy;
Unicode `.trim()` on padded names would invent a clean restaurant identity.

## Fix

- Add `services/domain/presentationAskMiseThinkingRestaurantNameIdentity.ts`
  (ASCII C single-line prep; soft-null empty / Unicode-padded / controls)
- Soft-null Ask Mise thinkingSteps restaurant names through
  `normalizeAskMiseThinkingRestaurantName` with localized
  `ask.thinking.restaurant.none` (EN / ES / zh-Hans)
- Focused inventing / fallback-bypass proofs in
  `tests/askMiseThinkingRestaurantNameAsciiC.test.ts`

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still interpolated into
  `ask.thinking.restaurant`
- `"\u2003Luna Bistro\u2003".trim() === "Luna Bistro"` inventing equality with
  a clean restaurant name
- ASCII C soft-null restores `ask.thinking.restaurant.none`

## Leave alone

- Ask Mise greeting.body restaurant.name (#1045 / MISE-005WK)
- Ask Mise greeting firstName (#961 / MISE-005TW)
- Ask Mise answer-text briefing.lead restaurant.name (sibling tip candidate)
- Home greeting restaurant.name (#1044 / MISE-005WJ)
- Autonomy subtitle restaurant.name (#1043 / MISE-005WI)
- Ask Mise answer-text attentionTitles (#1209 / MISE-005AAX)
- Ask Mise answer-text topTaskTitles (#1164 / MISE-005ZF)
- Ask Mise message.title / bubble chrome on `app/ask-mise.tsx`

## Verification

- Focused tip tests: 1/1 (74 assertion call sites counted from source)
- `npm run typecheck`: see PR notes
- `npm test`: see PR notes
- No migration

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
