import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  canReviseDraftRecommendationQuantity,
  draftRecommendationQuantityUnchanged
} from "../services/domain/miseDomain";
import type { PurchaseRecommendation } from "../types/mise";

const restaurantId = "rest_revise_qty";
const orderId = "order_draft_revise";

function recommendation(
  overrides: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id: "rec_1",
    restaurant_id: restaurantId,
    inventory_item_id: "item_1",
    item_name: "Roma tomatoes",
    supplier_id: "supplier_1",
    supplier_name: "Fresh Co",
    unit: "cs",
    recommended_quantity: 4,
    reason: "test",
    urgency: "medium",
    status: "approved",
    supplier_order_id: orderId,
    created_at: "2026-08-30T12:00:00.000Z",
    ...overrides
  };
}

test("canReviseDraftRecommendationQuantity requires approved binding to the draft", () => {
  assert.equal(canReviseDraftRecommendationQuantity(recommendation(), orderId), true);
  assert.equal(
    canReviseDraftRecommendationQuantity(recommendation({ status: "pending" }), orderId),
    false
  );
  assert.equal(
    canReviseDraftRecommendationQuantity(
      recommendation({ supplier_order_id: "other_draft" }),
      orderId
    ),
    false
  );
  assert.equal(canReviseDraftRecommendationQuantity(recommendation(), " "), false);
});

test("draftRecommendationQuantityUnchanged compares exact finite quantities", () => {
  assert.equal(draftRecommendationQuantityUnchanged(4, 4), true);
  assert.equal(draftRecommendationQuantityUnchanged(4, 5), false);
  assert.equal(draftRecommendationQuantityUnchanged(Number.NaN, 4), false);
});

test("demo undo then re-approve revises an approved draft line quantity", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const { DEMO_RESTAURANT_ID } = await import("../services/demo/replaceableDemoData");

  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  const pending = (await repository.fetchPurchaseRecommendations(DEMO_RESTAURANT_ID, "pending"))[0];
  assert.ok(pending);

  const approved = await repository.approvePurchaseRecommendation(
    DEMO_RESTAURANT_ID,
    pending.id,
    pending.recommended_quantity
  );
  assert.equal(approved.outcome, "applied");
  assert.ok(approved.order);
  assert.equal(
    canReviseDraftRecommendationQuantity(approved.recommendation, approved.order.id),
    true
  );

  const draftOrderId = approved.order.id;
  const revisedQuantity = approved.recommendation.recommended_quantity + 2;
  assert.equal(
    draftRecommendationQuantityUnchanged(approved.recommendation.recommended_quantity, revisedQuantity),
    false
  );

  const undone = await repository.undoPurchaseRecommendationAction(
    DEMO_RESTAURANT_ID,
    pending.id
  );
  assert.equal(undone.recommendation.status, "pending");

  const reapproved = await repository.approvePurchaseRecommendation(
    DEMO_RESTAURANT_ID,
    pending.id,
    revisedQuantity
  );
  assert.equal(reapproved.outcome, "applied");
  assert.equal(reapproved.recommendation.recommended_quantity, revisedQuantity);
  assert.equal(reapproved.recommendation.status, "approved");
  assert.ok(reapproved.order);
  // Sole-line undo clears the draft; re-approve may recreate a new draft id.
  assert.equal(reapproved.recommendation.supplier_order_id, reapproved.order.id);
  assert.ok(reapproved.order.status === "draft");
  void draftOrderId;
});

test("application revise helper composes undo then approve with unchanged short-circuit", async () => {
  const source = await readFile(new URL("../services/application/orders.ts", import.meta.url), "utf8");
  assert.match(source, /export async function reviseDraftPurchaseRecommendationQuantity/);
  assert.match(source, /draftRecommendationQuantityUnchanged/);
  assert.match(source, /canReviseDraftRecommendationQuantity/);
  assert.match(source, /undoPurchaseRecommendationAction/);
  assert.match(source, /approvePurchaseRecommendation/);
  assert.match(source, /outcome: "unchanged"/);
});

test("order detail wires draft quantity revise beside persistent undo", async () => {
  const orderDetail = await readFile(new URL("../app/orders/[id].tsx", import.meta.url), "utf8");
  assert.match(orderDetail, /reviseDraftPurchaseRecommendationQuantity/);
  assert.match(orderDetail, /reviseLinkedRecommendation/);
  assert.match(orderDetail, /orders\.detail\.lines\.reviseAction/);
  assert.match(orderDetail, /undoPurchaseRecommendationAction/);
});
