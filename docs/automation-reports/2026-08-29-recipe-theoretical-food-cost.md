# Recipe theoretical food cost (2026-08-29)

## Gap
Settings → Recipes showed mapped dishes and baseline quantities but never surfaced theoretical dish food cost from `qty × estimated_unit_cost`, so managers could not spot incomplete cost coverage while repairing recipes.

## Fix
- Domain: `computeRecipeTheoreticalFoodCost` — complete when every ingredient has a positive finite unit cost; incomplete otherwise (never invents prices).
- `buildRecipeBaselineSummary` attaches `theoreticalFoodCost` per mapped dish.
- Recipes UI shows complete / incomplete / partial cost copy in EN, ES, and zh-Hans.
- No migration.

## Verification
- `npm run typecheck`
- Focused `tests/recipeTheoreticalCost.test.ts`
- `npm test`
- `npm run design:static`
- `npm run security:static`
