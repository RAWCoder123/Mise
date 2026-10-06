import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildLearnedOrderQuantities,
  buildRecipeBaselineSummary
} from "../services/domain/miseDomain";
import type {
  InventoryItem,
  MenuItemIngredient,
  PosSale,
  PurchaseRecommendation
} from "../types/mise";

const domainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-a";
const operatingDate = "2026-10-06";

function baseSale(overrides: Partial<PosSale> = {}): PosSale {
  return {
    id: "sale-1",
    restaurant_id: restaurantId,
    item_name: "Chicken Bowl",
    category: "Entree",
    quantity_sold: 4,
    gross_sales: 40,
    net_sales: 40,
    sale_date: operatingDate,
    source_pos: "manual",
    created_at: `${operatingDate}T12:00:00.000Z`,
    ...overrides
  };
}

test("MISE-005JF pins miseDomain menu-item identity normalize to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JF/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("function normalizeMenuItemKey("),
    domainSource.indexOf("export function recommendationReason")
  );

  assert.match(normalizeBody, /asciiCLower\(value\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s\+/);

  const learnedKeyBody = domainSource.slice(
    domainSource.indexOf("function learnedQuantityKey("),
    domainSource.indexOf("export function boundedLearnedQuantity")
  );
  assert.match(learnedKeyBody, /normalizeMenuItemKey\(unit\)/);
  assert.doesNotMatch(learnedKeyBody, /\.toLowerCase\(\)/);
});

test("recipe baseline sold keys keep Kelvin-sign names distinct under ASCII C", () => {
  const inventory: InventoryItem[] = [
    {
      id: "inv-chicken",
      restaurant_id: restaurantId,
      item_name: "Chicken breast",
      category: "Protein",
      current_quantity: 10,
      unit: "lb",
      par_level: 20,
      reorder_threshold: 8,
      estimated_unit_cost: 4,
      supplier_id: "supplier-1",
      supplier_name: "North Market",
      last_updated: `${operatingDate}T08:00:00.000Z`
    }
  ];
  const mappings: MenuItemIngredient[] = [
    {
      id: "map-1",
      restaurant_id: restaurantId,
      menu_item_name: "Chicken Bowl",
      inventory_item_id: "inv-chicken",
      quantity_used_per_sale: 0.5,
      unit: "lb"
    }
  ];
  const sales: PosSale[] = [
    baseSale({ id: "sale-ascii", item_name: "Chicken Bowl", quantity_sold: 3 }),
    // Unicode toLowerCase would fold K → k and collapse both into one sold key.
    baseSale({ id: "sale-kelvin", item_name: "Khicken Bowl", quantity_sold: 2 })
  ];

  const summary = buildRecipeBaselineSummary(
    restaurantId,
    sales,
    mappings,
    inventory,
    operatingDate
  );

  assert.match(summary.operatorCopy, /of 2 POS menu items/);
  // Coverage still counts the Kelvin-named sale via name matching until
  // providerSaleIdentity (#673) is also ASCII C pinned; this tip only proves
  // sold-key cardinality does not collapse under Unicode fold.
  assert.equal(summary.posItemsCovered >= 1, true);
});

test("learned quantity keys fold ASCII case but do not invent Kelvin unit aliases", () => {
  const history: PurchaseRecommendation[] = [
    {
      id: "rec-1",
      restaurant_id: restaurantId,
      inventory_item_id: "inv-flour",
      item_name: "Flour",
      recommended_quantity: 10,
      unit: "KG",
      supplier_id: "supplier-1",
      supplier_name: "North Market",
      reason: "restock",
      status: "approved",
      urgency: "medium",
      supplier_order_id: null,
      created_at: "2026-09-01T12:00:00.000Z"
    },
    {
      id: "rec-2",
      restaurant_id: restaurantId,
      inventory_item_id: "inv-flour",
      item_name: "Flour",
      recommended_quantity: 12,
      unit: "kg",
      supplier_id: "supplier-1",
      supplier_name: "North Market",
      reason: "restock",
      status: "approved",
      urgency: "medium",
      supplier_order_id: null,
      created_at: "2026-09-08T12:00:00.000Z"
    },
    {
      id: "rec-3",
      restaurant_id: restaurantId,
      inventory_item_id: "inv-flour",
      item_name: "Flour",
      recommended_quantity: 14,
      unit: "kg",
      supplier_id: "supplier-1",
      supplier_name: "North Market",
      reason: "restock",
      status: "ordered",
      urgency: "medium",
      supplier_order_id: null,
      created_at: "2026-09-15T12:00:00.000Z"
    },
    // Unicode toLowerCase would fold KG → kg and pollute the kg learning bucket.
    {
      id: "rec-kelvin-1",
      restaurant_id: restaurantId,
      inventory_item_id: "inv-flour",
      item_name: "Flour",
      recommended_quantity: 90,
      unit: "KG",
      supplier_id: "supplier-1",
      supplier_name: "North Market",
      reason: "restock",
      status: "approved",
      urgency: "medium",
      supplier_order_id: null,
      created_at: "2026-09-02T12:00:00.000Z"
    },
    {
      id: "rec-kelvin-2",
      restaurant_id: restaurantId,
      inventory_item_id: "inv-flour",
      item_name: "Flour",
      recommended_quantity: 95,
      unit: "KG",
      supplier_id: "supplier-1",
      supplier_name: "North Market",
      reason: "restock",
      status: "approved",
      urgency: "medium",
      supplier_order_id: null,
      created_at: "2026-09-09T12:00:00.000Z"
    },
    {
      id: "rec-kelvin-3",
      restaurant_id: restaurantId,
      inventory_item_id: "inv-flour",
      item_name: "Flour",
      recommended_quantity: 100,
      unit: "KG",
      supplier_id: "supplier-1",
      supplier_name: "North Market",
      reason: "restock",
      status: "approved",
      urgency: "medium",
      supplier_order_id: null,
      created_at: "2026-09-16T12:00:00.000Z"
    }
  ];

  const learned = buildLearnedOrderQuantities(restaurantId, history);

  // ASCII KG/kg samples merge into one median key.
  assert.equal(learned.get("inv-flour::kg"), 12);
  // Kelvin-prefixed unit stays out of the kg bucket under ASCII C.
  assert.equal(learned.get("inv-flour::Kg"), 95);
});
