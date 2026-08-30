import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog";
import { formatLocalizedDate } from "../i18n/formatters";
import type { OperatingPlanItem } from "../services/domain/operatingPlan";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import {
  englishDeliveryScheduledWhy,
  presentOperatingPlanWhy
} from "../services/presentation/operatingPlanWhyCopy";
import { presentOperatingPlanItem } from "../services/presentation/operationsPresentation";

const locales = ["en", "es", "zh-Hans"] as const;
const deliveryDate = "2026-08-05";

function baseTask(overrides: Partial<OperationalTodayTask> = {}): OperationalTodayTask {
  return {
    id: "task_1",
    restaurantId: "rest_1",
    source: {
      kind: "order",
      id: "order_1",
      status: "draft"
    },
    title: "Send Sysco order",
    detail: englishDeliveryScheduledWhy(deliveryDate),
    priority: "high",
    dueAt: null,
    dueDate: deliveryDate,
    action: {
      intent: "send_supplier_order",
      label: "Review and send",
      route: "/orders/order_1",
      entityId: "order_1"
    },
    requiredRole: "manager",
    status: "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "Supplier order remains a draft and has not been represented as sent."
    },
    presentation: {
      code: "today.order.send",
      values: {
        supplierName: "Sysco",
        deliveryDate
      }
    },
    ...overrides
  };
}

function baseItem(overrides: Partial<OperatingPlanItem> = {}): OperatingPlanItem {
  const sourceTask = overrides.sourceTask === undefined ? baseTask() : overrides.sourceTask;
  return {
    id: "plan_1",
    restaurantId: "rest_1",
    kind: "mise_task",
    title: "Send Sysco order",
    detail: englishDeliveryScheduledWhy(deliveryDate),
    why: englishDeliveryScheduledWhy(deliveryDate),
    neededBy: deliveryDate,
    effect: "Moves an approved draft to the supplier only after explicit send approval.",
    serviceWindow: "before_supplier_cutoff",
    bucket: "now",
    priority: "high",
    relatedRefs: [{ type: "supplier_order", id: "order_1" }],
    dependencyIds: [],
    verificationMethod: "receipt",
    completionResult: null,
    reprioritization: null,
    requiredRole: "manager",
    status: "open",
    sourceTask,
    sourceRestaurantTask: null,
    ...overrides
  };
}

test("presentOperatingPlanWhy localizes structured delivery-scheduled why", () => {
  const item = baseItem();
  for (const locale of locales) {
    const expectedDate = formatLocalizedDate(locale, `${deliveryDate}T12:00:00.000Z`, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
    const expected = translate(locale, "today.plan.whyBody.deliveryScheduled", {
      date: expectedDate
    });
    assert.equal(presentOperatingPlanWhy(locale, item), expected);
    assert.notEqual(expected, item.why);
  }
});

test("presentOperatingPlanWhy keeps freeform recommendation why as evidence", () => {
  const why = "Coverage drops below one service day.";
  const item = baseItem({
    why,
    sourceTask: baseTask({
      source: { kind: "recommendation", id: "rec_1", status: "pending" },
      detail: "Review the purchase recommendation before drafting.",
      presentation: {
        code: "today.recommendation.review",
        values: { itemName: "Roma tomatoes", rawReason: why }
      },
      action: {
        intent: "review_recommendation",
        label: "Review",
        route: "/orders",
        entityId: "rec_1"
      }
    })
  });

  for (const locale of locales) {
    assert.equal(presentOperatingPlanWhy(locale, item), why);
  }
});

test("presentOperatingPlanWhy reuses localized detail when why matches English detail", () => {
  const item = baseItem({
    why: "Review the approved draft before it leaves the restaurant.",
    detail: "Review the approved draft before it leaves the restaurant.",
    sourceTask: baseTask({
      detail: "Review the approved draft before it leaves the restaurant.",
      presentation: {
        code: "today.order.send",
        values: {
          supplierName: "Sysco",
          deliveryDate: null
        }
      }
    })
  });

  for (const locale of locales) {
    const localizedDetail = presentOperatingPlanItem(locale, item).detail;
    assert.equal(presentOperatingPlanWhy(locale, item, localizedDetail), localizedDetail);
    if (locale !== "en") {
      assert.notEqual(localizedDetail, item.why);
    }
  }
});

test("presentOperatingPlanItem wires localized delivery why for Today rows", () => {
  const item = baseItem();
  for (const locale of locales) {
    const presented = presentOperatingPlanItem(locale, item);
    const expectedDate = formatLocalizedDate(locale, `${deliveryDate}T12:00:00.000Z`, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
    assert.equal(
      presented.why,
      translate(locale, "today.plan.whyBody.deliveryScheduled", { date: expectedDate })
    );
    // Durable English why on the plan item remains unchanged for audit.
    assert.equal(item.why, englishDeliveryScheduledWhy(deliveryDate));
  }
});

test("presentOperatingPlanWhy leaves opaque why unchanged without presentation", () => {
  const why = "Operator-authored floor note.";
  const item = baseItem({
    why,
    sourceTask: null
  });
  for (const locale of locales) {
    assert.equal(presentOperatingPlanWhy(locale, item), why);
  }
});
