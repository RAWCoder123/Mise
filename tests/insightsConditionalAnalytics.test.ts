import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { catalogs, type MessageKey } from "../i18n/catalog";
import { buildConditionalAnalyticsSummary } from "../services/domain/miseDomain";
import type { InventoryItem, MenuItemIngredient, PosSale, SupplierOrder } from "../types/mise";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const CONDITIONAL_KEYS = [
  "insights.conditional.title",
  "insights.conditional.subtitle",
  "insights.conditional.ready",
  "insights.conditional.waiting",
  "insights.conditional.salesRhythm.label",
  "insights.conditional.salesRhythm.ready",
  "insights.conditional.salesRhythm.empty",
  "insights.conditional.supplierTrend.label",
  "insights.conditional.supplierTrend.ready",
  "insights.conditional.supplierTrend.empty",
  "insights.conditional.recipeCoverage.label",
  "insights.conditional.recipeCoverage.ready",
  "insights.conditional.recipeCoverage.empty",
  "insights.conditional.supplierChart.title",
  "insights.conditional.supplierChart.subtitle",
  "insights.conditional.supplierChart.meta",
  "insights.conditional.supplierChart.accessibility",
  "insights.conditional.supplierChart.dayMeta",
  "insights.conditional.supplierChart.empty.title",
  "insights.conditional.openOrders",
  "insights.conditional.openRecipes"
] as const satisfies readonly MessageKey[];

test("Insights Sales surface loads and gates conditional analytics", () => {
  const screen = source("app/(tabs)/insights.tsx");
  const application = source("services/application/insights.ts");

  assert.match(application, /fetchConditionalAnalytics/);
  assert.match(application, /Conditional analytics failed restaurant scope validation/);
  assert.match(screen, /fetchConditionalAnalytics/);
  assert.match(screen, /setConditionalAnalytics/);
  assert.match(screen, /visibleConditionalAnalytics\s*=\s*hubReady\s*\?\s*conditionalAnalytics\s*:\s*null/);
  assert.match(screen, /ConditionalAnalyticsBoard/);
  assert.match(screen, /canShowSupplierTrend/);
  assert.match(screen, /canShowRecipeCoverage/);
  assert.match(screen, /canShowSalesRhythm/);
  assert.match(screen, /insights\.conditional\./);
});

test("conditional analytics catalog keys exist in EN, ES, and zh-Hans", () => {
  for (const locale of ["en", "es", "zh-Hans"] as const) {
    const catalog = catalogs[locale];
    for (const key of CONDITIONAL_KEYS) {
      assert.equal(typeof catalog[key], "string", `${locale} missing ${key}`);
      assert.ok(catalog[key].trim().length > 0, `${locale} empty ${key}`);
    }
  }
});

test("supplier trend points use ISO day keys for locale-safe presentation", () => {
  const sales: PosSale[] = [
    {
      id: "s1",
      restaurant_id: "r1",
      sale_date: "2026-06-20",
      item_name: "Soup",
      category: "Mains",
      quantity_sold: 2,
      gross_sales: 20,
      net_sales: 18,
      source_pos: "square",
      created_at: "2026-06-20T12:00:00.000Z"
    },
    {
      id: "s2",
      restaurant_id: "r1",
      sale_date: "2026-06-21",
      item_name: "Soup",
      category: "Mains",
      quantity_sold: 3,
      gross_sales: 30,
      net_sales: 27,
      source_pos: "square",
      created_at: "2026-06-21T12:00:00.000Z"
    }
  ];
  const mappings: MenuItemIngredient[] = [
    {
      id: "m1",
      restaurant_id: "r1",
      menu_item_name: "Soup",
      inventory_item_id: "i1",
      quantity_used_per_sale: 1,
      unit: "ea"
    },
    {
      id: "m2",
      restaurant_id: "r1",
      menu_item_name: "Soup",
      inventory_item_id: "i2",
      quantity_used_per_sale: 1,
      unit: "ea"
    },
    {
      id: "m3",
      restaurant_id: "r1",
      menu_item_name: "Salad",
      inventory_item_id: "i3",
      quantity_used_per_sale: 1,
      unit: "ea"
    }
  ];
  const inventoryItems: InventoryItem[] = [
    {
      id: "i1",
      restaurant_id: "r1",
      item_name: "Stock A",
      category: "Dry",
      unit: "ea",
      current_quantity: 1,
      par_level: 2,
      reorder_threshold: 1,
      estimated_unit_cost: 1,
      supplier_id: "sup1",
      supplier_name: "Supplier",
      last_updated: "2026-06-21T12:00:00.000Z"
    },
    {
      id: "i2",
      restaurant_id: "r1",
      item_name: "Stock B",
      category: "Dry",
      unit: "ea",
      current_quantity: 1,
      par_level: 2,
      reorder_threshold: 1,
      estimated_unit_cost: 1,
      supplier_id: "sup1",
      supplier_name: "Supplier",
      last_updated: "2026-06-21T12:00:00.000Z"
    },
    {
      id: "i3",
      restaurant_id: "r1",
      item_name: "Stock C",
      category: "Dry",
      unit: "ea",
      current_quantity: 1,
      par_level: 2,
      reorder_threshold: 1,
      estimated_unit_cost: 1,
      supplier_id: "sup1",
      supplier_name: "Supplier",
      last_updated: "2026-06-21T12:00:00.000Z"
    }
  ];
  const orders: SupplierOrder[] = [
    {
      id: "o1",
      restaurant_id: "r1",
      supplier_id: "sup1",
      supplier_name: "Supplier",
      order_message: "one",
      operator_note: null,
      status: "sent",
      delivery_date: null,
      created_at: "2026-06-20T09:00:00.000Z"
    },
    {
      id: "o2",
      restaurant_id: "r1",
      supplier_id: "sup1",
      supplier_name: "Supplier",
      order_message: "two",
      operator_note: null,
      status: "completed",
      delivery_date: null,
      created_at: "2026-06-21T09:00:00.000Z"
    }
  ];

  const summary = buildConditionalAnalyticsSummary("r1", sales, mappings, inventoryItems, orders);

  assert.equal(summary.canShowSalesRhythm, true);
  assert.equal(summary.canShowSupplierTrend, true);
  assert.equal(summary.canShowRecipeCoverage, true);
  assert.deepEqual(
    summary.supplierTrend.map((point) => [point.label, point.orders]),
    [
      ["2026-06-20", 1],
      ["2026-06-21", 1]
    ]
  );
});
