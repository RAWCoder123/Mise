import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyLossBias,
  buildChronicCountShrinkInsightInput,
  buildChronicWasteInsightInput,
  buildCountShrinkBiasByItem,
  buildWasteBiasByItem,
  extractCountVarianceSamplesFromMovements,
  extractWasteSamplesFromMovements,
  lossBiasReasonFragment,
  type CountVarianceSample,
  type WasteSample
} from "../services/domain/wasteVarianceLearning";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import { deriveOperationalTodayTasks } from "../services/domain/todayTasks";

const itemId = "item_lettuce";
const now = Date.parse("2026-08-02T12:00:00.000Z");

function wasteSample(
  overrides: Partial<WasteSample> & { daysAgo?: number } = {}
): WasteSample {
  const daysAgo = overrides.daysAgo ?? 1;
  const { daysAgo: _ignored, ...rest } = overrides;
  return {
    inventoryItemId: itemId,
    quantityRemoved: 2,
    quantityBefore: 20,
    createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    ...rest
  };
}

function countSample(
  overrides: Partial<CountVarianceSample> & { daysAgo?: number } = {}
): CountVarianceSample {
  const daysAgo = overrides.daysAgo ?? 1;
  const { daysAgo: _ignored, ...rest } = overrides;
  return {
    inventoryItemId: itemId,
    quantityBefore: 20,
    quantityAfter: 16,
    variance: -4,
    createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    sessionId: `session_${daysAgo}`,
    ...rest
  };
}

test("extractWasteSamplesFromMovements reads waste ledger metadata only", () => {
  const samples = extractWasteSamplesFromMovements([
    {
      inventory_item_id: itemId,
      reason: "waste",
      quantity_before: 20,
      quantity_after: 18,
      created_at: "2026-08-01T10:00:00.000Z",
      metadata: {
        quantity_removed_applied: 2,
        quantity_removed_requested: 2,
        floored: false
      }
    },
    {
      inventory_item_id: itemId,
      reason: "receiving",
      quantity_before: 10,
      quantity_after: 18,
      created_at: "2026-08-01T11:00:00.000Z",
      metadata: { quantity_removed_applied: 8 }
    },
    {
      inventory_item_id: itemId,
      reason: "waste",
      quantity_before: 5,
      quantity_after: 5,
      created_at: "2026-08-01T12:00:00.000Z",
      metadata: { quantity_removed_applied: 0 }
    }
  ]);
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.quantityRemoved, 2);
  assert.equal(samples[0]?.quantityBefore, 20);
});

test("extractCountVarianceSamplesFromMovements reads manual_count variance only", () => {
  const samples = extractCountVarianceSamplesFromMovements([
    {
      inventory_item_id: itemId,
      reason: "manual_count",
      quantity_before: 20,
      quantity_after: 16,
      created_at: "2026-08-01T10:00:00.000Z",
      metadata: {
        session_id: "session_1",
        system_quantity_at_start: 20,
        variance_from_system: -4
      }
    },
    {
      inventory_item_id: itemId,
      reason: "waste",
      quantity_before: 20,
      quantity_after: 18,
      created_at: "2026-08-01T11:00:00.000Z",
      metadata: { variance_from_system: -2 }
    },
    {
      inventory_item_id: itemId,
      reason: "manual_count",
      quantity_before: 10,
      quantity_after: 10,
      created_at: "2026-08-01T12:00:00.000Z",
      metadata: { variance_from_system: 0 }
    }
  ]);
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.variance, -4);
  assert.equal(samples[0]?.sessionId, "session_1");
});

test("one abnormal waste event does not create chronic bias", () => {
  const bias = buildWasteBiasByItem(
    [wasteSample({ quantityRemoved: 18, quantityBefore: 20, daysAgo: 1 })],
    now
  );
  assert.equal(bias.size, 0);
});

test("chronic waste produces bounded loss padding", () => {
  const biasMap = buildWasteBiasByItem(
    [
      wasteSample({ daysAgo: 1, quantityRemoved: 3, quantityBefore: 20 }),
      wasteSample({ daysAgo: 2, quantityRemoved: 2, quantityBefore: 18 }),
      wasteSample({ daysAgo: 3, quantityRemoved: 3, quantityBefore: 22 }),
      wasteSample({ daysAgo: 4, quantityRemoved: 2, quantityBefore: 19 }),
      wasteSample({ daysAgo: 5, quantityRemoved: 3, quantityBefore: 21 })
    ],
    now
  );
  const bias = biasMap.get(itemId);
  assert.ok(bias);
  assert.equal(bias.isChronic, true);
  assert.ok(bias.medianLossRatio >= 0.08);
  assert.ok(bias.multiplier > 1);
  assert.ok(bias.multiplier <= 1.2);

  const padded = applyLossBias(10, bias, { calculated: 10, par: 20 });
  assert.ok(padded != null);
  assert.ok(padded! >= 10);
  assert.ok(padded! <= Math.ceil(10 * 1.2));
  assert.match(lossBiasReasonFragment(bias), /waste pattern/i);
  assert.ok(buildChronicWasteInsightInput(bias));
});

