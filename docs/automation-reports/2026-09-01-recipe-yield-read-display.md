# Recipe yield read display (2026-09-01)

## Gap
Settings → Recipes never surfaced `recipe_versions` prep/cooking/serving yields.
The table already had member SELECT RLS, but the client never queried it.

## Fix
- Domain: `services/domain/recipeYield.ts` — select current effective version, present
  recorded vs missing readout, compute raw usage multiplier. Never invents yields.
- Repository SELECT: hosted `recipe_versions` columns; demo seeds Chicken Bowl /
  Burger / Pancakes yields without DemoState schema bump or write RPC.
- `fetchRecipeBaselineSummary` attaches `yieldReadout` per mapped dish.
- Settings Recipes row shows EN/ES/zh-Hans yield line or honest “not recorded”.

## Out of scope
- Yield write / edit RPC (needs Codex migration + authority).
- Ingredient substitutions CRUD.
- Changing depletion math to consume yields (read display only).

## Proof
- `npm run typecheck`
- `node --test tests/recipeYield.test.ts tests/recipeYieldUi.test.ts tests/recipeYieldDemo.test.ts`
- `npm test` (focused + suite)
