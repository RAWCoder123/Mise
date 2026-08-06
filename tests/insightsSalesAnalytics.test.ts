import assert from "node:assert/strict";
import test from "node:test";

import { buildInsightsSalesAnalytics } from "../services/domain/insightsSalesAnalytics";
import type { PosSale } from "../types/mise";

function sale(overrides: Partial<PosSale> & Pick<PosSale, "item_name" | "sale_date">): PosSale {
  return {
    id: overrides.id ?? `sale_${overrides.item_name}_${overrides.sale_date}`,
    restaurant_id: overrides.restaurant_id ?? "r1",
    sale_date: overrides.sale_date,
    item_name: overrides.item_name,
    category: overrides.category ?? "Mains",
    quantity_sold: overrides.quantity_sold ?? 1,
    gross_sales: overrides.gross_sales ?? 10,
    net_sales: overrides.net_sales ?? 9,
    source_pos: overrides.source_pos ?? "square",
    created_at: overrides.created_at ?? "2026-08-01T12:00:00.000Z"
  };
}

test("buildInsightsSalesAnalytics ranks best sellers and category mix", () => {
  const analytics = buildInsightsSalesAnalytics({
    restaurantId: "r1",
    throughDate: "2026-08-01",
    lookbackDays: 7,
    sales: [
      sale({ item_name: "Chicken Bowl", category: "Mains", quantity_sold: 12, gross_sales: 120, sale_date: "2026-08-01" }),
      sale({ item_name: "Iced Tea", category: "Drinks", quantity_sold: 20, gross_sales: 60, sale_date: "2026-08-01" }),
      sale({ item_name: "Chicken Bowl", category: "Mains", quantity_sold: 4, gross_sales: 40, sale_date: "2026-07-31" }),
      sale({
        item_name: "Other Shop",
        restaurant_id: "r2",
        category: "Mains",
        quantity_sold: 99,
        gross_sales: 999,
        sale_date: "2026-08-01"
      })
    ]
  });

  assert.equal(analytics.bestSellers[0]?.itemName, "Chicken Bowl");
  assert.equal(analytics.bestSellers[0]?.quantity, 16);
  assert.equal(analytics.categoryMix[0]?.label, "Mains");
  assert.ok(analytics.categoryMix[0]!.share > analytics.categoryMix[1]!.share);
  assert.equal(analytics.totalUnits, 36);
  assert.equal(analytics.sourceMix[0]?.label, "square");
});

test("buildInsightsSalesAnalytics fills units trend across the window", () => {
  const analytics = buildInsightsSalesAnalytics({
    restaurantId: "r1",
    throughDate: "2026-08-03",
    lookbackDays: 3,
    sales: [
      sale({ item_name: "Soup", sale_date: "2026-08-01", quantity_sold: 2, gross_sales: 20 }),
      sale({ item_name: "Soup", sale_date: "2026-08-03", quantity_sold: 5, gross_sales: 50 })
    ]
  });

  assert.deepEqual(
    analytics.unitsTrend.map((point) => [point.date, point.units]),
    [
      ["2026-08-01", 2],
      ["2026-08-02", 0],
      ["2026-08-03", 5]
    ]
  );
  assert.equal(analytics.weekdayMix.length, 7);
  assert.ok(analytics.weekdayMix.some((slice) => slice.value > 0));
});
