import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_FEED_FILTERS,
  activityDateRangeBounds,
  activityIdempotencyKey,
  assertTenantScoped,
  dedupeActivityEvents,
  filterActivities,
  fromForecastUpdated,
  fromInventoryCountRecorded,
  fromInventoryReceipt,
  fromInventoryWasteRecorded,
  fromLearningMemoryUpdated,
  fromOperationalFinding,
  fromPosSyncCompleted,
  fromPurchaseRecommendationApproved,
  fromPurchaseRecommendationCreated,
  fromPurchaseRecommendationDismissed,
  fromSupplierOrderDrafted,
  fromSupplierOrderSent,
  groupRelatedActivities,
  summarizeActivityWindow,
  type ActivityEvent
} from "../services/domain/activityEvents";
import type { OperationalFinding } from "../services/domain/operationalFindings";
import type {
  InventoryItem,
  LearningMemorySummary,
  PurchaseRecommendation,
  SupplierOrder
} from "../types/mise";

const restaurantId = "rest_activity";
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
    created_at: "2026-08-02T12:14:00.000Z",
    ...overrides
  };
}

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order_1",
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: "Metro Produce",
    message_locale: "en" as const,
    order_message: "Please deliver chicken thighs.",
    operator_note: null,
    status: "draft",
    delivery_date: "2026-08-03",
    created_at: "2026-08-02T12:20:00.000Z",
    ...overrides
  };
}

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
    last_updated: "2026-08-02T11:00:00.000Z",
    ...overrides
  };
}

test("pending recommendation becomes an approval-required activity with evidence", () => {
  const event = fromPurchaseRecommendationCreated(recommendation());
  assert.equal(event.restaurantId, restaurantId);
  assert.equal(event.activityType, "approval_required");
  assert.equal(event.status, "waiting_for_approval");
  assert.equal(event.requiresAttention, true);
  assert.equal(event.autonomyLevel, 3);
  assert.match(event.summary, /18 lb/);
  assert.equal(event.evidenceReferences.length, 1);
  assert.equal(event.metadata.idempotencyKey, "recommendation_created:rec_1");
});

test("approve, dismiss, draft, and send builders use explicit statuses", () => {
  assert.equal(fromPurchaseRecommendationApproved(recommendation({ status: "approved" })).status, "confirmed");
  assert.equal(fromPurchaseRecommendationDismissed(recommendation({ status: "dismissed" })).status, "cancelled");
  assert.equal(fromSupplierOrderDrafted(order(), { itemCount: 5 }).activityType, "order_prepared");
  assert.equal(fromSupplierOrderSent(order({ status: "sent" })).status, "sent");
});

test("inventory count and receipt events stay tenant-scoped and completed", () => {
  const count = fromInventoryCountRecorded(item(), {
    occurredAt: "2026-08-02T13:00:00.000Z",
    eventId: "evt_count_1",
    previousQuantity: 12
  });
  const receipt = fromInventoryReceipt(item(), {
    occurredAt: "2026-08-02T14:00:00.000Z",
    quantityReceived: 18,
    eventId: "evt_receipt_1"
  });
  assert.equal(count.activityType, "inventory_count_recorded");
  assert.equal(receipt.activityType, "delivery_logged");
  assert.equal(count.status, "completed");
  assert.equal(receipt.status, "completed");
  assertTenantScoped([count, receipt], restaurantId);
  assert.throws(() => assertTenantScoped([count], "other_restaurant"));
});

test("recorded waste becomes a truthful waste analysis activity", () => {
  const event = fromInventoryWasteRecorded(item(), {
    occurredAt: "2026-08-02T15:00:00.000Z",
    quantity: 900,
    canonicalUnit: "g",
    repeatedRecently: true,
    eventId: "evt_waste_1"
  });
  assert.equal(event.activityType, "waste_analysis_completed");
  assert.equal(event.category, "waste");
  assert.equal(event.requiresAttention, true);
  assert.match(event.summary, /900 g/);
  assert.equal(event.evidenceReferences[0]?.id, "evt_waste_1");
});

