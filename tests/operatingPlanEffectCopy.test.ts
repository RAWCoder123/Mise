import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog";
import type { OperatingPlanItem } from "../services/domain/operatingPlan";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { RestaurantTask } from "../services/domain/restaurantTasks";
import { presentOperatingPlanEffect } from "../services/presentation/operatingPlanEffectCopy";
import { presentOperatingPlanItem } from "../services/presentation/operationsPresentation";

const locales = ["en", "es", "zh-Hans"] as const;

function baseTask(overrides: Partial<OperationalTodayTask> = {}): OperationalTodayTask {
  return {
    id: "task_1",
    restaurantId: "rest_1",
    source: {
      kind: "recommendation",
      id: "rec_1",
      status: "pending"
    },
    title: "Raw English title",
    detail: "Raw English detail",
    priority: "high",
    dueAt: null,
    dueDate: null,
    action: {
      intent: "review_recommendation",
      label: "Review",
      route: "/orders",
      entityId: "rec_1"
    },
    requiredRole: "manager",
    status: "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "Source remains open."
    },
    ...overrides
  };
}

function baseItem(overrides: Partial<OperatingPlanItem> = {}): OperatingPlanItem {
  return {
    id: "plan_1",
    restaurantId: "rest_1",
    kind: "approval",
    title: "Raw English title",
    detail: "Raw English detail",
    why: "Raw English why",
    neededBy: null,
    effect: "Keeps reorder decisions operator-approved before any supplier draft moves.",
    serviceWindow: "before_lunch",
    bucket: "now",
    priority: "high",
    relatedRefs: [],
    dependencyIds: [],
    verificationMethod: "review",
    completionResult: null,
    reprioritization: null,
    requiredRole: "manager",
    status: "open",
    sourceTask: null,
    sourceRestaurantTask: null,
    ...overrides
  };
}

function sharedRestaurantTask(): RestaurantTask {
  return {
    id: "rt_1",
    restaurantId: "rest_1",
    locationId: null,
    origin: "human",
    title: "Close walk-in check",
    detail: "Confirm temps",
    operationalCategory: "closing",
    priority: "normal",
    status: "in_progress",
    timingBucket: "now",
    dueAt: null,
    serviceWindow: "during_closing",
    windowStart: null,
    windowEnd: null,
    requiredRole: "member",
    assigneeUserId: null,
    verificationMethod: "checklist",
    verificationRequired: true,
    checklist: [],
    completionResult: null,
    completionEvidence: [],
    completedAt: null,
    completedBy: null,
    relatedInventoryItemId: null,
    relatedOrderId: null,
    relatedRecommendationId: null,
    relatedSupplierName: null,
    sourceReference: null,
    createdBy: "user_1",
    clientTaskId: "client_rt_1",
    correlationId: "corr_1",
    dependencyIds: [],
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z"
  };
}

test("presentOperatingPlanEffect localizes structured intents without rewriting durable English", () => {
  const durable =
    "Keeps reorder decisions operator-approved before any supplier draft moves.";
  const item = baseItem({
    effect: durable,
    sourceTask: baseTask({
      action: {
        intent: "review_recommendation",
        label: "Review",
        route: "/orders",
        entityId: "rec_1"
      }
    })
  });

  assert.equal(presentOperatingPlanEffect("en", item), durable);
  assert.equal(
    presentOperatingPlanEffect("es", item),
    translate("es", "today.plan.effectBody.reviewRecommendation")
  );
  assert.equal(
    presentOperatingPlanEffect("zh-Hans", item),
    translate("zh-Hans", "today.plan.effectBody.reviewRecommendation")
  );
  assert.equal(item.effect, durable);
});

test("send_supplier_order effect distinguishes draft send from delivery follow-through", () => {
  const draftItem = baseItem({
    effect: "Moves an approved draft to the supplier only after explicit send approval.",
    sourceTask: baseTask({
      source: { kind: "order", id: "ord_1", status: "draft" },
      action: {
        intent: "send_supplier_order",
        label: "Send",
        route: "/orders/ord_1",
        entityId: "ord_1"
      }
    })
  });
  const sentItem = baseItem({
    effect: "Keeps the sent or completed supplier order visible for delivery follow-through.",
    sourceTask: baseTask({
      source: { kind: "order", id: "ord_2", status: "sent" },
      action: {
        intent: "send_supplier_order",
        label: "Receive",
        route: "/orders/ord_2",
        entityId: "ord_2"
      }
    })
  });

  for (const locale of locales) {
    assert.equal(
      presentOperatingPlanEffect(locale, draftItem),
      translate(locale, "today.plan.effectBody.sendDraft")
    );
    assert.equal(
      presentOperatingPlanEffect(locale, sentItem),
      translate(locale, "today.plan.effectBody.followDelivery")
    );
  }
});

test("shared restaurant tasks use shared-task effect body in all locales", () => {
  const durable =
    "Records a restaurant-wide result that authorized team members can verify.";
  const item = baseItem({
    effect: durable,
    kind: "human_task",
    sourceTask: null,
    sourceRestaurantTask: sharedRestaurantTask()
  });

  for (const locale of locales) {
    assert.equal(
      presentOperatingPlanEffect(locale, item),
      translate(locale, "today.plan.effectBody.sharedTask")
    );
  }
  assert.equal(item.effect, durable);
});

test("unstructured open_restaurant_task effects stay evidence-only English", () => {
  const durable = "Operator-authored detail stays English until structured.";
  const item = baseItem({
    effect: durable,
    sourceTask: baseTask({
      detail: durable,
      action: {
        intent: "open_restaurant_task",
        label: "Open",
        route: "/tasks/task_1",
        entityId: "task_1"
      }
    })
  });

  for (const locale of locales) {
    assert.equal(presentOperatingPlanEffect(locale, item), durable);
  }
});

test("presentOperatingPlanItem surfaces localized effect for the Today timeline", () => {
  const durable =
    "Confirms on-hand stock before service depletes coverage further.";
  const item = baseItem({
    effect: durable,
    kind: "mise_task",
    verificationMethod: "count",
    sourceTask: baseTask({
      source: { kind: "inventory", id: "inv_1", status: "Critical" },
      action: {
        intent: "update_inventory_count",
        label: "Count",
        route: "/inventory/inv_1",
        entityId: "inv_1"
      },
      presentation: {
        code: "today.inventory.confirm_count",
        values: { itemName: "Chicken", projectedQuantity: 4, unit: "lb" }
      }
    })
  });

  const es = presentOperatingPlanItem("es", item);
  assert.equal(es.effect, translate("es", "today.plan.effectBody.count"));
  assert.notEqual(es.effect, durable);
  assert.equal(item.effect, durable);
});
