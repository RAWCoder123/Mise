# 2026-09-02 Insights / Daily Report → Restaurant Memory deep-link

## Summary

Insights “How Mise knows” and Daily Report learning / supplier-reliability
sections summarized restaurant learning but never routed managers into the
existing Restaurant Memory hub where they confirm, correct, or dismiss
actionable memories.

## Changes

- `services/presentation/learningMemoryNavigation.ts` — shared
  `/more/restaurant-memory` review href
- Insights expanded memory panel: review CTA
- Daily Report learning card: review CTA
- Daily Report supplier reliability: review-memory CTA when attention suppliers exist
- EN / ES / zh-Hans catalog keys
- Static pin tests

## Out of scope

- Delivery outcomes browse (#347) and post-#347 Delivery lessons deep-link
- Localizing memory type/status labels (#261)
- Daily Report advice ranking fail-closed (#329)
- Inventing MOQ / lead time / expiration

## Verification

- `node --import tsx --test tests/learningMemoryNavigation.test.ts` (3/3)
- `npm run typecheck`
- `npm run security:static`
- `npm run design:static`
- `npm test` (targeted + suite)
