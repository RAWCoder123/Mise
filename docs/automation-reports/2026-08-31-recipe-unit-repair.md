# Recipe unit repair (2026-08-31)

## Completed
- Detect unit-incompatible recipe↔inventory mappings in `buildRecipeBaselineSummary`
  (`unitCompatible`, `inventoryUnit`, `posItemsWithIncompatibleUnits`).
- Sort incompatible dishes ahead of the capped Recipes list so Fix remains reachable.
- `updateRecipeBaselineIngredient` always aligns recipe unit to the current inventory unit.
- Settings → Recipes warns on mismatches and exposes a Fix unit CTA (EN/ES/zh-Hans).

## Why
Purchase authority fail-closes on `recipe_unit_incompatible`. Recovery deep-links to
Recipes, but quantity-only updates previously froze `existing.unit`, so operators could
not clear the blocker.

## Verification
- `npm run typecheck`
- `npm test` — 635 passed, 0 failed, 7 cancelled
- Focused: `tests/recipeUnitRepair.test.ts`, `tests/miseDomain.test.ts`, `tests/security.test.ts`

## Out of scope
- Today/POS/Settings hub repair CTAs (closed historical #47 surface; not required for Fix path)
- Recipe unlink (#183)
- Inventory purchase-unit correction (Codex `safe_patch`)
- Migrations

## Classification
Controlled pilot-ready improvement. Not App Store submission-ready.
