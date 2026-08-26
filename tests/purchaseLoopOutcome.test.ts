import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION,
  buildPurchaseLoopReceiveOutcomeMeasurement,
  lessonTextForPurchaseLoopCode,
  selectPurchaseLoopLessonCode
} from "../services/domain/purchaseLoopOutcome";

test("purchase-loop receive outcome links predicted, ordered, and received quantities", () => {
  const measurement = buildPurchaseLoopReceiveOutcomeMeasurement({
    supplierOrderId: "order_1",
    deliveryId: "delivery_1",
    deliveryStatus: "received",
    recommendations: [
      {
        id: "rec_1",
        inventoryItemId: "item_a",
        recommendedQuantity: 10,
        unit: "each",
        status: "ordered"
      },
      {
        id: "rec_2",
        inventoryItemId: "item_b",
        recommendedQuantity: 4,
        unit: "each",
        status: "ordered"
      }
    ],
    lines: [
      {
        inventoryItemId: "item_a",
        orderedQuantity: 10,
        receivedQuantity: 10,
        damagedQuantity: 0,
        missingQuantity: 0,
        canonicalUnit: "each"
      },
      {
        inventoryItemId: "item_b",
        orderedQuantity: 4,
        receivedQuantity: 4,
        damagedQuantity: 0,
        missingQuantity: 0,
        canonicalUnit: "each"
      }
    ]
  });

  assert.equal(measurement.evidenceVersion, PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION);
  assert.equal(measurement.phase, "receive");
  assert.equal(measurement.lessonCode, "purchase_loop.receive.matched");
  assert.equal(measurement.expectedResult.predictedQuantity, 14);
  assert.equal(measurement.actualResult.predictedQuantity, 14);
  assert.equal(measurement.actualResult.orderedQuantity, 14);
  assert.equal(measurement.actualResult.receivedQuantity, 14);
  assert.equal(measurement.actualResult.usableReceivedQuantity, 14);
  assert.equal(measurement.actualResult.countVariancePending, true);
  assert.equal(measurement.variance.orderedVersusPredictedDelta, 0);
  assert.equal(measurement.variance.receivedVersusOrderedDelta, 0);
  assert.equal(measurement.variance.usableVersusPredictedDelta, 0);
  assert.equal(measurement.variance.countVariancePending, true);
  assert.match(measurement.lesson, /matched/i);
});

test("purchase-loop receive outcome records short ships and prediction gaps", () => {
  const shortShip = buildPurchaseLoopReceiveOutcomeMeasurement({
    supplierOrderId: "order_2",
    deliveryId: "delivery_2",
    deliveryStatus: "received",
    recommendations: [
      {
        id: "rec_3",
        inventoryItemId: "item_c",
        recommendedQuantity: 20,
        unit: "lb",
        status: "ordered"
      }
    ],
    lines: [
      {
        inventoryItemId: "item_c",
        orderedQuantity: 20,
        receivedQuantity: 15,
        damagedQuantity: 0,
        missingQuantity: 5,
        canonicalUnit: "each"
      }
    ]
  });

  assert.equal(shortShip.lessonCode, "purchase_loop.receive.quantity_short");
  assert.equal(shortShip.variance.receivedVersusOrderedDelta, -5);
  assert.equal(shortShip.actualResult.missingQuantity, 5);

  const predictionGap = buildPurchaseLoopReceiveOutcomeMeasurement({
    supplierOrderId: "order_3",
    deliveryId: "delivery_3",
    deliveryStatus: "received",
    recommendations: [
      {
        id: "rec_4",
        inventoryItemId: "item_d",
        recommendedQuantity: 8,
        unit: "each",
        status: "ordered"
      }
    ],
    lines: [
      {
        inventoryItemId: "item_d",
        orderedQuantity: 12,
        receivedQuantity: 12,
        damagedQuantity: 0,
        missingQuantity: 0,
        canonicalUnit: "each"
      }
    ]
  });

  assert.equal(predictionGap.lessonCode, "purchase_loop.receive.prediction_gap");
  assert.equal(predictionGap.variance.orderedVersusPredictedDelta, 4);
});

test("purchase-loop receive outcome marks discrepancy and damaged stock", () => {
  const measurement = buildPurchaseLoopReceiveOutcomeMeasurement({
    supplierOrderId: "order_4",
    deliveryId: "delivery_4",
    deliveryStatus: "discrepancy",
    hasDiscrepancy: true,
    recommendations: [
      {
        id: "rec_5",
        inventoryItemId: "item_e",
        recommendedQuantity: 6,
        unit: "each",
        status: "approved"
      }
    ],
    lines: [
      {
        inventoryItemId: "item_e",
        orderedQuantity: 6,
        receivedQuantity: 6,
        damagedQuantity: 2,
        missingQuantity: 0,
        canonicalUnit: "each"
      }
    ]
  });

  assert.equal(measurement.lessonCode, "purchase_loop.receive.discrepancy");
  assert.equal(measurement.actualResult.usableReceivedQuantity, 4);
  assert.equal(measurement.variance.usableVersusPredictedDelta, -2);
  assert.equal(measurement.variance.hasDiscrepancy, true);
});

test("purchase-loop lesson codes stay opaque and exhaustive", () => {
  assert.equal(
    selectPurchaseLoopLessonCode({
      deliveryStatus: "partially_received",
      predictedQuantity: 10,
      orderedQuantity: 10,
      usableReceivedQuantity: 4,
      hasDiscrepancy: false,
      hasPartialReceipt: true
    }),
    "purchase_loop.receive.partial"
  );
  assert.match(lessonTextForPurchaseLoopCode("purchase_loop.receive.partial"), /partially received/i);
});

test("purchase-loop receive outcome rejects impossible damaged quantities", () => {
  assert.throws(
    () =>
      buildPurchaseLoopReceiveOutcomeMeasurement({
        supplierOrderId: "order_5",
        deliveryId: "delivery_5",
        deliveryStatus: "received",
        recommendations: [],
        lines: [
          {
            inventoryItemId: "item_f",
            orderedQuantity: 3,
            receivedQuantity: 2,
            damagedQuantity: 5,
            missingQuantity: 0,
            canonicalUnit: "each"
          }
        ]
      }),
    /Damaged quantity cannot exceed/
  );
});
