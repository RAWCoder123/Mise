import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID
} from "../services/demo/replaceableDemoData";
import { normalizeInventoryItem } from "../services/miseValidation";

test("demo repository can draft, verify, and expire modifier recipe adjustments", async () => {
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

  const seeded = createInitialDemoState();
  assert.equal(seeded.schema_version, 14);
  assert.ok(Array.isArray(seeded.recipeVersions));
  assert.ok(Array.isArray(seeded.modifierRecipeAdjustments));

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const inventory = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).map(
    normalizeInventoryItem
  );
  const chicken = inventory.find((item) => item.item_name === "Chicken breast");
  assert.ok(chicken);
  assert.equal(chicken.canonical_unit_verification_status, "verified");
  assert.ok(chicken.canonical_unit);

  const authorities = await repository.fetchRecipeAuthorities(DEMO_RESTAURANT_ID);
  const menuItemId = authorities[0]?.menuItemId;
  assert.ok(menuItemId);

  const drafted = await repository.upsertModifierRecipeAdjustment({
    restaurantId: DEMO_RESTAURANT_ID,
    menuItemId,
    externalModifierId: "demo-extra-protein",
    modifierName: "Extra protein",
    inventoryItemId: chicken.id,
    quantityDelta: 50,
    canonicalUnit: chicken.canonical_unit
  });
  assert.equal(drafted.verificationStatus, "draft");

  const verified = await repository.verifyModifierRecipeAdjustment(
    DEMO_RESTAURANT_ID,
    drafted.id
  );
  assert.equal(verified.verificationStatus, "verified");

  const listed = await repository.listModifierRecipeAdjustments(DEMO_RESTAURANT_ID);
  assert.ok(
    listed.some((entry) => entry.id === drafted.id && entry.verificationStatus === "verified")
  );

  const contexts = await repository.listModifierAdjustmentMenuContexts(DEMO_RESTAURANT_ID);
  assert.ok(contexts.has(drafted.recipeVersionId));

  const expired = await repository.expireModifierRecipeAdjustment(
    DEMO_RESTAURANT_ID,
    drafted.id
  );
  assert.equal(expired.verificationStatus, "expired");
});
