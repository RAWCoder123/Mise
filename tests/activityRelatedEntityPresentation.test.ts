import assert from "node:assert/strict";
import test from "node:test";

import { resolveActivityRelatedEntityHref } from "../services/presentation/activityRelatedEntityPresentation";

test("deep-links inventory items, supplier orders, and restaurant tasks", () => {
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "inventory_item",
      relatedEntityId: "item-1"
    }),
    "/inventory/item-1"
  );
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "supplier_order",
      relatedEntityId: "order-9"
    }),
    "/orders/order-9"
  );
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "restaurant_task",
      relatedEntityId: "task-3"
    }),
    "/tasks/task-3"
  );
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "task",
      relatedEntityId: "legacy-task"
    }),
    "/tasks/legacy-task"
  );
});

test("fails closed for unknown types, missing ids, and unsafe id characters", () => {
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "purchase_recommendation",
      relatedEntityId: "rec-1"
    }),
    null
  );
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "inventory_item",
      relatedEntityId: null
    }),
    null
  );
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "inventory_item",
      relatedEntityId: "  "
    }),
    null
  );
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "supplier_order",
      relatedEntityId: "order/../evil"
    }),
    null
  );
  assert.equal(
    resolveActivityRelatedEntityHref({
      relatedEntityType: "restaurant_task",
      relatedEntityId: "task?x=1"
    }),
    null
  );
});
