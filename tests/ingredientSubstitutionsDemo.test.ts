import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID
} from "../services/demo/replaceableDemoData";
import { normalizeInventoryItem } from "../services/miseValidation";

test("demo seeds and repository can list, verify, and expire ingredient substitutions", async () => {
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
  assert.ok((seeded.ingredientSubstitutions ?? []).length >= 1);
  assert.ok(
    seeded.ingredientSubstitutions.some((entry) => entry.verificationStatus === "verified")
  );
  assert.ok(
    seeded.ingredientSubstitutions.some((entry) => entry.verificationStatus === "draft")
  );

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const listed = await repository.listIngredientSubstitutions(DEMO_RESTAURANT_ID);
  assert.ok(listed.length >= 1);
  assert.ok(listed.every((entry) => entry.restaurantId === DEMO_RESTAURANT_ID));

  const inventory = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).map(
    normalizeInventoryItem
  );
  const byUnit = new Map<string, typeof inventory>();
  for (const item of inventory) {
    if (item.canonical_unit_verification_status !== "verified" || !item.canonical_unit) {
      continue;
    }
    const bucket = byUnit.get(item.canonical_unit) ?? [];
    bucket.push(item);
    byUnit.set(item.canonical_unit, bucket);
  }
  const pair = [...byUnit.values()].find((bucket) => bucket.length >= 2);
  assert.ok(pair);

  const existingVerifiedKeys = new Set(
    listed
      .filter((entry) => entry.verificationStatus === "verified")
      .map((entry) => `${entry.sourceInventoryItemId}:${entry.substituteInventoryItemId}`)
  );
  let source = pair[0]!;
  let substitute = pair[1]!;
  for (let i = 0; i < pair.length; i += 1) {
    for (let j = 0; j < pair.length; j += 1) {
      if (i === j) continue;
      const key = `${pair[i]!.id}:${pair[j]!.id}`;
      if (!existingVerifiedKeys.has(key)) {
        source = pair[i]!;
        substitute = pair[j]!;
      }
    }
  }

  const created = await repository.upsertIngredientSubstitution({
    restaurantId: DEMO_RESTAURANT_ID,
    sourceInventoryItemId: source.id,
    substituteInventoryItemId: substitute.id,
    sourceQuantity: 3,
    substituteQuantity: 4,
    canonicalUnit: source.canonical_unit as "g" | "ml" | "each"
  });
  assert.equal(created.verificationStatus, "draft");

  const verifiedRow = await repository.verifyIngredientSubstitution(
    DEMO_RESTAURANT_ID,
    created.id
  );
  assert.equal(verifiedRow.verificationStatus, "verified");

  const expired = await repository.expireIngredientSubstitution(
    DEMO_RESTAURANT_ID,
    verifiedRow.id
  );
  assert.equal(expired.verificationStatus, "expired");
  assert.ok(expired.effectiveTo);
});
