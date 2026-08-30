import assert from "node:assert/strict";
import test from "node:test";

import {
  fromInventoryCountRecorded,
  fromInventoryRiskSignal,
  fromInventoryWasteRecorded,
  fromPurchaseRecommendationCreated,
  type ActivityEvent
} from "../services/domain/activityEvents";
import { presentActivityEvidenceSummary } from "../services/presentation/activityEvidenceCopy";
import type { InventoryItem, PurchaseRecommendation } from "../types/mise";

const restaurantId = "rest_evidence_copy";
const supplierId = "10000000-0000-4000-8000-000000000088";

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inv_chicken",
    restaurant_id: restaurantId,
    item_name: "Chicken thighs",
    category: "Protein",
    unit: "lb",
    current_quantity: 15.7,
    par_level: 40,
    reorder_threshold: 18,
    estimated_unit_cost: 3.5,
    supplier_id: supplierId,
    supplier_name: "Metro Produce",
    last_updated: "2026-08-30T11:00:00.000Z",
    ...overrides
  };
}

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec_evidence_1",
    restaurant_id: restaurantId,
    inventory_item_id: "inv_chicken",
    item_name: "Chicken thighs",
    supplier_id: supplierId,
    supplier_name: "Metro Produce",
    recommended_quantity: 18,
    unit: "lb",
    reason: "Lunch usage was above forecast.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-08-30T12:14:00.000Z",
    ...overrides
  };
}

function firstEvidence(event: ActivityEvent) {
  const evidence = event.evidenceReferences[0];
  assert.ok(evidence, "expected evidence reference");
  return evidence;
}

test("inventory count evidence summary localizes from parent metadata", () => {
  const counted = fromInventoryCountRecorded(item(), {
    occurredAt: "2026-08-30T13:00:00.000Z"
  });
  const evidence = firstEvidence(counted);

  assert.match(evidence.summary, /Current quantity/);
  assert.equal(
    presentActivityEvidenceSummary("es", evidence, counted),
    "Cantidad actual 15,7 lb"
  );
  assert.equal(
    presentActivityEvidenceSummary("zh-Hans", evidence, counted),
    "当前数量 15.7 lb"
  );
  assert.equal(
    presentActivityEvidenceSummary("en", evidence, counted),
    "Current quantity 15.7 lb"
  );
});

test("waste evidence summary localizes without inventing item names", () => {
  const waste = fromInventoryWasteRecorded(item(), {
    occurredAt: "2026-08-30T14:00:00.000Z",
    quantity: 2.5,
    canonicalUnit: "lb",
    repeatedRecently: true
  });
  const evidence = firstEvidence(waste);

  assert.match(evidence.summary, /recorded as waste/);
  assert.equal(
    presentActivityEvidenceSummary("es", evidence, waste),
    "2,5 lb registrados como merma"
  );
  assert.doesNotMatch(presentActivityEvidenceSummary("es", evidence, waste), /Chicken/);
  assert.equal(
    presentActivityEvidenceSummary("zh-Hans", evidence, waste),
    "2.5 lb 已记为损耗"
  );
});

test("inventory risk evidence summary keeps business item names", () => {
  const risk = fromInventoryRiskSignal({
    restaurantId,
    item: item(),
    occurredAt: "2026-08-30T15:00:00.000Z",
    projectedQuantity: 4,
    reason: "May run out before dinner."
  });
  const evidence = firstEvidence(risk);

  const localized = presentActivityEvidenceSummary("es", evidence, risk);
  assert.match(localized, /Chicken thighs/);
  assert.match(localized, /4/);
  assert.match(localized, /proyectado/i);
  assert.doesNotMatch(localized, /projected at/);
});

test("free-form recommendation reason evidence stays durable English", () => {
  const approval = fromPurchaseRecommendationCreated(recommendation());
  const evidence = firstEvidence(approval);

  assert.equal(evidence.summary, "Lunch usage was above forecast.");
  assert.equal(
    presentActivityEvidenceSummary("es", evidence, approval),
    "Lunch usage was above forecast."
  );
  assert.equal(
    presentActivityEvidenceSummary("zh-Hans", evidence, approval),
    evidence.summary
  );
});

test("missing parent falls back to stored evidence summary", () => {
  const counted = fromInventoryCountRecorded(item(), {
    occurredAt: "2026-08-30T13:00:00.000Z"
  });
  const evidence = firstEvidence(counted);
  assert.equal(presentActivityEvidenceSummary("es", evidence, null), evidence.summary);
  assert.equal(presentActivityEvidenceSummary("es", evidence), evidence.summary);
});
