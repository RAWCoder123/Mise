import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { posSaleQuantityDelta } from "../services/domain/posSaleQuantity";
import {
  saleMatchesRecipe,
  type VerifiedProviderSaleMapping
} from "../services/domain/providerSaleIdentity";
import { normalizeOrderSales } from "../supabase/functions/_shared/square.ts";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";

const restaurantA = "restaurant-a";
const chickenMenuId = "menu-chicken";
const chickenItemId = "inventory-chicken";
const supplierId = "44444444-4444-4444-8444-444444444444";
const operatingDate = "2026-09-02";

const inventoryItem: InventoryItem = {
  id: chickenItemId,
  restaurant_id: restaurantA,
  item_name: "Chicken",
  category: "Protein",
  unit: "each",
  current_quantity: 20,
  par_level: 30,
  reorder_threshold: 10,
  estimated_unit_cost: 1,
  supplier_id: supplierId,
  supplier_name: "Supplier",
  last_updated: "2026-09-02T00:00:00.000Z"
};

const recipe: MenuItemIngredient = {
  id: "recipe-chicken",
  restaurant_id: restaurantA,
  menu_item_id: chickenMenuId,
  menu_item_name: "Chicken Sandwich",
  inventory_item_id: chickenItemId,
  quantity_used_per_sale: 1,
  unit: "each"
};

const verifiedMappings: VerifiedProviderSaleMapping[] = [{
  restaurantId: restaurantA,
  sourcePos: "square",
  providerLocationId: "loc-a",
  externalCatalogItemId: "ITEM-A",
  externalVariationId: "VAR-A",
  menuItemId: chickenMenuId
}];

function squareSale(overrides: Partial<PosSale> = {}): PosSale {
  return {
    id: "sale-1",
    restaurant_id: restaurantA,
    source_record_id: "square-order-line-1",
    provider_catalog_item_id: "ITEM-A",
    provider_variation_id: "VAR-A",
    provider_location_id: "loc-a",
    record_kind: "sale",
    sale_date: operatingDate,
    item_name: "Chicken Sandwich",
    category: "Square",
    quantity_sold: 2,
    gross_sales: 20,
    net_sales: 20,
    source_pos: "Square",
    created_at: "2026-09-02T12:00:00.000Z",
    ...overrides
  };
}

test("posSaleQuantityDelta keeps sales positive and flips returns", () => {
  assert.equal(posSaleQuantityDelta(squareSale({ quantity_sold: 3 })), 3);
  assert.equal(
    posSaleQuantityDelta(squareSale({ record_kind: "return", quantity_sold: 1 })),
    -1
  );
  assert.equal(posSaleQuantityDelta(squareSale({ quantity_sold: 0 })), 0);
});

test("Square normalizer emits itemized returns with positive quantity and return kind", () => {
  const rows = normalizeOrderSales({
    id: "order-return-1",
    location_id: "loc-a",
    closed_at: "2026-09-02T15:00:00.000Z",
    line_items: [],
    returns: [
      {
        uid: "ret-1",
        source_order_id: "order-original",
        return_line_items: [
          {
            uid: "ret-line-1",
            source_line_item_uid: "line-1",
            name: "Chicken Sandwich",
            quantity: "1",
            catalog_object_id: "VAR-A",
            gross_return_money: { amount: 1000, currency: "USD" },
            total_money: { amount: 1000, currency: "USD" }
          }
        ]
      }
    ]
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.record_kind, "return");
  assert.equal(rows[0]?.quantity_sold, 1);
  assert.equal(rows[0]?.gross_sales, 10);
  assert.equal(rows[0]?.source_record_id, "square_order-return-1_return_ret-line-1");
  assert.equal(rows[0]?.provider_variation_id, "VAR-A");
  assert.equal(rows[0]?.provider_location_id, "loc-a");
});

test("a same-day return reduces projected POS depletion without inventing negative stock", () => {
  const sales = [
    squareSale({ id: "sale-a", quantity_sold: 2 }),
    squareSale({
      id: "return-a",
      source_record_id: "square-order-return-1",
      record_kind: "return",
      quantity_sold: 1,
      gross_sales: 10,
      net_sales: 10
    })
  ];
  assert.ok(saleMatchesRecipe(sales[0]!, recipe, verifiedMappings));
  const prediction = buildInventoryPrediction(
    inventoryItem,
    sales,
    [recipe],
    operatingDate,
    undefined,
    undefined,
    undefined,
    verifiedMappings
  );
  // 20 on hand − (2 − 1) sold = 19
  assert.equal(prediction.projectedQuantity, 19);
});

test("migration pins record_kind and return-safe planning fetch", async () => {
  const { readFileSync } = await import("node:fs");
  const migration = readFileSync(
    "supabase/migrations/20260902190000_pos_sale_return_record_kind.sql",
    "utf8"
  );
  assert.match(migration, /record_kind in \('sale', 'return'\)/);
  assert.match(migration, /record_kind = excluded\.record_kind/);
  assert.match(migration, /return_rows as/);
  assert.match(migration, /coalesce\(sale\.record_kind, 'sale'\) = 'sale'/);
  assert.match(migration, /service_apply_square_sync_result_mise_003a_base/);
});
