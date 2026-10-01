# 2026-09-02 — Setup recipe ingredient unit conversion

## Completed
- Same-dimension recipe→inventory unit conversion during hosted `saveRestaurantSetup`
  (oz↔lb, ml↔l, aliases, etc.) so convertible baselines persist instead of silent skips.
- Pack/unknown/cross-dimension units still skip and increment `skippedRecipeIngredients`.
- Hosted setup ready screen shows a caution StatusNotice when any ingredients were skipped
  (EN / ES / zh-Hans).
- Domain helpers: `convertRecipeQuantityToInventoryUnit`, `resolveSetupRecipeIngredientMapping`.

## Tests
- `tests/setupRecipeIngredientUnits.test.ts` (4/4)
- `npm run typecheck`
- `npm test` — 636 pass / 0 fail / 7 cancelled (pre-existing timeout cancellations)
- `npm run security:static`
- `npm run design:static`

## Explicitly not done
- Consume substitutions/yields in receive/depletion
- Invent MOQ / lead_time / expiration
- Change runtime depletion exact-unit match (`inventoryUnitsAreCompatible`)

## Classification
Still controlled pilot-ready code. Not App Store submission-ready.
