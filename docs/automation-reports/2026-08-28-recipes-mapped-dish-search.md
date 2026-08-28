# Recipes mapped-dish list uncapped with search (2026-08-28)

## Gap
Settings → Recipes hard-capped mapped dishes at six via `buildRecipeBaselineSummary` (`items.slice(0, 6)`). Managers could not open, edit quantities, or confirm recipes beyond the top sellers when `menuItemsTracked` was larger.

## Change
- Domain: optional `itemLimit` on `buildRecipeBaselineSummary` (default 6 for Home/summary; `null` for Settings).
- Application: `fetchRecipeBaselineSummary` requests the full list.
- Domain search: `filterRecipeBaselineItemsBySearch` + `RECIPE_BASELINE_SEARCH_THRESHOLD` (5).
- UI: find control on `/settings/recipes` when ≥5 mapped dishes; empty-match state; section count reflects filter.
- i18n EN / ES / zh-Hans.

## Verification
- `npm run typecheck`
- `npm test` (recipeBaselineSearch + suite)
- No migrations.

## Classification
Controlled pilot-ready codebase continues; not App Store submission-ready.
