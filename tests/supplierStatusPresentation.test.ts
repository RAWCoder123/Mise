import assert from "node:assert/strict";
import test from "node:test";

import type { SupplierReliabilityEntry } from "../services/domain/supplierReliability";
import {
  partitionSupplierStatusSections,
  primarySupplierFollowUpOrderId,
  supplierStatusTone
} from "../services/presentation/supplierStatusPresentation";

function entry(
  overrides: Partial<SupplierReliabilityEntry> &
    Pick<SupplierReliabilityEntry, "supplierId" | "supplierName" | "status">
): SupplierReliabilityEntry {
  return {
    deliveryCount: 2,
    onTimeCount: 2,
    measurableDeliveryCount: 2,
    issueDeliveryCount: 0,
    unverifiedDeliveryCount: 0,
    discrepancyLineCount: 0,
    onTimeRate: 1,
    matchedDeliveryRate: 1,
    fulfillmentRate: 1,
    reasons: ["matched_history"],
    lastDeliveryAt: "2026-08-30T12:00:00.000Z",
    relatedOrderIds: [],
    ...overrides
  };
}

test("supplier status partitions attention suppliers ahead of stable ones", () => {
  const sections = partitionSupplierStatusSections({
    totalDeliveries: 6,
    supplierCount: 4,
    attentionSupplierCount: 2,
    overallOnTimeRate: 0.8,
    overallMatchedDeliveryRate: 0.7,
    suppliers: [
      entry({
        supplierId: "risk",
        supplierName: "At Risk Co",
        status: "at_risk",
        reasons: ["late_deliveries", "delivery_discrepancies"],
        relatedOrderIds: ["order-risk"],
        lastDeliveryAt: "2026-08-29T12:00:00.000Z"
      }),
      entry({
        supplierId: "watch",
        supplierName: "Watch Co",
        status: "watch",
        reasons: ["unverified_deliveries"],
        relatedOrderIds: ["order-watch"],
        lastDeliveryAt: "2026-08-30T12:00:00.000Z"
      }),
      entry({
        supplierId: "learning",
        supplierName: "Learning Co",
        status: "insufficient",
        reasons: ["limited_history"]
      }),
      entry({
        supplierId: "good",
        supplierName: "Reliable Co",
        status: "reliable",
        reasons: ["matched_history"]
      })
    ]
  });

  assert.deepEqual(
    sections.map((section) => section.id),
    ["needs_follow_up", "stable"]
  );
  assert.deepEqual(
    sections[0]!.suppliers.map((supplier) => supplier.supplierId),
    ["risk", "watch"]
  );
  assert.deepEqual(
    sections[1]!.suppliers.map((supplier) => supplier.supplierId),
    ["learning", "good"]
  );
  assert.deepEqual(sections[0]!.suppliers[0]!.reasons, [
    "late_deliveries",
    "delivery_discrepancies"
  ]);
});

test("supplier status omits empty sections and preserves empty summaries", () => {
  assert.deepEqual(
    partitionSupplierStatusSections({
      totalDeliveries: 0,
      supplierCount: 0,
      attentionSupplierCount: 0,
      overallOnTimeRate: null,
      overallMatchedDeliveryRate: null,
      suppliers: []
    }),
    []
  );

  const onlyStable = partitionSupplierStatusSections({
    totalDeliveries: 2,
    supplierCount: 1,
    attentionSupplierCount: 0,
    overallOnTimeRate: 1,
    overallMatchedDeliveryRate: 1,
    suppliers: [
      entry({
        supplierId: "good",
        supplierName: "Reliable Co",
        status: "reliable"
      })
    ]
  });
  assert.deepEqual(
    onlyStable.map((section) => section.id),
    ["stable"]
  );
});

test("supplier follow-up order CTA is reserved for attention suppliers with evidence", () => {
  assert.equal(
    primarySupplierFollowUpOrderId(
      entry({
        supplierId: "risk",
        supplierName: "At Risk Co",
        status: "at_risk",
        relatedOrderIds: ["order-1", "order-2"]
      })
    ),
    "order-1"
  );
  assert.equal(
    primarySupplierFollowUpOrderId(
      entry({
        supplierId: "watch",
        supplierName: "Watch Co",
        status: "watch",
        relatedOrderIds: ["  "]
      })
    ),
    null
  );
  assert.equal(
    primarySupplierFollowUpOrderId(
      entry({
        supplierId: "good",
        supplierName: "Reliable Co",
        status: "reliable",
        relatedOrderIds: ["order-good"]
      })
    ),
    null
  );
});

test("supplier status tones map to operator badge severity", () => {
  assert.equal(supplierStatusTone("at_risk"), "danger");
  assert.equal(supplierStatusTone("watch"), "warning");
  assert.equal(supplierStatusTone("reliable"), "success");
  assert.equal(supplierStatusTone("insufficient"), "neutral");
});