test("chronic count shrink produces bounded loss padding", () => {
  const biasMap = buildCountShrinkBiasByItem(
    [
      countSample({ daysAgo: 1, quantityBefore: 20, quantityAfter: 16, variance: -4 }),
      countSample({ daysAgo: 2, quantityBefore: 18, quantityAfter: 15, variance: -3 }),
      countSample({ daysAgo: 3, quantityBefore: 22, quantityAfter: 18, variance: -4 }),
      countSample({ daysAgo: 4, quantityBefore: 19, quantityAfter: 16, variance: -3 })
    ],
    now
  );
  const bias = biasMap.get(itemId);
  assert.ok(bias);
  assert.equal(bias.isChronic, true);
  assert.ok(bias.multiplier > 1);
  assert.ok(bias.multiplier <= 1.2);
  assert.match(lossBiasReasonFragment(bias), /count shrink/i);
  assert.ok(buildChronicCountShrinkInsightInput(bias));
});

test("extreme loss ratios are winsorized so multiplier cannot explode", () => {
  const biasMap = buildWasteBiasByItem(
    [
      wasteSample({ daysAgo: 1, quantityRemoved: 20, quantityBefore: 20 }),
      wasteSample({ daysAgo: 2, quantityRemoved: 19, quantityBefore: 19 }),
      wasteSample({ daysAgo: 3, quantityRemoved: 18, quantityBefore: 18 })
    ],
    now
  );
  const bias = biasMap.get(itemId);
  assert.ok(bias);
  assert.equal(bias.multiplier, 1.2);
  const padded = applyLossBias(8, bias, { calculated: 8, par: 10 });
  assert.equal(padded, 10);
});

test("calculateOperationalSignals pads low-stock qty and emits chronic waste insight", () => {
  const signals = calculateOperationalSignals({
    restaurantId: "rest_1",
    operatingDate: "2026-08-02",
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: "rest_1",
        item_name: "Lettuce",
        supplier_name: "Sysco",
        unit: "lb",
        current_quantity: 2,
        par_level: 20,
        reorder_threshold: 8,
        last_updated: "2026-08-02T08:00:00.000Z"
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [],
    wasteHistory: [
      wasteSample({ daysAgo: 1 }),
      wasteSample({ daysAgo: 2 }),
      wasteSample({ daysAgo: 3 }),
      wasteSample({ daysAgo: 4 }),
      wasteSample({ daysAgo: 5 })
    ]
  });

  assert.equal(signals.recommendations.length, 1);
  assert.ok(signals.recommendations[0]!.recommended_quantity > 18);
  assert.match(signals.recommendations[0]!.reason, /waste pattern/i);
  const chronicWaste = signals.insights.find((insight) => insight.id === `insight_waste_${itemId}`);
  assert.ok(chronicWaste);
  assert.equal(chronicWaste.insight_type, "waste");
  assert.equal(chronicWaste.presentation.code, "insight.rule.waste.chronic_waste");
});

test("calculateOperationalSignals emits chronic count-shrink insight", () => {
  const signals = calculateOperationalSignals({
    restaurantId: "rest_1",
    operatingDate: "2026-08-02",
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: "rest_1",
        item_name: "Lettuce",
        supplier_name: "Sysco",
        unit: "lb",
        current_quantity: 2,
        par_level: 20,
        reorder_threshold: 8,
        last_updated: "2026-08-02T08:00:00.000Z"
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [],
    countVarianceHistory: [
      countSample({ daysAgo: 1 }),
      countSample({ daysAgo: 2 }),
      countSample({ daysAgo: 3 }),
      countSample({ daysAgo: 4 })
    ]
  });

  const shrink = signals.insights.find((insight) => insight.id === `insight_count_shrink_${itemId}`);
  assert.ok(shrink);
  assert.equal(shrink.insight_type, "inventory");
  assert.equal(shrink.presentation.code, "insight.rule.inventory.chronic_count_shrink");
  assert.match(signals.recommendations[0]!.reason, /count shrink/i);
});

test("Today surfaces chronic waste as a manager task on Inventory", () => {
  const tasks = deriveOperationalTodayTasks({
    restaurantId: "rest_1",
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    chronicWasteItems: [
      {
        inventoryItemId: itemId,
        itemName: "Lettuce",
        lossPercent: 10,
        sampleCount: 5
      }
    ]
  });
  const task = tasks.find((entry) => entry.source.id === `chronic_waste_${itemId}`);
  assert.ok(task);
  assert.equal(task.requiredRole, "manager");
  assert.equal(task.action.route, "/inventory");
  assert.equal(task.presentation?.code, "today.waste.chronic_waste");
});

test("Today surfaces chronic count shrink as a manager task on Inventory count", () => {
  const tasks = deriveOperationalTodayTasks({
    restaurantId: "rest_1",
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    chronicCountShrinkItems: [
      {
        inventoryItemId: itemId,
        itemName: "Lettuce",
        lossPercent: 18,
        sampleCount: 4
      }
    ]
  });
  const task = tasks.find((entry) => entry.source.id === `chronic_count_shrink_${itemId}`);
  assert.ok(task);
  assert.equal(task.requiredRole, "manager");
  assert.equal(task.action.route, "/inventory/count");
  assert.equal(task.presentation?.code, "today.inventory.chronic_count_shrink");
});
