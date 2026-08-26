import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

test("Recipes screen prefills dish name from Today menuItem deep link", () => {
  const source = readFileSync(join(root, "app/settings/recipes.tsx"), "utf8");
  assert.match(source, /useLocalSearchParams<\{\s*menuItem\?:/);
  assert.match(source, /focusedMenuItem/);
  assert.match(source, /setNewMenuItemName\(focusedMenuItem\)/);
  assert.match(source, /appliedMenuItemFocusRef/);
});

test("Today application and operating plan pass sold POS recipe gaps into task derivation", () => {
  const today = readFileSync(join(root, "services/application/today.ts"), "utf8");
  const plan = readFileSync(join(root, "services/application/operatingPlan.ts"), "utf8");
  assert.match(today, /posItemsMissingRecipes:\s*summary\.recipeBaseline\.posItemsMissingRecipes/);
  assert.match(plan, /buildRecipeBaselineSummary\(/);
  assert.match(plan, /posItemsMissingRecipes:\s*recipeBaseline\.posItemsMissingRecipes/);
});

test("task detail treats recipe repair as an operations workflow with BookOpen icon", () => {
  const source = readFileSync(join(root, "app/tasks/[id].tsx"), "utf8");
  assert.match(source, /intent === "map_unmapped_pos_items"/);
  assert.match(source, /task\.source\.kind === "recipe"/);
  assert.match(source, /BookOpen/);
});
