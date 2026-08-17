import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("recipe unlink migration keeps the path service-owned and manager-gated", () => {
  const migration = readFileSync("supabase/migrations/20260817060000_delete_recipe_mapping.sql", "utf8");
  assert.match(migration, /private\.service_delete_recipe_and_signals/i);
  assert.match(migration, /public\.service_delete_recipe_and_signals/i);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/);
  assert.match(migration, /delete from public\.menu_item_ingredients/i);
  assert.match(migration, /commit_operational_signals/i);
  assert.match(migration, /revoke\s+all[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute[\s\S]*service_role/i);
  assert.match(migration, /Historical inventory movements are retained/i);
});

test("recipe unlink regenerates planning without the deleted mapping", () => {
  const inventory = readFileSync("services/application/inventory.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const deleteFn =
    inventory.match(/export\s+async\s+function\s+deleteRecipeBaselineIngredient[\s\S]*?\n\}/)?.[0] ?? "";
  const applyDelete =
    edge.match(/if \(action === "delete_recipe"\) \{[\s\S]*?return \{[\s\S]*?\};\n  \}/)?.[0] ?? "";

  assert.match(deleteFn, /filter\(\(mapping\) => mapping\.id !== mappingId\)/);
  assert.match(deleteFn, /deleteRecipeMappingAndSignals/);
  assert.match(applyDelete, /menuItemIngredients\.filter/);
  assert.match(demo, /async deleteRecipeMappingAndSignals/);
  assert.match(demo, /splice\(index, 1\)/);
});
