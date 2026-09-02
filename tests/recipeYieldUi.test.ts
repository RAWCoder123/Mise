import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("Settings Recipes yield writes go through manager RPCs, never table DML", () => {
  const screen = source("app/settings/recipes.tsx");
  const application = source("services/application/recipeYield.ts");
  const inventory = source("services/application/inventory.ts");
  const supabase = source("services/repositories/supabaseRepository.ts");
  const contract = source("services/repositories/repositoryContracts.ts");
  const catalog = source("i18n/catalog.ts");
  const migration = source(
    "supabase/migrations/20260902010000_recipe_version_yield_manager_authority.sql"
  );

  assert.match(contract, /fetchRecipeVersionYields\(/);
  assert.match(contract, /upsertRecipeVersionYields\(/);
  assert.match(contract, /verifyRecipeVersionYields\(/);
  assert.match(contract, /retireRecipeVersionYields\(/);

  assert.match(supabase, /\.from\("recipe_versions"\)/);
  assert.match(supabase, /upsert_recipe_version_yields/);
  assert.match(supabase, /verify_recipe_version_yields/);
  assert.match(supabase, /retire_recipe_version_yields/);
  assert.doesNotMatch(supabase, /from\("recipe_versions"\)[\s\S]{0,220}\.(insert|update|upsert|delete)\(/);

  assert.match(inventory, /fetchRecipeVersionYields/);
  assert.match(inventory, /presentRecipeYieldReadout/);
  assert.match(application, /upsertRecipeVersionYields/);
  assert.match(application, /verifyRecipeVersionYields/);
  assert.match(application, /retireRecipeVersionYields/);

  assert.match(screen, /upsertRecipeVersionYields/);
  assert.match(screen, /verifyRecipeVersionYields/);
  assert.match(screen, /retireRecipeVersionYields/);
  assert.match(screen, /recipes\.yield\.action\.saveDraft/);
  assert.match(screen, /recipes\.yield\.editor\.successorHint/);

  assert.match(catalog, /"recipes\.yield\.action\.verify"/);
  assert.match(catalog, /"recipes\.yield\.error\.invalid"/);

  assert.match(migration, /Only draft recipe yields can be edited/);
  assert.match(migration, /recipe_version_yield\.verified/);
  assert.match(migration, /grant execute on function public\.upsert_recipe_version_yields/);
});
