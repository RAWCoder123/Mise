import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReceiveFillBias,
  buildChronicShortShipInsightInput,
  buildReceiveFillBiasByItem,
  extractReceiveSamplesFromDeliveries,
  RECEIVE_FILL_MULTIPLIER_MAX,
  type ReceiveDiscrepancySample
} from "../services/domain/receiveDiscrepancyLearning";

const ITEM = "item-avocados";

function sample(
  overrides: Partial<ReceiveDiscrepancySample> & {
    quantityOrdered: number;
    quantityReceived: number;
    createdAt: string;
  }
): ReceiveDiscrepancySample {
  return {
    inventoryItemId: ITEM,
    discrepancy: overrides.quantityReceived - overrides.quantityOrdered,
    supplierOrderId: "order-1",
    ...overrides
  };
}

test("extractReceiveSamplesFromDeliveries requires positive ordered quantity", () => {
  const samples = extractReceiveSamplesFromDeliveries(
    [{ id: "d1", received_at: "2026-08-20T12:00:00.000Z", supplier_order_id: "o1" }],
    [
      {
        delivery_id: "d1",
        inventory_item_id: ITEM,
        ordered_quantity: null,
        received_quantity: 8
      },
      {
        delivery_id: "d1",
        inventory_item_id: ITEM,
        ordered_quantity: 10,
        received_quantity: 8
      }
    ]
  );
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.quantityOrdered, 10);
  assert.equal(samples[0]?.quantityReceived, 8);
  assert.equal(samples[0]?.discrepancy, -2);
  assert.equal(samples[0]?.supplierOrderId, "o1");
});

test("buildReceiveFillBiasByItem ignores sparse or healthy fill history", () => {
  const now = Date.parse("2026-08-27T12:00:00.000Z");
  const sparse = buildReceiveFillBiasByItem(
    [
      sample({ quantityOrdered: 10, quantityReceived: 7, createdAt: "2026-08-20T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-18T12:00:00.000Z" })
    ],
    now
  );
  assert.equal(sparse.has(ITEM), false);

  const healthy = buildReceiveFillBiasByItem(
    [
      sample({ quantityOrdered: 10, quantityReceived: 10, createdAt: "2026-08-20T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 10, createdAt: "2026-08-18T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 9, createdAt: "2026-08-16T12:00:00.000Z" })
    ],
    now
  );
  const healthyBias = healthy.get(ITEM);
  assert.ok(healthyBias);
  assert.equal(healthyBias.isChronic, false);
  assert.equal(healthyBias.multiplier, 1);
});

test("buildReceiveFillBiasByItem marks chronic short-ships and caps the multiplier", () => {
  const now = Date.parse("2026-08-27T12:00:00.000Z");
  const bias = buildReceiveFillBiasByItem(
    [
      sample({ quantityOrdered: 10, quantityReceived: 7, createdAt: "2026-08-20T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-18T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 7, createdAt: "2026-08-16T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-14T12:00:00.000Z" })
    ],
    now
  ).get(ITEM);
  assert.ok(bias);
  assert.equal(bias.isChronic, true);
  assert.equal(bias.sampleCount, 4);
  assert.equal(bias.shortShipCount, 4);
  assert.ok(bias.medianFillRatio <= 0.8);
  assert.ok(bias.multiplier > 1);
  assert.ok(bias.multiplier <= RECEIVE_FILL_MULTIPLIER_MAX);

  const insight = buildChronicShortShipInsightInput(bias);
  assert.ok(insight);
  assert.equal(insight.severity, "warning");
  assert.equal(insight.fillPercent, Math.round(bias.medianFillRatio * 100));
});

test("applyReceiveFillBias pads then re-applies absolute learning bounds", () => {
  const bias = {
    inventoryItemId: ITEM,
    sampleCount: 4,
    shortShipCount: 4,
    medianFillRatio: 0.8,
    multiplier: 1.25,
    isChronic: true
  };
  const padded = applyReceiveFillBias(10, bias, { calculated: 10, par: 20 });
  assert.equal(padded, 13);

  const capped = applyReceiveFillBias(10, { ...bias, multiplier: 1.25 }, { calculated: 10, par: 10 });
  assert.ok(capped != null);
  assert.ok(capped <= Math.ceil(Math.max(10 * 1.75, 10 * 1.25)));

  assert.equal(applyReceiveFillBias(10, { ...bias, isChronic: false }, { calculated: 10, par: 20 }), undefined);
  assert.equal(applyReceiveFillBias(10, undefined, { calculated: 10, par: 20 }), undefined);
});

test("buildReceiveFillBiasByItem winsorizes extreme underfills and keeps newest samples", () => {
  const now = Date.parse("2026-08-27T12:00:00.000Z");
  const bias = buildReceiveFillBiasByItem(
    [
      sample({ quantityOrdered: 100, quantityReceived: 1, createdAt: "2026-08-20T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-19T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-18T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-17T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-16T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-15T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-14T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 8, createdAt: "2026-08-13T12:00:00.000Z" }),
      sample({ quantityOrdered: 10, quantityReceived: 2, createdAt: "2026-01-01T12:00:00.000Z" })
    ],
    now
  ).get(ITEM);
  assert.ok(bias);
  assert.equal(bias.sampleCount, 8);
  assert.ok(bias.medianFillRatio >= 0.25);
  assert.ok(bias.multiplier <= RECEIVE_FILL_MULTIPLIER_MAX);
});
