import assert from "node:assert/strict";
import test from "node:test";

import {
  assertInventoryItemCreateCapacity,
  findDuplicateInventoryItemName,
  inventoryItemNameKey,
  MAX_INVENTORY_ITEMS_PER_RESTAURANT,
  planInventoryItemCreate
} from "../services/domain/inventoryItemCreate";
import {
  operatingLimits,
  requireInventoryItemCreateInput
} from "../services/miseValidation";

test("planInventoryItemCreate normalizes text fields and opening stock metadata", () => {
  const planned = planInventoryItemCreate({
    item_name: "  Roma  Tomatoes  ",
    category: " Produce ",
    unit: " lb ",
    current_quantity: 12.5,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 1.75,
    supplier_id: "11111111-1111-4111-8111-111111111111"
  });

  assert.equal(planned.item_name, "Roma Tomatoes");
  assert.equal(planned.category, "Produce");
  assert.equal(planned.unit, "lb");
  assert.equal(planned.supplier_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(planned.current_quantity, 12.5);
  assert.equal(planned.eventType, "count");
  assert.equal(planned.sourceWorkflow, "create_inventory_item");
  assert.equal(planned.metadata.created, true);
  assert.equal(planned.metadata.supplier_id, "11111111-1111-4111-8111-111111111111");
});

test("inventory item names collide case-insensitively after whitespace collapse", () => {
  assert.equal(inventoryItemNameKey("  Roma   Tomatoes "), "roma tomatoes");
  assert.equal(
    findDuplicateInventoryItemName(["Roma Tomatoes", "Basil"], "roma  tomatoes"),
    "Roma Tomatoes"
  );
  assert.equal(findDuplicateInventoryItemName(["Basil"], "Oregano"), null);
});

test("assertInventoryItemCreateCapacity enforces the restaurant item ceiling", () => {
  assert.doesNotThrow(() => assertInventoryItemCreateCapacity(0));
  assert.doesNotThrow(() => assertInventoryItemCreateCapacity(MAX_INVENTORY_ITEMS_PER_RESTAURANT - 1));
  assert.throws(
    () => assertInventoryItemCreateCapacity(MAX_INVENTORY_ITEMS_PER_RESTAURANT),
    /maximum of 250/i
  );
});

test("requireInventoryItemCreateInput bounds strings, quantities, and supplier id", () => {
  const normalized = requireInventoryItemCreateInput({
    item_name: "  Olive Oil  ",
    category: "Dry Goods",
    unit: "gal",
    current_quantity: 2,
    par_level: 4,
    reorder_threshold: 1,
    estimated_unit_cost: 18.5,
    supplier_id: "22222222-2222-4222-8222-222222222222"
  });
  assert.equal(normalized.item_name, "Olive Oil");
  assert.equal(normalized.estimated_unit_cost, 18.5);
  assert.equal(normalized.supplier_id, "22222222-2222-4222-8222-222222222222");

  assert.throws(() => requireInventoryItemCreateInput({ ...normalized, item_name: "" }), /item name/i);
  assert.throws(
    () =>
      requireInventoryItemCreateInput({
        ...normalized,
        current_quantity: operatingLimits.inventoryQuantity + 1
      }),
    /current quantity/i
  );
  assert.throws(
    () => requireInventoryItemCreateInput({ ...normalized, estimated_unit_cost: -1 }),
    /estimated unit cost/i
  );
  assert.throws(
    () => requireInventoryItemCreateInput({ ...normalized, supplier_id: "not-a-uuid" }),
    /identity/i
  );
});
