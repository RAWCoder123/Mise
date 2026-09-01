import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("Settings Recipes surfaces recipe_versions yield readout without a write path", () => {
  const screen = source("app/settings/recipes.tsx");
  const application = source("services/application/inventory.ts");
  const supabase = source("services/repositories/supabaseRepository.ts");
  const contract = source("services/repositories/repositoryContracts.ts");
  const catalog = source("i18n/catalog.ts");

  assert.match(contract, /fetchRecipeVersionYields\(/);
  assert.match(supabase, /\.from\("recipe_versions"\)/);
  assert.match(supabase, /prep_yield/);
  assert.match(supabase, /cooking_yield/);
  assert.match(supabase, /serving_quantity/);
  assert.doesNotMatch(supabase, /from\("recipe_versions"\)[\s\S]{0,200}\.(insert|update|upsert|delete)\(/);

  assert.match(application, /fetchRecipeVersionYields/);
  assert.match(application, /presentRecipeYieldReadout/);
  assert.match(application, /yieldReadout:/);

  assert.match(screen, /RecipeYieldReadoutRow/);
  assert.match(screen, /recipes\.yield\.recorded/);
  assert.match(screen, /recipes\.yield\.missing/);

  assert.match(catalog, /"recipes\.yield\.recorded"/);
  assert.match(catalog, /"recipes\.yield\.missing"/);
  assert.match(catalog, /"recipes\.yield\.status\.verified"/);
});
