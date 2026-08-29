# Recipes builder inventory chip search (2026-08-29)

## Gap
Settings → Recipes builder inventory chips used `inventoryItems.slice(0, 7)`, hiding most stock SKUs when restaurants exceed seven inventory items (demo has 24). Managers could not discover later items without typing an exact name.

## Fix
- Domain: `services/domain/recipeInventoryItemSearch.ts`
  - `filterInventoryItemsForRecipeBuilder` returns the full caller list on empty query
  - Ranked prefix / substring / multi-token name matches, plus category and supplier
  - Dedupes by inventory item id; never invents rows
  - `RECIPE_INVENTORY_CHIP_SEARCH_THRESHOLD = 7`
- UI: `app/settings/recipes.tsx`
  - Find field when inventory count > 7
  - Showing X of Y meta + empty-match copy
  - No hard seven-chip cap
- i18n EN / ES / zh-Hans `recipes.builder.inventorySearch.*`
- Tests: `tests/recipeInventoryItemSearch.test.ts`

## Out of scope
Does not land missing-POS search (#243), mapped-dish search (#241), theoretical food cost (#242), or inventory create (#226). Does not change recipe mutation authority or hosted RPCs.

## Verification
- `npm run typecheck`
- `npm test -- tests/recipeInventoryItemSearch.test.ts`
- `npm test`
- `npm run design:static` (if available)
- `npm run security:static` (if available)
