import assert from "node:assert/strict";
import test from "node:test";

import type { SetupInventoryDraftItem } from "../services/domain/setupDrafts";
import {
  resolveSetupRecipeIngredient,
  searchSetupInventoryForPicker,
  setupInventoryCatalogId,
  toSetupInventoryPickerItems
} from "../services/domain/setupRecipeLinking";

const inventoryDrafts: SetupInventoryDraftItem[] = [
  {
    id: "inv-chicken",
    name: "Chicken Thighs",
    quantity: "20",
    unit: "lb",
    parLevel: "30",
    supplier: "Sysco"
  },
  {
    id: "inv-rice",
    name: "Jasmine Rice",
    quantity: "10",
    unit: "lb",
    parLevel: "15",
    supplier: "Local Farm"
  },
  {
    id: "inv-blank",
    name: "   ",
    quantity: "",
    unit: "lb",
    parLevel: "",
    supplier: ""
  }
];

test("setup inventory picker omits blank draft names", () => {
  const items = toSetupInventoryPickerItems(inventoryDrafts);
  assert.deepEqual(
    items.map((item) => item.id),
    ["inv-chicken", "inv-rice"]
  );
});

test("setup inventory search ranks unique substring matches for onboarding", () => {
  const matches = searchSetupInventoryForPicker(inventoryDrafts, "jas");
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.item.draft.id, "inv-rice");
  assert.ok((matches[0]?.score ?? 0) >= 800);
});

test("resolveSetupRecipeIngredient prefers explicit draft id over ambiguous names", () => {
  assert.equal(
    resolveSetupRecipeIngredient(inventoryDrafts, {
      itemName: "chicken",
      inventoryItemId: "inv-chicken"
    })?.id,
    "inv-chicken"
  );
});

test("resolveSetupRecipeIngredient links unique near-matches without requiring exact names", () => {
  assert.equal(
    resolveSetupRecipeIngredient(inventoryDrafts, {
      itemName: "chicken thigh",
      inventoryItemId: null
    })?.id,
    "inv-chicken"
  );

  assert.equal(
    resolveSetupRecipeIngredient(inventoryDrafts, {
      itemName: "  Chicken   Thighs ",
      inventoryItemId: null
    })?.id,
    "inv-chicken"
  );
});

test("resolveSetupRecipeIngredient returns null when the operator must choose or create", () => {
  assert.equal(
    resolveSetupRecipeIngredient(inventoryDrafts, {
      itemName: "tomato",
      inventoryItemId: null
    }),
    null
  );
});

test("setup inventory catalog ids collapse whitespace like inventory item keys", () => {
  assert.equal(setupInventoryCatalogId("  Chicken   Thighs "), "chicken thighs");
});
