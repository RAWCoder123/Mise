import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileInventoryCount,
  type InventoryReconciliationThresholds
} from "../services/domain/inventoryReconciliation";
import type { InventoryEvent } from "../services/domain/inventoryLedger";

const thresholds: InventoryReconciliationThresholds = {
  absoluteQuantity: 250,
  percentage: 0.1,
  percentageFloorQuantity: 1000
};

function event(
  id: string,
  sequence: number,
  eventType: InventoryEvent["eventType"],
  quantity: number,
  overrides: Partial<InventoryEvent> = {}
): InventoryEvent {
  return {
    id,
    sequence,
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType,
    quantity,
    canonicalUnit: "g",
    effectiveAt: `2026-07-26T10:0${sequence}:00.000Z`,
    recordedAt: `2026-07-26T10:0${sequence}:01.000Z`,
    actorUserId: "manager-1",
    source: "count",
    sourceReference: null,
    reasonCode: null,
    clientEventId: `client-${id}`,
    idempotencyKey: `inventory-${id}`,
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

test("classifies a count within both thresholds as aligned", () => {
  const result = reconcileInventoryCount({
    events: [
      event("baseline", 1, "count", 2000),
      event("usage", 2, "usage", 500),
      event("observed", 3, "count", 1400)
    ],
    countEventId: "observed",
    thresholds
  });

  assert.equal(result.status, "aligned");
  assert.equal(result.expectedQuantity, 1500);
  assert.equal(result.varianceQuantity, -100);
});

test("surfaces material count variance for investigation", () => {
  const result = reconcileInventoryCount({
    events: [
      event("baseline", 1, "count", 5000),
      event("usage", 2, "usage", 1000),
      event("observed", 3, "count", 3000)
    ],
    countEventId: "observed",
    thresholds
  });

  assert.equal(result.status, "material_variance");
  if (result.status === "material_variance") {
    assert.equal(result.expectedQuantity, 4000);
    assert.equal(result.varianceQuantity, -1000);
    assert.equal(result.variancePercentage, 0.25);
  }
});

test("blocks a first count from being labeled as operational variance", () => {
  const result = reconcileInventoryCount({
    events: [event("first-count", 1, "count", 3000)],
    countEventId: "first-count",
    thresholds
  });

  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.deepEqual(result.reasons, ["missing_prior_inventory_evidence"]);
  }
});

test("ignores events from other tenants and inventory items", () => {
  const result = reconcileInventoryCount({
    events: [
      event("baseline", 1, "count", 2000),
      event("other-tenant", 2, "receipt", 5000, { restaurantId: "restaurant-b" }),
      event("other-item", 2, "receipt", 5000, { inventoryItemId: "onions" }),
      event("observed", 3, "count", 2000)
    ],
    countEventId: "observed",
    thresholds
  });

  assert.equal(result.status, "aligned");
  assert.equal(result.expectedQuantity, 2000);
});

test("blocks reconciliation on unit and authoritative ordering conflicts", () => {
  const result = reconcileInventoryCount({
    events: [
      event("baseline", 1, "count", 2000, { canonicalUnit: "each" }),
      event("duplicate-sequence", 3, "usage", 1),
      event("observed", 3, "count", 1800)
    ],
    countEventId: "observed",
    thresholds
  });

  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(result.reasons.includes("count_unit_mismatch"));
    assert.ok(result.reasons.includes("duplicate_authoritative_sequence"));
  }
});
