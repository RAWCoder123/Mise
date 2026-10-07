# MISE-005KD: pin restaurantMemory learning-signal classify to ASCII C

Date: 2026-10-07

## Summary

Pin Restaurant Memory learning-signal classification
(`restaurantMemoryLearningSignalHaystack` /
`normalizeRestaurantMemoryLearningSignalToken`) to ASCII C case fold and
ASCII-only whitespace trim so Kelvin lookalikes and non-C whitespace cannot
invent typed memories (`waste_pattern`, `prep_habit`, and siblings) that feed
recommendation-affecting statements.

## Why

`classifyLearningSignal` previously lowercased
`` `${signal.label} ${signal.detail}` `` with Unicode-aware `toLowerCase`
before keyword matching. Sibling client tips already pin inventory, menu,
email, prep-window, and typed-search identity to ASCII C. Learning-signal
classification chooses a `RestaurantMemoryType` with
`affectsRecommendations: true`. Under Unicode folding, Kelvin (`K`) becomes
`k`, so a label like `wastK` invents a `waste` keyword hit the ASCII C path
would refuse.

## Change

- `services/domain/restaurantMemory.ts`: ASCII C helpers + exported normalize /
  haystack; classify path uses the haystack helper.
- Focused static + behavioral tests.
- Automation report.
- No SQL migration (classification is client-side over hosted signal copy).

## Verification

- `npm run typecheck`
- focused `tests/restaurantMemoryLearningSignalAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Out of scope

- Landing/rebasing open stacks #348–#698
- Re-tipping tipped identity files (Inventory/Log Delivery typed search #698,
  Scan Item #697, setup-screen supplier identity #696, and listed skips)
- Free-form Ask Mise intent classify (accented multilingual keyword regex;
  tip separately with care)
- Contested SQL mutators / ingest rewrites
- Account-deletion confirm-word compare (separate destructive-gate tip)
