import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPosDepletionDiagnosticsTenantScoped,
  buildPosDepletionDiagnostics
} from "../services/domain/posDepletionDiagnostics";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";
import type { VerifiedProviderSaleMapping } from "../services/domain/providerSaleIdentity";

const restaurantId = "rest-1";
const operatingDate = "2026-09-02";

function sale(overrides: Partial<PosSale> = {}): PosSale {
  return {
    id: overrides.id ?? "sale-1",
    restaurant_id: restaurantId,
    sale_date: operatingDate,
    item_name: "Burger",
    category: "Entree",
    quantity_sold: 3,
    gross_sales: 30,
    net_sales: 28,
    source_pos: "Manual CSV Upload",
    source_record_id: "row-1",
    created_at: `${operatingDate}T12:00:00.000Z`,
    ...overrides
  };
}

function inventory(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inv-beef",
    restaurant_id: restaurantId,
    item_name: "Ground beef",
    category: "Protein",
    unit: "lb",
    current_quantity: 10,
    par_level: 8,
    reorder_threshold: 4,
    estimated_unit_cost: 4.5,
    supplier_id: "sup-1",
    supplier_name: "Sysco",
    last_updated: `${operatingDate}T12:00:00.000Z`,
    ...overrides
  };
}

function mapping(overrides: Partial<MenuItemIngredient> = {}): MenuItemIngredient {
  return {
    id: "map-1",
    restaurant_id: restaurantId,
    menu_item_id: "menu-burger",
    menu_item_name: "Burger",
    inventory_item_id: "inv-beef",
    quantity_used_per_sale: 0.4,
    unit: "lb",
    ...overrides
  };
}

test("buildPosDepletionDiagnostics counts depleting mapped sales", () => {
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId,
    operatingDate,
    sales: [sale()],
    mappings: [mapping()],
    inventoryItems: [inventory()]
  });

  assert.equal(diagnostics.todaySaleCount, 1);
  assert.equal(diagnostics.depletingSaleCount, 1);
  assert.equal(diagnostics.skippedSaleCount, 0);
  assert.equal(diagnostics.partialAttentionSaleCount, 0);
  assert.deepEqual(diagnostics.samples, []);
});

test("buildPosDepletionDiagnostics skips unmapped recipe sales", () => {
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId,
    operatingDate,
    sales: [sale({ item_name: "Wings", id: "sale-wings" })],
    mappings: [mapping()],
    inventoryItems: [inventory()]
  });

  assert.equal(diagnostics.skippedSaleCount, 1);
  assert.equal(diagnostics.countsByReason.unmapped_recipe, 1);
  assert.deepEqual(diagnostics.uniqueUnmappedItemNames, ["Wings"]);
  assert.equal(diagnostics.samples[0]?.reason, "unmapped_recipe");
});

test("buildPosDepletionDiagnostics skips unverified provider identity sales", () => {
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId,
    operatingDate,
    sales: [
      sale({
        id: "sale-square",
        source_pos: "Square",
        provider_location_id: "loc-1",
        provider_catalog_item_id: "cat-1",
        provider_variation_id: "var-1",
        item_name: "Square Burger"
      })
    ],
    mappings: [mapping({ menu_item_name: "Square Burger", menu_item_id: "menu-burger" })],
    inventoryItems: [inventory()],
    providerMappings: []
  });

  assert.equal(diagnostics.skippedSaleCount, 1);
  assert.equal(diagnostics.countsByReason.unverified_provider_mapping, 1);
  assert.deepEqual(diagnostics.uniqueUnverifiedItemNames, ["Square Burger"]);
});

test("buildPosDepletionDiagnostics depletes verified provider sales through menu identity", () => {
  const providerMappings: VerifiedProviderSaleMapping[] = [
    {
      restaurantId,
      sourcePos: "square",
      providerLocationId: "loc-1",
      externalCatalogItemId: "cat-1",
      externalVariationId: "var-1",
      menuItemId: "menu-burger"
    }
  ];
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId,
    operatingDate,
    sales: [
      sale({
        id: "sale-square",
        source_pos: "Square",
        provider_location_id: "loc-1",
        provider_catalog_item_id: "cat-1",
        provider_variation_id: "var-1",
        item_name: "Square Burger"
      })
    ],
    mappings: [mapping({ menu_item_name: "Square Burger", menu_item_id: "menu-burger" })],
    inventoryItems: [inventory()],
    providerMappings
  });

  assert.equal(diagnostics.depletingSaleCount, 1);
  assert.equal(diagnostics.skippedSaleCount, 0);
});

test("buildPosDepletionDiagnostics skips fully incompatible recipe units", () => {
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId,
    operatingDate,
    sales: [sale()],
    mappings: [mapping({ unit: "each" })],
    inventoryItems: [inventory({ unit: "lb" })]
  });

  assert.equal(diagnostics.skippedSaleCount, 1);
  assert.equal(diagnostics.countsByReason.incompatible_recipe_units, 1);
  assert.deepEqual(diagnostics.uniqueIncompatibleItemNames, ["Burger"]);
});

test("buildPosDepletionDiagnostics marks partial attention when some ingredients still deplete", () => {
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId,
    operatingDate,
    sales: [sale()],
    mappings: [
      mapping({ id: "map-ok", unit: "lb" }),
      mapping({
        id: "map-bad",
        inventory_item_id: "inv-bun",
        unit: "each"
      })
    ],
    inventoryItems: [
      inventory(),
      inventory({ id: "inv-bun", item_name: "Bun", unit: "pack" })
    ]
  });

  assert.equal(diagnostics.depletingSaleCount, 1);
  assert.equal(diagnostics.skippedSaleCount, 0);
  assert.equal(diagnostics.partialAttentionSaleCount, 1);
  assert.deepEqual(diagnostics.uniqueIncompatibleItemNames, ["Burger"]);
});

test("buildPosDepletionDiagnostics ignores other restaurants and non-today sales", () => {
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId,
    operatingDate,
    sales: [
      sale({ id: "other-day", sale_date: "2026-09-01", item_name: "Old" }),
      sale({ id: "other-tenant", restaurant_id: "rest-2", item_name: "Alien" }),
      sale({ id: "zero", quantity_sold: 0 })
    ],
    mappings: [],
    inventoryItems: []
  });

  assert.equal(diagnostics.todaySaleCount, 0);
  assert.equal(diagnostics.skippedSaleCount, 0);
});

test("assertPosDepletionDiagnosticsTenantScoped refuses cross-tenant payloads", () => {
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId,
    operatingDate,
    sales: [],
    mappings: [],
    inventoryItems: []
  });
  assert.throws(
    () => assertPosDepletionDiagnosticsTenantScoped(diagnostics, "rest-2"),
    /crossed restaurant scope/
  );
});
