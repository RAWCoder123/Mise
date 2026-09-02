import assert from "node:assert/strict";
import test from "node:test";

import {
  assertOperationalIssuesTenantScoped,
  filterOperationalIssues,
  inventoryRiskDedupeKey,
  operationalIssueFromPersistedRow,
  operationalIssueFromPurchaseRecommendation,
  sortOperationalIssues,
  statusFromRecommendationStatus,
  type OperationalIssue
} from "../services/domain/operationalIssues";
import type { PurchaseRecommendation } from "../types/mise";

const restaurantId = "rest_issues";
const supplierId = "10000000-0000-4000-8000-000000000001";

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec_1",
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
    created_at: "2026-09-02T12:00:00.000Z",
    ...overrides
  };
}

test("inventory-risk issues mirror recommendation urgency and status", () => {
  const pending = operationalIssueFromPurchaseRecommendation(recommendation());
  assert.equal(pending.category, "inventory");
  assert.equal(pending.severity, "critical");
  assert.equal(pending.status, "open");
  assert.equal(pending.dedupeKey, inventoryRiskDedupeKey("inv_chicken"));
  assert.equal(pending.relatedEntityType, "inventory_item");
  assert.equal(pending.relatedEntityId, "inv_chicken");
  assert.equal(pending.evidence[0]?.type, "purchase_recommendation");

  const approved = operationalIssueFromPurchaseRecommendation(
    recommendation({ status: "approved", urgency: "medium" }),
    pending
  );
  assert.equal(approved.id, pending.id);
  assert.equal(approved.severity, "warning");
  assert.equal(approved.status, "action_prepared");
  assert.equal(approved.firstDetectedAt, pending.firstDetectedAt);

  assert.equal(statusFromRecommendationStatus("ordered"), "resolved");
  assert.equal(statusFromRecommendationStatus("dismissed"), "dismissed");
});

test("filter and sort prefer open critical issues", () => {
  const issues: OperationalIssue[] = [
    operationalIssueFromPurchaseRecommendation(
      recommendation({
        id: "rec_low",
        inventory_item_id: "inv_rice",
        item_name: "Rice",
        urgency: "low",
        status: "pending",
        created_at: "2026-09-02T11:00:00.000Z"
      })
    ),
    operationalIssueFromPurchaseRecommendation(
      recommendation({
        id: "rec_done",
        inventory_item_id: "inv_lettuce",
        item_name: "Lettuce",
        urgency: "high",
        status: "ordered",
        created_at: "2026-09-02T13:00:00.000Z"
      })
    ),
    operationalIssueFromPurchaseRecommendation(recommendation())
  ];

  const open = filterOperationalIssues(issues, "open");
  assert.equal(open.length, 2);
  assert.deepEqual(
    sortOperationalIssues(open).map((issue) => issue.relatedEntityId),
    ["inv_chicken", "inv_rice"]
  );

  const resolved = filterOperationalIssues(issues, "resolved");
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.status, "resolved");
});

test("persisted rows fail closed on tenant and window validation", () => {
  const issue = operationalIssueFromPersistedRow({
    id: "00000000-0000-4000-8000-000000000f01",
    restaurant_id: restaurantId,
    category: "inventory",
    severity: "warning",
    title: "Rice inventory risk",
    explanation: "Coverage is thin before weekend service.",
    evidence: [{ type: "purchase_recommendation", id: "rec_2" }],
    first_detected_at: "2026-09-01T10:00:00.000Z",
    last_detected_at: "2026-09-02T10:00:00.000Z",
    status: "open",
    related_entity_type: "inventory_item",
    related_entity_id: "inv_rice",
    dedupe_key: "inventory-risk:inv_rice",
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-02T10:00:00.000Z"
  });
  assert.equal(issue.restaurantId, restaurantId);
  assertOperationalIssuesTenantScoped([issue], restaurantId);
  assert.throws(() => assertOperationalIssuesTenantScoped([issue], "other_rest"));
  assert.throws(() =>
    operationalIssueFromPersistedRow({
      ...issue,
      restaurant_id: restaurantId,
      first_detected_at: "2026-09-03T10:00:00.000Z",
      last_detected_at: "2026-09-02T10:00:00.000Z",
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
      dedupe_key: issue.dedupeKey
    })
  );
});
