import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSupplierCatalogBrowse } from "../services/domain/supplierCatalog";
import { filterSupplierCatalogGroups } from "../services/presentation/supplierCatalogPresentation";
import type { SupplierItem } from "../types/mise";

function catalogItem(overrides: Partial<SupplierItem> = {}): SupplierItem {
  return {
    id: "item-1",
    restaurant_id: "rest-1",
    supplier_id: "sup-1",
    supplier_name: "Local Produce Co.",
    supplier_sku: "TOMA-01",
    item_name: "Tomatoes",
    unit: "lbs",
    pack_size: "10 lb case",
    estimated_unit_cost: 1.8,
    preferred: true,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides
  };
}

test("buildSupplierCatalogBrowse groups by durable supplier and preserves pack/SKU evidence", () => {
  const groups = buildSupplierCatalogBrowse("rest-1", [
    catalogItem(),
    catalogItem({
      id: "item-2",
      item_name: "Lettuce",
      supplier_sku: "LETT-02",
      pack_size: "12 head case",
      unit: "heads",
      preferred: false,
      estimated_unit_cost: 1.4
    }),
    catalogItem({
      id: "foreign",
      restaurant_id: "rest-2",
      item_name: "Foreign greens"
    }),
    catalogItem({
      id: "blank-name",
      item_name: "   "
    })
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.supplierId, "sup-1");
  assert.equal(groups[0]?.preferredCount, 1);
  assert.deepEqual(
    groups[0]?.lines.map((line) => ({
      id: line.id,
      sku: line.supplierSku,
      pack: line.packSize,
      preferred: line.preferred
    })),
    [
      { id: "item-1", sku: "TOMA-01", pack: "10 lb case", preferred: true },
      { id: "item-2", sku: "LETT-02", pack: "12 head case", preferred: false }
    ]
  );
});

test("buildSupplierCatalogBrowse never invents missing pack labels or SKUs", () => {
  const groups = buildSupplierCatalogBrowse("rest-1", [
    catalogItem({
      supplier_sku: "  ",
      pack_size: null,
      preferred: false
    })
  ]);

  assert.equal(groups[0]?.lines[0]?.supplierSku, null);
  assert.equal(groups[0]?.lines[0]?.packSize, null);
  assert.equal(groups[0]?.lines[0]?.preferred, false);
});

test("filterSupplierCatalogGroups matches SKU and pack labels without fabricating rows", () => {
  const groups = buildSupplierCatalogBrowse("rest-1", [
    catalogItem(),
    catalogItem({
      id: "item-2",
      supplier_id: "sup-2",
      supplier_name: "Fresh Poultry Supply",
      item_name: "Chicken breast",
      supplier_sku: "CHICKEN-01",
      pack_size: "10 lb case",
      preferred: true
    })
  ]);

  const bySku = filterSupplierCatalogGroups(groups, "chicken-01");
  assert.equal(bySku.length, 1);
  assert.equal(bySku[0]?.lines[0]?.itemName, "Chicken breast");

  const byPack = filterSupplierCatalogGroups(groups, "12 head");
  assert.equal(byPack.length, 0);

  const empty = filterSupplierCatalogGroups(groups, "   ");
  assert.equal(empty.length, 2);
});
