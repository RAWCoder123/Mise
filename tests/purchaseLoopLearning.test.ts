import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPurchaseLoopCountBias,
  buildChronicCountShortInsightInput,
  buildPurchaseLoopCountBiasByItem,
  extractPurchaseLoopCountSamples,
  PURCHASE_LOOP_COUNT_MULTIPLIER_MAX,
  type PurchaseLoopCountSample
} from "../services/domain/purchaseLoopLearning";
import {
  PURCHASE_LOOP_COUNT_PHASE,
  PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION
} from "../services/domain/purchaseLoopOutcome";

const ITEM = "item-avocados";
const RESTAURANT = "restaurant-1";

function sample(
  overrides: Partial<PurchaseLoopCountSample> & {
    systemQuantityAtStart: number;
    countedQuantity: number;
    measuredAt: string;
  }
): PurchaseLoopCountSample {
  return {
    inventoryItemId: ITEM,
    varianceFromSystem: overrides.countedQuantity - overrides.systemQuantityAtStart,
    countSessionId: "count-1",
    supplierOrderId: "order-1",
    ...overrides
  };
}

test("extractPurchaseLoopCountSamples keeps only count-phase purchase-loop lines", () => {
  const samples = extractPurchaseLoopCountSamples(
    [
      {
        id: "o1",
        restaurantId: RESTAURANT,
        measuredAt: "2026-08-20T12:00:00.000Z",
        actualResult: {
          evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
          phase: "receive",
          lines: [
            {
              inventoryItemId: ITEM,
              systemQuantityAtStart: 10,
              countedQuantity: 7
            }
          ]
        }
      },
      {
        id: "o2",
        restaurantId: RESTAURANT,
        measuredAt: "2026-08-21T12:00:00.000Z",
        actualResult: {
          evidenceVersion: PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
          phase: PURCHASE_LOOP_COUNT_PHASE,
          countSessionId: "session-1",
          lines: [
            {
              inventoryItemId: ITEM,
              systemQuantityAtStart: 10,
              countedQuantity: 8,
              varianceFromSystem: -2,
              supplierOrderId: "order-9"
            },
            {
              inventoryItemId: ITEM,
              systemQuantityAtStart: 0,
              countedQuantity: 1
            }
          ]
        }
      }
    ],
    RESTAURANT
  );
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.systemQuantityAtStart, 10);
  assert.equal(samples[0]?.countedQuantity, 8);
  assert.equal(samples[0]?.varianceFromSystem, -2);
  assert.equal(samples[0]?.supplierOrderId, "order-9");
});

test("buildPurchaseLoopCountBiasByItem ignores sparse or healthy count history", () => {
  const now = Date.parse("2026-08-27T12:00:00.000Z");
  const sparse = buildPurchaseLoopCountBiasByItem(
    [
      sample({ systemQuantityAtStart: 10, countedQuantity: 7, measuredAt: "2026-08-20T12:00:00.000Z" }),
      sample({ systemQuantityAtStart: 10, countedQuantity: 8, measuredAt: "2026-08-18T12:00:00.000Z" })
    ],
    now
  );
  assert.equal(sparse.has(ITEM), false);

  const healthy = buildPurchaseLoopCountBiasByItem(
    [
      sample({ systemQuantityAtStart: 10, countedQuantity: 10, measuredAt: "2026-08-20T12:00:00.000Z" }),
      sample({ systemQuantityAtStart: 10, countedQuantity: 10, measuredAt: "2026-08-18T12:00:00.000Z" }),
      sample({ systemQuantityAtStart: 10, countedQuantity: 9, measuredAt: "2026-08-16T12:00:00.000Z" })
    ],
    now
  );
  const healthyBias = healthy.get(ITEM);
  assert.ok(healthyBias);
  assert.equal(healthyBias.isChronic, false);
  assert.equal(healthyBias.multiplier, 1);
});

test("buildPurchaseLoopCountBiasByItem marks chronic undercounts and caps the multiplier", () => {
  const now = Date.parse("2026-08-27T12:00:00.000Z");
  const bias = buildPurchaseLoopCountBiasByItem(
    [
      sample({ systemQuantityAtStart: 10, countedQuantity: 7, measuredAt: "2026-08-20T12:00:00.000Z" }),
      sample({ systemQuantityAtStart: 10, countedQuantity: 8, measuredAt: "2026-08-18T12:00:00.000Z" }),
      sample({ systemQuantityAtStart: 10, countedQuantity: 7, measuredAt: "2026-08-16T12:00:00.000Z" }),
      sample({ systemQuantityAtStart: 10, countedQuantity: 8, measuredAt: "2026-08-14T12:00:00.000Z" })
    ],
    now
  ).get(ITEM);
  assert.ok(bias);
  assert.equal(bias.isChronic, true);
  assert.equal(bias.sampleCount, 4);
  assert.equal(bias.shortCount, 4);
  assert.ok(bias.medianCountRatio <= 0.8);
  assert.ok(bias.multiplier > 1);
  assert.ok(bias.multiplier <= PURCHASE_LOOP_COUNT_MULTIPLIER_MAX);

  const insight = buildChronicCountShortInsightInput(bias);
  assert.ok(insight);
  assert.equal(insight.severity, "warning");
  assert.equal(insight.countPercent, Math.round(bias.medianCountRatio * 100));
});

test("applyPurchaseLoopCountBias pads then re-applies absolute learning bounds", () => {
  const bias = {
    inventoryItemId: ITEM,
    sampleCount: 4,
    shortCount: 4,
    medianCountRatio: 0.8,
    multiplier: 1.25,
    isChronic: true
  };
  const padded = applyPurchaseLoopCountBias(10, bias, { calculated: 10, par: 20 });
  assert.equal(padded, 13);

  const capped = applyPurchaseLoopCountBias(10, { ...bias, multiplier: 1.25 }, { calculated: 10, par: 10 });
  assert.ok(capped != null);
  assert.ok(capped <= Math.ceil(Math.max(10 * 1.75, 10 * 1.25)));

  assert.equal(
    applyPurchaseLoopCountBias(10, { ...bias, isChronic: false }, { calculated: 10, par: 20 }),
    undefined
  );
  assert.equal(applyPurchaseLoopCountBias(10, undefined, { calculated: 10, par: 20 }), undefined);
});
