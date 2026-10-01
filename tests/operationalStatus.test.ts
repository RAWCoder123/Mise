import assert from "node:assert/strict";
import test from "node:test";

import {
  autonomyLevelLabel,
  explicitActionStatusLabel,
  mapLegacyInventoryStatus,
  mapRecommendationToOrderStatus,
  mapSupplierOrderToOrderStatus,
  orderOperationalStatusLabel,
  presentSupportedRecommendationStatus,
  presentSupportedSupplierOrderStatus,
  resolveInventoryHealthLabel,
  resolveOrderOperationalStatus
} from "../services/domain/operationalStatus";

test("legacy inventory statuses map into operator health labels", () => {
  assert.equal(mapLegacyInventoryStatus("Good"), "Healthy");
  assert.equal(mapLegacyInventoryStatus("Low"), "AtRisk");
  assert.equal(mapLegacyInventoryStatus("Critical"), "Critical");
});

test("healthy is never returned when projected stockout is today", () => {
  assert.equal(
    resolveInventoryHealthLabel({
      legacyStatus: "Good",
      projectedQuantity: 0,
      daysCoverage: 0
    }),
    "Critical"
  );
  assert.equal(
    resolveInventoryHealthLabel({
      legacyStatus: "Good",
      projectedQuantity: 4,
      daysCoverage: 0.5
    }),
    "AtRisk"
  );
  assert.equal(
    resolveInventoryHealthLabel({
      legacyStatus: "Good",
      demandTrend: "learning",
      daysCoverage: null
    }),
    "Learning"
  );
});

test("order and action status helpers stay explicit", () => {
  assert.equal(mapRecommendationToOrderStatus("pending"), "WaitingForApproval");
  assert.equal(mapSupplierOrderToOrderStatus("draft"), "DraftedByMise");
  assert.equal(
    resolveOrderOperationalStatus({
      recommendationStatus: "approved",
      supplierOrderStatus: "sent"
    }),
    "Sent"
  );
  assert.equal(
    resolveOrderOperationalStatus({
      supplierOrderStatus: "sent",
      hasDiscrepancy: true
    }),
    "Discrepancy"
  );
  assert.equal(explicitActionStatusLabel("WaitingForApproval"), "Waiting for approval");
  assert.equal(explicitActionStatusLabel("CouldNotVerify"), "Could not verify");
  assert.equal(presentSupportedSupplierOrderStatus("completed"), "Received");
  assert.equal(presentSupportedRecommendationStatus("pending"), "WaitingForApproval");
  assert.equal(orderOperationalStatusLabel("DraftedByMise"), "Drafted by Mise");
});

test("autonomy level English fallbacks stay stable for domain callers", () => {
  assert.equal(autonomyLevelLabel(1), "Observe");
  assert.equal(autonomyLevelLabel(2), "Recommend");
  assert.equal(autonomyLevelLabel(3), "Prepare");
  assert.equal(autonomyLevelLabel(4), "Execute");
  assert.equal(autonomyLevelLabel(5), "Optimize");
});
