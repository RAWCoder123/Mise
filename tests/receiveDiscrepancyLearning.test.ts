import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyReceiveFillBias,
  buildChronicShortShipInsightInput,
  buildReceiveFillBiasByItem,
  extractReceiveSamplesFromMovements,
  receiveFillBiasReasonFragment,
  type ReceiveDiscrepancySample
} from "../services/domain/receiveDiscrepancyLearning";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import { deriveOperationalTodayTasks } from "../services/domain/todayTasks";

const itemId = "item_tomatoes";
const now = Date.parse("2026-08-02T12:00:00.000Z");

function sample(
  overrides: Partial<ReceiveDiscrepancySample> & { daysAgo?: number } = {}
): ReceiveDiscrepancySample {
  const daysAgo = overrides.daysAgo ?? 1;
  const { daysAgo: _ignored, ...rest } = overrides;
  return {
    inventoryItemId: itemId,
    quantityOrdered: 10,
    quantityReceived: 8,
    discrepancy: -2,
    createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    supplierOrderId: `order_${daysAgo}`,
    ...rest
  };
}

test("extractReceiveSamplesFromMovements reads receiving ledger metadata only", () => {
  const samples = extractReceiveSamplesFromMovements([
    {
      inventory_item_id: itemId,
      reason: "receiving",
      created_at: "2026-08-01T10:00:00.000Z",
      metadata: {
        quantity_ordered: 10,
        quantity_received: 9,
        discrepancy: -1,
        supplier_order_id: "order_1"
      }
    },
    {
      inventory_item_id: itemId,
      reason: "waste",
      created_at: "2026-08-01T11:00:00.000Z",
      metadata: { quantity_ordered: 10, quantity_received: 1 }
    },
    {
      inventory_item_id: itemId,
      reason: "receiving",
      created_at: "2026-08-01T12:00:00.000Z",
      metadata: { quantity_ordered: 0, quantity_received: 1 }
    }
  ]);
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.quantityOrdered, 10);
  assert.equal(samples[0]?.quantityReceived, 9);
  assert.equal(samples[0]?.discrepancy, -1);
});

test("one abnormal short-ship does not create chronic bias", () => {
  const bias = buildReceiveFillBiasByItem(
    [sample({ quantityReceived: 1, discrepancy: -9, daysAgo: 1 })],
    now
  );
  assert.equal(bias.size, 0);
});

test("chronic short-ships produce bounded fill-rate padding", () => {
  const biasMap = buildReceiveFillBiasByItem(
    [
      sample({ daysAgo: 1, quantityReceived: 8, discrepancy: -2 }),
      sample({ daysAgo: 2, quantityReceived: 9, discrepancy: -1 }),
      sample({ daysAgo: 3, quantityReceived: 8, discrepancy: -2 }),
      sample({ daysAgo: 4, quantityReceived: 7, discrepancy: -3 }),
      sample({ daysAgo: 5, quantityReceived: 8, discrepancy: -2 })
    ],
    now
  );
  const bias = biasMap.get(itemId);
  assert.ok(bias);
  assert.equal(bias.isChronic, true);
  assert.ok(bias.medianFillRatio <= 0.92);
  assert.ok(bias.multiplier > 1);
  assert.ok(bias.multiplier <= 1.25);

  const padded = applyReceiveFillBias(10, bias, { calculated: 10, par: 20 });
  assert.ok(padded != null);
  assert.ok(padded! >= 10);
  assert.ok(padded! <= Math.ceil(10 * 1.25));
  assert.match(receiveFillBiasReasonFragment(bias), /short-ship pattern/i);
  assert.ok(buildChronicShortShipInsightInput(bias));
});

test("zero fill is winsorized so multiplier cannot explode", () => {
  const biasMap = buildReceiveFillBiasByItem(
    [
      sample({ daysAgo: 1, quantityReceived: 0, discrepancy: -10 }),
      sample({ daysAgo: 2, quantityReceived: 0, discrepancy: -10 }),
      sample({ daysAgo: 3, quantityReceived: 0, discrepancy: -10 })
    ],
    now
  );
  const bias = biasMap.get(itemId);
  assert.ok(bias);
  assert.equal(bias.multiplier, 1.25);
  const padded = applyReceiveFillBias(8, bias, { calculated: 8, par: 10 });
  assert.equal(padded, 10);
});

test("calculateOperationalSignals pads low-stock qty and emits chronic ordering insight", () => {
  const signals = calculateOperationalSignals({
    restaurantId: "rest_1",
    operatingDate: "2026-08-02",
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: "rest_1",
        item_name: "Tomatoes",
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
    receivingHistory: [
      sample({ daysAgo: 1 }),
      sample({ daysAgo: 2 }),
      sample({ daysAgo: 3 }),
      sample({ daysAgo: 4 }),
      sample({ daysAgo: 5 })
    ]
  });

  assert.equal(signals.recommendations.length, 1);
  assert.ok(signals.recommendations[0]!.recommended_quantity > 18);
  assert.match(signals.recommendations[0]!.reason, /short-ship pattern/i);
  const shortShip = signals.insights.find((insight) => insight.id === `insight_shortship_${itemId}`);
  assert.ok(shortShip);
  assert.equal(shortShip.insight_type, "ordering");
  assert.equal(shortShip.presentation.code, "insight.rule.ordering.chronic_short_ship");
});

test("Today surfaces chronic short-ship as a manager task on Orders", () => {
  const tasks = deriveOperationalTodayTasks({
    restaurantId: "rest_1",
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    chronicShortShipItems: [
      {
        inventoryItemId: itemId,
        itemName: "Tomatoes",
        supplierName: "Sysco",
        fillPercent: 80,
        sampleCount: 5
      }
    ]
  });
  const task = tasks.find((entry) => entry.source.id === `chronic_short_ship_${itemId}`);
  assert.ok(task);
  assert.equal(task.requiredRole, "manager");
  assert.equal(task.action.route, "/orders");
  assert.equal(task.presentation?.code, "today.ordering.chronic_short_ship");
});
