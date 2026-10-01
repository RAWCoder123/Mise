import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demoData";

test("demo recipe yield write verifies without mutating verified rows in place", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const { setMiseRepositoryForTesting } = await import("../services/application/repository");
  const { fetchRecipeBaselineSummary } = await import("../services/application/inventory");
  const {
    upsertRecipeVersionYields,
    verifyRecipeVersionYields
  } = await import("../services/application/recipeYield");

  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  const restore = setMiseRepositoryForTesting(repository);
  try {
    const summary = await fetchRecipeBaselineSummary(DEMO_RESTAURANT_ID);
    const chicken = summary.items.find((item) => item.menu_item_name === "Chicken Bowl");
    const friedRice = summary.items.find((item) => item.menu_item_name === "Fried Rice");

    assert.ok(chicken, "Chicken Bowl should be in the capped recipe summary");
    assert.equal(chicken?.yieldReadout?.status, "recorded");
    if (chicken?.yieldReadout?.status === "recorded") {
      assert.equal(chicken.yieldReadout.prepYield, 0.95);
      assert.equal(chicken.yieldReadout.cookingYield, 0.9);
      assert.equal(chicken.yieldReadout.versionStatus, "verified");
      assert.ok(chicken.yieldReadout.rawUsageMultiplier > 1);
    }

    // Dishes without a demo recipe_versions seed stay honestly missing.
    if (friedRice) {
      assert.equal(friedRice.yieldReadout?.status, "missing");
    }

    assert.ok(chicken?.menuItemId, "Chicken Bowl needs a menu item id for yield writes");
    const menuItemId = chicken!.menuItemId!;

    await assert.rejects(
      () =>
        upsertRecipeVersionYields({
          restaurantId: DEMO_RESTAURANT_ID,
          menuItemId,
          servingQuantity: 1,
          prepYield: 0.9,
          cookingYield: 0.9,
          recipeVersionId:
            chicken!.yieldReadout?.status === "recorded"
              ? chicken!.yieldReadout.recipeVersionId
              : null
        }),
      /Only draft recipe yields can be edited/
    );

    const draft = await upsertRecipeVersionYields({
      restaurantId: DEMO_RESTAURANT_ID,
      menuItemId,
      servingQuantity: 1,
      prepYield: 0.9,
      cookingYield: 0.88,
      recipeVersionId: null
    });
    assert.equal(draft.status, "draft");
    assert.equal(draft.prepYield, 0.9);
    assert.equal(draft.versionNumber, 2);

    const verified = await verifyRecipeVersionYields(DEMO_RESTAURANT_ID, draft.id);
    assert.equal(verified.status, "verified");

    const after = await fetchRecipeBaselineSummary(DEMO_RESTAURANT_ID);
    const chickenAfter = after.items.find((item) => item.menu_item_name === "Chicken Bowl");
    assert.equal(chickenAfter?.yieldReadout?.status, "recorded");
    if (chickenAfter?.yieldReadout?.status === "recorded") {
      assert.equal(chickenAfter.yieldReadout.prepYield, 0.9);
      assert.equal(chickenAfter.yieldReadout.cookingYield, 0.88);
      assert.equal(chickenAfter.yieldReadout.versionStatus, "verified");
      assert.equal(chickenAfter.yieldReadout.recipeVersionId, verified.id);
    }
  } finally {
    restore();
  }
});
