import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demoData";

test("demo recipe baseline summary attaches recorded yields without inventing them", async () => {
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
  } finally {
    restore();
  }
});
