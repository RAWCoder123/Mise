import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAdvisoryPurchaseDecisionPatterns,
  type PurchaseDecisionPattern
} from "../services/domain/purchaseDecisionMemory";

test("isolated advisory-memory failure does not reject the Orders dataset load", async () => {
  const authoritativeRecommendations = [{ id: "recommendation-a" }];
  const authoritativeOrders = [{ id: "order-a" }];
  const [recommendations, authorities, patterns, orders, email, spend] = await Promise.all([
    Promise.resolve(authoritativeRecommendations),
    Promise.resolve({ "recommendation-a": { ready: true } }),
    resolveAdvisoryPurchaseDecisionPatterns(async () => {
      throw new Error("purchase memory unavailable");
    }),
    Promise.resolve(authoritativeOrders),
    Promise.resolve({ status: "connected" }),
    Promise.resolve([{ date: "2026-08-24", amount: 42 }])
  ]);

  assert.equal(recommendations, authoritativeRecommendations);
  assert.deepEqual(authorities, { "recommendation-a": { ready: true } });
  assert.deepEqual(patterns, []);
  assert.equal(orders, authoritativeOrders);
  assert.deepEqual(email, { status: "connected" });
  assert.deepEqual(spend, [{ date: "2026-08-24", amount: 42 }]);
});

test("available advisory-memory evidence is preserved unchanged", async () => {
  const expected = [{ inventoryItemId: "inventory-a" }] as PurchaseDecisionPattern[];
  const result = await resolveAdvisoryPurchaseDecisionPatterns(async () => expected);
  assert.equal(result, expected);
});
