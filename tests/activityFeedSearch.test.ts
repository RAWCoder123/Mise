import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_FEED_SEARCH_THRESHOLD,
  filterActivityFeedBySearch
} from "../services/domain/activityFeedSearch";

const events = [
  {
    id: "act-order-sent",
    title: "Supplier order sent to Sysco",
    summary: "Chicken thighs draft emailed for Friday delivery",
    category: "orders",
    status: "sent",
    activityType: "order_sent",
    triggerType: "manager_approval",
    triggerReference: "rec_chicken",
    relatedEntityType: "supplier_order",
    relatedEntityId: "order_sysco_1",
    actionId: "action_send_1",
    evidenceReferences: [{ type: "supplier_order", summary: "Sysco Produce chicken thighs" }]
  },
  {
    id: "act-count",
    title: "Physical count recorded",
    summary: "Walk-in count closed for Roma tomatoes",
    category: "inventory",
    status: "completed",
    activityType: "inventory_count_recorded",
    triggerType: "count_session",
    triggerReference: "count_walkin",
    relatedEntityType: "inventory_item",
    relatedEntityId: "inv_tomato",
    actionId: null,
    evidenceReferences: [{ type: "inventory_count", summary: "Roma tomatoes variance reviewed" }]
  },
  {
    id: "act-approval",
    title: "Purchase approval required",
    summary: "Heavy cream recommendation waiting for manager",
    category: "approvals",
    status: "waiting_for_approval",
    activityType: "approval_required",
    triggerType: "recommendation",
    triggerReference: "rec_cream",
    relatedEntityType: "purchase_recommendation",
    relatedEntityId: "rec_cream",
    actionId: "action_approve_1",
    evidenceReferences: []
  },
  {
    id: "act-pos",
    title: "POS sync completed",
    summary: "Square sales import finished for brunch service",
    category: "integrations",
    status: "completed",
    activityType: "pos_sync_completed",
    triggerType: "pos_webhook",
    triggerReference: "square_sync_9",
    relatedEntityType: "pos_import",
    relatedEntityId: "import_brunch",
    actionId: null,
    evidenceReferences: [{ type: "pos_sale", summary: "Brunch cover count" }]
  },
  {
    id: "act-waste",
    title: "Waste analysis completed",
    summary: "Prep trim for salmon portions above baseline",
    category: "waste",
    status: "completed",
    activityType: "waste_analysis_completed",
    triggerType: "scheduled",
    triggerReference: null,
    relatedEntityType: "inventory_item",
    relatedEntityId: "inv_salmon",
    actionId: null,
    evidenceReferences: [{ type: "waste_record", summary: "Salmon portions trim" }]
  }
] as const;

test("ACTIVITY_FEED_SEARCH_THRESHOLD stays at five events", () => {
  assert.equal(ACTIVITY_FEED_SEARCH_THRESHOLD, 5);
});

test("filterActivityFeedBySearch returns the full list for an empty query", () => {
  assert.deepEqual(
    filterActivityFeedBySearch(events, " ").map((event) => event.id),
    events.map((event) => event.id)
  );
  assert.equal(filterActivityFeedBySearch(events, "").length, 5);
});

test("filterActivityFeedBySearch ranks title matches", () => {
  assert.deepEqual(
    filterActivityFeedBySearch(events, "physical count").map((event) => event.id),
    ["act-count"]
  );
  assert.equal(filterActivityFeedBySearch(events, "supplier order")[0]?.id, "act-order-sent");
  assert.deepEqual(filterActivityFeedBySearch(events, "missing-event"), []);
});

test("filterActivityFeedBySearch matches summary text", () => {
  assert.deepEqual(
    filterActivityFeedBySearch(events, "heavy cream").map((event) => event.id),
    ["act-approval"]
  );
  assert.deepEqual(
    filterActivityFeedBySearch(events, "brunch").map((event) => event.id),
    ["act-pos"]
  );
});

test("filterActivityFeedBySearch matches related entity and trigger reference", () => {
  assert.deepEqual(
    filterActivityFeedBySearch(events, "inv_tomato").map((event) => event.id),
    ["act-count"]
  );
  assert.deepEqual(
    filterActivityFeedBySearch(events, "rec_chicken").map((event) => event.id),
    ["act-order-sent"]
  );
  assert.deepEqual(
    filterActivityFeedBySearch(events, "supplier_order").map((event) => event.id),
    ["act-order-sent"]
  );
});

test("filterActivityFeedBySearch matches evidence summaries and category", () => {
  assert.deepEqual(
    filterActivityFeedBySearch(events, "salmon portions").map((event) => event.id),
    ["act-waste"]
  );
  assert.deepEqual(
    filterActivityFeedBySearch(events, "waste").map((event) => event.id),
    ["act-waste"]
  );
});

test("filterActivityFeedBySearch prefers title hits over summary hits", () => {
  const mixed = [
    {
      id: "act-title-sysco",
      title: "Sysco delivery confirmation",
      summary: "Local farm invoice matched",
      category: "orders",
      status: "confirmed",
      relatedEntityId: "order_1"
    },
    {
      id: "act-summary-sysco",
      title: "Invoice discrepancy detected",
      summary: "Sysco dry goods short-ship",
      category: "orders",
      status: "needs_attention",
      relatedEntityId: "order_2"
    }
  ] as const;

  assert.deepEqual(
    filterActivityFeedBySearch(mixed, "sysco").map((event) => event.id),
    ["act-title-sysco", "act-summary-sysco"]
  );
});
