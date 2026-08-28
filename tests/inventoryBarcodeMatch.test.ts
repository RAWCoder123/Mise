import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventoryBarcodeSkuHints,
  matchInventoryBarcode,
  normalizeInventoryBarcodeToken
} from "../services/domain/inventoryBarcodeMatch";
import {
  INVENTORY_BARCODE_SKU_MAX_CHARACTERS,
  normalizeCapturedSupplierSku
} from "../services/domain/inventoryBarcodeSku";
import type { InventoryItem, SupplierItem } from "../types/mise";

const syscoSupplierId = "10000000-0000-4000-8000-000000000005";
const localFarmsSupplierId = "10000000-0000-4000-8000-000000000006";
const syscoProteinsSupplierId = "10000000-0000-4000-8000-000000000007";

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, "id" | "item_name">): InventoryItem {
  return {
    restaurant_id: "r1",
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 2,
    supplier_id: syscoSupplierId,
    supplier_name: "Sysco",
    last_updated: "2026-08-01T12:00:00.000Z",
    ...partial
  };
}

function supplierItem(
  partial: Partial<SupplierItem> & Pick<SupplierItem, "id" | "item_name">
): SupplierItem {
  return {
    restaurant_id: "r1",
    supplier_id: syscoSupplierId,
    supplier_name: "Sysco",
    supplier_sku: null,
    inventory_item_id: null,
    unit: "lb",
    pack_size: null,
    estimated_unit_cost: 2,
    preferred: true,
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
    ...partial
  };
}

test("normalizeInventoryBarcodeToken strips case punctuation and spaces", () => {
  assert.equal(normalizeInventoryBarcodeToken("  ABC-123  "), "abc123");
  assert.equal(normalizeInventoryBarcodeToken("Roma Tomato"), "romatomato");
});

test("normalizeCapturedSupplierSku bounds and rejects control characters", () => {
  assert.equal(normalizeCapturedSupplierSku("  012345678905 "), "012345678905");
  assert.throws(() => normalizeCapturedSupplierSku(""), /required/i);
  assert.throws(() => normalizeCapturedSupplierSku("a\nb"), /invalid/i);
  assert.throws(
    () => normalizeCapturedSupplierSku("x".repeat(INVENTORY_BARCODE_SKU_MAX_CHARACTERS + 1)),
    /at most/i
  );
});

test("matchInventoryBarcode matches exact id", () => {
  const items = [
    item({ id: "inv-chicken", item_name: "Chicken Thigh" }),
    item({
      id: "inv-tomato",
      item_name: "Roma Tomato",
      supplier_id: localFarmsSupplierId,
      supplier_name: "Local Farms"
    })
  ];
  const result = matchInventoryBarcode("INV-TOMATO", items);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.id, "inv-tomato");
});

test("matchInventoryBarcode matches supplier_sku ahead of name substring", () => {
  const tomato = item({
    id: "inv-tomato",
    item_name: "Roma Tomato",
    supplier_id: localFarmsSupplierId,
    supplier_name: "Local Farms"
  });
  const paste = item({ id: "inv-paste", item_name: "Tomato Paste" });
  const items = [tomato, paste];
  const supplierItems = [
    supplierItem({
      id: "sku-1",
      item_name: tomato.item_name,
      supplier_id: tomato.supplier_id,
      supplier_name: tomato.supplier_name,
      inventory_item_id: tomato.id,
      supplier_sku: "012345678905",
      unit: tomato.unit
    })
  ];

  const result = matchInventoryBarcode("012345678905", items, { supplierItems });
  assert.equal(result.matches[0]?.id, "inv-tomato");
  assert.equal(result.matches.length, 1);
});

test("buildInventoryBarcodeSkuHints resolves by identity when inventory_item_id is absent", () => {
  const chicken = item({
    id: "inv-chicken",
    item_name: "Chicken Thigh",
    supplier_id: syscoProteinsSupplierId,
    supplier_name: "Sysco Proteins"
  });
  const hints = buildInventoryBarcodeSkuHints(
    [chicken],
    [
      supplierItem({
        id: "sku-chicken",
        item_name: "Chicken Thigh",
        supplier_id: syscoProteinsSupplierId,
        supplier_name: "Sysco Proteins",
        supplier_sku: "SYSCO-CHK-THIGH",
        unit: "lb"
      })
    ]
  );
  assert.deepEqual(hints, [{ inventoryItemId: "inv-chicken", supplierSku: "SYSCO-CHK-THIGH" }]);
});

test("matchInventoryBarcode matches normalized item name and supplier", () => {
  const items = [
    item({
      id: "a",
      item_name: "Roma Tomato",
      supplier_id: localFarmsSupplierId,
      supplier_name: "Local Farms"
    }),
    item({
      id: "b",
      item_name: "Chicken Thigh",
      supplier_id: syscoProteinsSupplierId,
      supplier_name: "Sysco Proteins"
    })
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
