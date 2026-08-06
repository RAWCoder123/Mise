import assert from "node:assert/strict";
import test from "node:test";

import {
  matchInventoryBarcode,
  normalizeInventoryBarcodeToken
} from "../services/domain/inventoryBarcodeMatch";
import type { InventoryItem } from "../types/mise";

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, "id" | "item_name">): InventoryItem {
  return {
    restaurant_id: "r1",
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 2,
    supplier_name: "Sysco",
    last_updated: "2026-08-01T12:00:00.000Z",
    ...partial
  };
}

test("normalizeInventoryBarcodeToken strips case punctuation and spaces", () => {
  assert.equal(normalizeInventoryBarcodeToken("  ABC-123  "), "abc123");
  assert.equal(normalizeInventoryBarcodeToken("Roma Tomato"), "romatomato");
});

test("matchInventoryBarcode matches exact id", () => {
  const items = [
    item({ id: "inv-chicken", item_name: "Chicken Thigh" }),
    item({ id: "inv-tomato", item_name: "Roma Tomato", supplier_name: "Local Farms" })
  ];
  const result = matchInventoryBarcode("INV-TOMATO", items);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.id, "inv-tomato");
});

test("matchInventoryBarcode matches normalized item name and supplier", () => {
  const items = [
    item({ id: "a", item_name: "Roma Tomato", supplier_name: "Local Farms" }),
    item({ id: "b", item_name: "Chicken Thigh", supplier_name: "Sysco Proteins" })
  ];

  assert.equal(matchInventoryBarcode("roma tomato", items).matches[0]?.id, "a");
  assert.equal(matchInventoryBarcode("sysco-proteins", items).matches[0]?.id, "b");
});

test("matchInventoryBarcode ranks exact id above substring name hits", () => {
  const items = [
    item({ id: "x1", item_name: "Tomato Paste" }),
    item({ id: "tomato", item_name: "Other" })
  ];
  const result = matchInventoryBarcode("tomato", items);
  assert.equal(result.matches[0]?.id, "tomato");
  assert.ok(result.matches.some((entry) => entry.id === "x1"));
});

test("matchInventoryBarcode returns empty for blank or unknown codes", () => {
  const items = [item({ id: "a", item_name: "Butter" })];
  assert.deepEqual(matchInventoryBarcode("   ", items).matches, []);
  assert.deepEqual(matchInventoryBarcode("no-such-code", items).matches, []);
});