test("finding and POS sync builders preserve structured evidence", () => {
  const finding: OperationalFinding = {
    id: "finding_1",
    restaurantId,
    category: "inventory",
    severity: "urgent",
    priority: "now",
    title: "Chicken may run out",
    explanation: "Usage is above forecast.",
    confidence: { score: 0.91, rationale: "Fresh count and mapped demand agree." },
    evidence: [
      {
        type: "inventory_item",
        id: "inv_chicken",
        observedAt: "2026-08-02T12:00:00.000Z",
        summary: "15.7 lb on hand"
      }
    ],
    affectedWorkflow: "purchasing",
    recommendedAction: "Approve chicken reorder",
    sourceWindow: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-02T12:00:00.000Z" },
    generatedAt: "2026-08-02T12:05:00.000Z",
    freshness: {
      state: "fresh",
      asOf: "2026-08-02T12:00:00.000Z",
      staleAfter: "2026-08-04T12:00:00.000Z",
      missingData: []
    },
    managerFeedback: {
      state: "unreviewed",
      decisionId: null,
      recordedAt: null,
      effectiveRecommendedAction: "Approve chicken reorder"
    },
    policyVersion: "beta-findings-v1"
  };

  const findingEvent = fromOperationalFinding(finding);
  assert.equal(findingEvent.activityType, "inventory_risk_detected");
  assert.equal(findingEvent.requiresAttention, true);
  assert.equal(findingEvent.confidence, 0.91);

  const sync = fromPosSyncCompleted({
    restaurantId,
    occurredAt: "2026-08-02T14:08:00.000Z",
    importId: "import_1",
    recordsProcessed: 620,
    provider: "Square"
  });
  assert.equal(sync.activityType, "pos_sync_completed");
  assert.match(sync.summary, /620/);
});

test("dedupe and group related shortage activities into one story", () => {
  const sequenceId = "seq_shortage_chicken";
  const events: ActivityEvent[] = [
    fromPurchaseRecommendationCreated(recommendation(), { sequenceId }),
    fromPurchaseRecommendationCreated(recommendation(), { sequenceId }),
    fromSupplierOrderDrafted(order(), { itemCount: 1, sequenceId }),
    fromForecastUpdated({
      restaurantId,
      occurredAt: "2026-08-02T12:12:00.000Z",
      operatingDate: "2026-08-02",
      sales: [],
      deltaPercent: 14
    })
  ];

  const deduped = dedupeActivityEvents(events);
  assert.equal(deduped.filter((event) => event.activityType === "approval_required").length, 1);

  const stories = groupRelatedActivities(
    deduped.map((event) =>
      event.activityType === "forecast_updated" ? event : { ...event, sequenceId }
    )
  );
  const shortage = stories.find((story) => story.sequenceId === sequenceId);
  assert.ok(shortage);
  assert.ok(shortage!.events.length >= 2);
  assert.equal(shortage!.requiresAttention, true);
});

test("filters and window summary use operator language counts", () => {
  const events = [
    fromPurchaseRecommendationCreated(recommendation()),
    fromPosSyncCompleted({
      restaurantId,
      occurredAt: "2026-08-02T08:00:00.000Z",
      importId: "import_2",
      recordsProcessed: 10,
      provider: "Square"
    }),
    fromLearningMemoryUpdated(
      restaurantId,
      {
        score: 72,
        label: "Learning",
        operatorCopy: "Friday dinner demand is typically higher.",
        nextStep: "Keep reviewing approvals.",
        signals: []
      } satisfies LearningMemorySummary,
      { occurredAt: "2026-08-02T09:00:00.000Z" }
    )
  ];

  assert.equal(filterActivities(events, "needs_attention").length, 1);
  assert.equal(filterActivities(events, "approvals").length, 1);
  assert.equal(filterActivities(events, "errors").length, 0);

  const summary = summarizeActivityWindow(events, "2026-08-02T07:00:00.000Z");
  assert.equal(summary.ordersPrepared, 1);
  assert.equal(summary.routineChecks, 1);
  assert.match(summary.sentence, /prepared 1 supplier order/);
  assert.match(activityIdempotencyKey(events[0]!), /recommendation_created/);
});

test("activity history exposes all feed filters and local date ranges", () => {
  assert.deepEqual(
    [...ACTIVITY_FEED_FILTERS],
    [
      "all",
      "completed_by_mise",
      "needs_attention",
      "approvals",
      "inventory",
      "orders",
      "team",
      "sales",
      "waste",
      "errors"
    ]
  );
  assert.deepEqual(activityDateRangeBounds("all"), {});
  const today = activityDateRangeBounds("today", new Date("2026-08-02T15:30:00.000Z"));
  assert.ok(today.since);
  assert.ok(today.until);
  assert.ok(today.since! <= today.until!);
  const week = activityDateRangeBounds("this_week", new Date("2026-08-02T15:30:00.000Z"));
  assert.ok(week.since);
  assert.ok(week.until);
});
