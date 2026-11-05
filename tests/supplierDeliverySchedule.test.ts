import assert from "node:assert/strict";
import test from "node:test";

import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import {
  coverageMissesNextDelivery,
  daysUntilNextDelivery,
  formatOrderCutoffMinutes,
  isPastOrderCutoff,
  normalizeDeliveryDays,
  normalizeOrderCutoffMinutes,
  parseOrderCutoffInput,
  weekdayFromOperatingDate
} from "../services/domain/supplierDeliverySchedule";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const supplierId = "aaaaaaaa-0001-4001-8001-aaaaaaaaaaaa";
const itemId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

test("delivery day and cutoff normalizers clamp and coerce safely", () => {
  assert.deepEqual(normalizeDeliveryDays([1, 1, 8, -1, 3, "2"]), [1, 2, 3]);
  assert.deepEqual(normalizeDeliveryDays("nope"), []);
  assert.equal(normalizeOrderCutoffMinutes(90), 90);
  assert.equal(normalizeOrderCutoffMinutes(2000), null);
  assert.equal(normalizeOrderCutoffMinutes(""), null);
  assert.equal(parseOrderCutoffInput("14:05"), 845);
  assert.equal(parseOrderCutoffInput("25:00"), null);
  assert.equal(formatOrderCutoffMinutes(845), "14:05");
  assert.equal(formatOrderCutoffMinutes(null), "");
});

test("next delivery skips today after the local cutoff", () => {
  // 2026-11-05 is a Thursday (weekday 4).
  assert.equal(weekdayFromOperatingDate("2026-11-05"), 4);
  assert.equal(
    daysUntilNextDelivery({
      operatingDate: "2026-11-05",
      deliveryDays: [4, 6],
      orderCutoffMinutes: 14 * 60,
      localMinutes: 13 * 60
    }),
    0
  );
  assert.equal(
    daysUntilNextDelivery({
      operatingDate: "2026-11-05",
      deliveryDays: [4, 6],
      orderCutoffMinutes: 14 * 60,
      localMinutes: 15 * 60
    }),
    2
  );
  assert.equal(
    isPastOrderCutoff({
      operatingWeekday: 4,
      deliveryDays: [4],
      orderCutoffMinutes: 600,
      localMinutes: 601
    }),
    true
  );
  assert.equal(coverageMissesNextDelivery(1.5, 2), true);
  assert.equal(coverageMissesNextDelivery(2.1, 2), false);
  assert.equal(coverageMissesNextDelivery(null, 2), false);
  assert.equal(coverageMissesNextDelivery(1, null), false);
});

test("operational signals recommend when coverage cannot survive the next delivery", () => {
  const mappings: MenuItemIngredient[] = [
    {
      id: "map-1",
      restaurant_id: restaurantId,
      menu_item_id: null,
      menu_item_name: "Chicken plate",
      inventory_item_id: itemId,
      quantity_used_per_sale: 1,
      unit: "lb"
    }
  ];
  const historicalSales: PosSale[] = Array.from({ length: 10 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      id: `sale-hist-${day}`,
      restaurant_id: restaurantId,
      sale_date: `2026-10-${day}`,
      item_name: "Chicken plate",
      category: "Entrees",
      quantity_sold: 8,
      gross_sales: 80,
      net_sales: 80,
      source_pos: "Manual CSV Upload",
      created_at: `2026-10-${day}T12:00:00.000Z`
    };
  });
  const item: InventoryItem = {
    id: itemId,
    restaurant_id: restaurantId,
    item_name: "Chicken breast",
    category: "Protein",
    unit: "lb",
    current_quantity: 16,
    par_level: 40,
    reorder_threshold: 5,
    estimated_unit_cost: 3,
    supplier_id: supplierId,
    supplier_name: "Fresh Poultry",
    last_updated: "2026-11-05T12:00:00.000Z"
  };

  const withoutSchedule = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-11-05",
    inventoryItems: [item],
    sales: historicalSales,
    menuItemIngredients: mappings,
    recommendationHistory: []
  });
  assert.equal(withoutSchedule.recommendations.length, 0);

  const withSchedule = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-11-05",
    inventoryItems: [item],
    sales: historicalSales,
    menuItemIngredients: mappings,
    recommendationHistory: [],
    supplierSchedules: [
      {
        supplierId,
        deliveryDays: [0],
        orderCutoffMinutes: null
      }
    ]
  });
  // 16 lb / ~8 lb daily ≈ 2 days coverage; next Sunday delivery is 3 days away.
  assert.equal(withSchedule.recommendations.length, 1);
  assert.match(withSchedule.recommendations[0]?.reason ?? "", /next Fresh Poultry delivery/i);
  assert.match(withSchedule.insights[0]?.title ?? "", /next delivery window/i);
});
