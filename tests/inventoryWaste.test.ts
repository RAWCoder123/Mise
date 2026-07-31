import assert from "node:assert/strict";
import test from "node:test";

import {
  canRecordInventoryWaste,
  planInventoryWaste
} from "../services/domain/inventoryWaste";
import {
  operatingLimits,
  requireInventoryWasteNote,
  requireInventoryWasteQuantity
} from "../services/miseValidation";
import { canRecordInventoryWaste as canRecordInventoryWasteForRestaurant } from "../services/tenantAccess";
import type { RestaurantMembership } from "../types/mise";

test("planInventoryWaste deducts waste and floors at zero without going negative", () => {
  const planned = planInventoryWaste({
    quantityBefore: 12,
    quantityRemoved: 4.5,
    note: "  Spoiled lettuce  "
  });

  assert.equal(planned.quantityBefore, 12);
  assert.equal(planned.quantityRemovedRequested, 4.5);
  assert.equal(planned.quantityRemovedApplied, 4.5);
  assert.equal(planned.quantityAfter, 7.5);
  assert.equal(planned.floored, false);
  assert.equal(planned.metadata.note, "Spoiled lettuce");
  assert.equal(planned.reason, "waste");
  assert.equal(planned.sourceWorkflow, "record_waste");
});

test("planInventoryWaste floors excess waste requests at zero and records the request", () => {
  const planned = planInventoryWaste({
    quantityBefore: 3,
    quantityRemoved: 10,
    note: null
  });

  assert.equal(planned.quantityAfter, 0);
  assert.equal(planned.quantityRemovedApplied, 3);
  assert.equal(planned.floored, true);
  assert.equal(planned.metadata.quantity_removed_requested, 10);
  assert.equal(planned.metadata.quantity_removed_applied, 3);
});

test("requireInventoryWasteQuantity rejects zero, negative, and unbounded values", () => {
  assert.throws(() => requireInventoryWasteQuantity(0), /greater than zero/i);
  assert.throws(() => requireInventoryWasteQuantity(-1), /greater than zero/i);
  assert.throws(
    () => requireInventoryWasteQuantity(operatingLimits.inventoryQuantity + 1),
    /no more than/i
  );
  assert.equal(requireInventoryWasteQuantity(2.25), 2.25);
});

test("requireInventoryWasteNote trims and bounds optional notes", () => {
  assert.equal(requireInventoryWasteNote(undefined), null);
  assert.equal(requireInventoryWasteNote("  trim me  "), "trim me");
  assert.throws(() => requireInventoryWasteNote("x".repeat(241)), /240/i);
});

test("staff may record waste while remaining outside manager inventory edit roles", () => {
  assert.equal(canRecordInventoryWaste("staff"), true);
  assert.equal(canRecordInventoryWaste("manager"), true);
  assert.equal(canRecordInventoryWaste("owner"), true);
  assert.equal(canRecordInventoryWaste("admin"), true);
  assert.equal(canRecordInventoryWaste(null), false);

  const staffMembership: RestaurantMembership[] = [
    {
      id: "membership_staff",
      restaurant_id: "restaurant_a",
      user_id: "user_staff",
      role: "staff",
      status: "active",
      created_at: "2026-07-31T00:00:00.000Z",
      updated_at: "2026-07-31T00:00:00.000Z"
    }
  ];
  assert.equal(canRecordInventoryWasteForRestaurant(staffMembership, "restaurant_a"), true);
  assert.equal(canRecordInventoryWasteForRestaurant(staffMembership, "restaurant_b"), false);
});
