import assert from "node:assert/strict";
import test from "node:test";

import {
  OPERATING_PLAN_TASK_SEARCH_THRESHOLD,
  filterOperatingPlanTasksBySearch
} from "../services/domain/operatingPlanTaskSearch";

const items = [
  {
    id: "plan-count-tomato",
    title: "Count Roma tomatoes before lunch",
    detail: "Walk-in shelf B needs a verified count",
    why: "Par gap after brunch service",
    effect: "Unlocks tomato reorder recommendation",
    kind: "mise_task",
    priority: "urgent",
    serviceWindow: "before_lunch",
    status: "open",
    completionResult: null,
    relatedRefs: [{ type: "inventory_item", id: "inv_tomato" }],
    reprioritization: { code: "stock_risk", reason: "Tomato stockout risk before lunch" }
  },
  {
    id: "plan-approve-cream",
    title: "Approve heavy cream reorder",
    detail: "Sysco draft waiting for manager approval",
    why: "Suggested order below par with Friday delivery",
    effect: "Creates supplier draft for cream",
    kind: "approval",
    priority: "high",
    serviceWindow: "before_supplier_cutoff",
    status: "open",
    completionResult: null,
    relatedRefs: [{ type: "purchase_recommendation", id: "rec_cream" }],
    reprioritization: null
  },
  {
    id: "plan-receive-sysco",
    title: "Receive Sysco produce delivery",
    detail: "Confirm chicken thighs and herbs against invoice",
    why: "Sent order expected today",
    effect: "Updates on-hand produce inventory",
    kind: "human_task",
    priority: "high",
    serviceWindow: "before_dinner",
    status: "open",
    completionResult: null,
    relatedRefs: [{ type: "supplier_order", id: "order_sysco_1" }],
    reprioritization: { code: "delivery_due_today", reason: "Delivery due today" }
  },
  {
    id: "plan-pos-reconnect",
    title: "Reconnect Square POS sync",
    detail: "Last successful sync failed overnight",
    why: "Provider failure blocked sales import",
    effect: "Restores inventory consumption from sales",
    kind: "mise_task",
    priority: "urgent",
    serviceWindow: "before_prep",
    status: "open",
    completionResult: null,
    relatedRefs: [{ type: "pos_integration", id: "pos_square" }],
    reprioritization: { code: "provider_failure", reason: "Square webhook failures" }
  },
  {
    id: "plan-done-count",
    title: "Completed walk-in dairy count",
    detail: "Manager verified milk and cream variance",
    why: "Count session closed",
    effect: "Dairy projection refreshed",
    kind: "completed",
    priority: "medium",
    serviceWindow: "closing",
    status: "completed",
    completionResult: "Variance accepted for whole milk",
    relatedRefs: [{ type: "inventory_count_session", id: "count_dairy" }],
    reprioritization: null
  }
] as const;

test("OPERATING_PLAN_TASK_SEARCH_THRESHOLD stays at five tasks", () => {
  assert.equal(OPERATING_PLAN_TASK_SEARCH_THRESHOLD, 5);
});

test("filterOperatingPlanTasksBySearch returns the full list for an empty query", () => {
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, " ").map((item) => item.id),
    items.map((item) => item.id)
  );
  assert.equal(filterOperatingPlanTasksBySearch(items, "").length, 5);
});

test("filterOperatingPlanTasksBySearch ranks title matches", () => {
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, "roma tomatoes").map((item) => item.id),
    ["plan-count-tomato"]
  );
  assert.equal(filterOperatingPlanTasksBySearch(items, "heavy cream")[0]?.id, "plan-approve-cream");
  assert.deepEqual(filterOperatingPlanTasksBySearch(items, "missing-task"), []);
});

test("filterOperatingPlanTasksBySearch matches detail and why text", () => {
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, "shelf B").map((item) => item.id),
    ["plan-count-tomato"]
  );
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, "friday delivery").map((item) => item.id),
    ["plan-approve-cream"]
  );
});

test("filterOperatingPlanTasksBySearch matches related refs and completion results", () => {
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, "inv_tomato").map((item) => item.id),
    ["plan-count-tomato"]
  );
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, "order_sysco_1").map((item) => item.id),
    ["plan-receive-sysco"]
  );
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, "whole milk").map((item) => item.id),
    ["plan-done-count"]
  );
});

test("filterOperatingPlanTasksBySearch matches priority, kind, and window metadata", () => {
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, "approval").map((item) => item.id),
    ["plan-approve-cream"]
  );
  assert.deepEqual(
    filterOperatingPlanTasksBySearch(items, "before_lunch").map((item) => item.id),
    ["plan-count-tomato"]
  );
  assert.ok(
    filterOperatingPlanTasksBySearch(items, "urgent")
      .map((item) => item.id)
      .includes("plan-pos-reconnect")
  );
});

test("filterOperatingPlanTasksBySearch prefers title hits over detail hits", () => {
  const mixed = [
    {
      id: "plan-title-sysco",
      title: "Sysco delivery confirmation",
      detail: "Local farm invoice matched",
      why: "Order confirmed",
      relatedRefs: [{ type: "supplier_order", id: "order_1" }]
    },
    {
      id: "plan-detail-sysco",
      title: "Review produce invoice",
      detail: "Sysco line items need put-away stations",
      why: "Receiving incomplete",
      relatedRefs: [{ type: "supplier_order", id: "order_2" }]
    }
  ] as const;

  assert.deepEqual(
    filterOperatingPlanTasksBySearch(mixed, "sysco").map((item) => item.id),
    ["plan-title-sysco", "plan-detail-sysco"]
  );
});

test("filterOperatingPlanTasksBySearch preserves relative order on equal scores", () => {
  const tied = [
    { id: "a", title: "Count herbs", detail: "Parsley bunch" },
    { id: "b", title: "Count herbs", detail: "Basil bunch" },
    { id: "c", title: "Count herbs", detail: "Cilantro bunch" }
  ] as const;

  assert.deepEqual(
    filterOperatingPlanTasksBySearch(tied, "count herbs").map((item) => item.id),
    ["a", "b", "c"]
  );
});
