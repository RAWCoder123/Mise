import assert from "node:assert/strict";
import test from "node:test";

import { buildWasteAnalysis } from "../services/domain/wasteAnalysis";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { InventoryItem } from "../types/mise";
import {
  createInitialDemoState,
  repairDemoState
} from "../services/demo/replaceableDemoData";
import { seedDemoActivityFromState } from "../services/demo/demoActivity";
import { normalizeInventoryItem } from "../services/miseValidation";

const restaurantId = "restaurant-a";

function item(
  id: string,
  overrides: Partial<InventoryItem> = {}
): InventoryItem {
  return {
    id,
    restaurant_id: restaurantId,
    item_name: id === "tomatoes" ? "Roma tomatoes" : "Chicken thighs",
    category: id === "tomatoes" ? "Produce" : "Protein",
    unit: "lb",
    current_quantity: 20,
    par_level: 30,
    reorder_threshold: 8,
    estimated_unit_cost: id === "tomatoes" ? 2.5 : 4,
    supplier_name: "Supplier",
    last_updated: "2026-08-03T12:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 1000,
    canonical_unit_verification_status: "verified",
    ...overrides
  };
}

function event(
  id: string,
  itemId: string,
  quantity: number,
  effectiveAt: string,
  overrides: Partial<InventoryEvent> = {}
): InventoryEvent {
  return {
    id,
    sequence: Number(id.replace(/\D/g, "")) || 1,
    restaurantId,
    inventoryItemId: itemId,
    eventType: "waste",
    quantity,
    canonicalUnit: "g",
    effectiveAt,
    recordedAt: effectiveAt,
    actorUserId: "user-a",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: null,
    clientEventId: `client-${id}`,
    idempotencyKey: `inventory:${id}`,
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

function analyze(events: InventoryEvent[], inventoryItems = [item("tomatoes")]) {
  return buildWasteAnalysis({
    restaurantId,
    operatingDate: "2026-08-03",
    restaurantTimeZone: "America/New_York",
    inventoryItems,
    events
  });
}

test("no waste evidence is reported as unknown rather than all clear", () => {
  const summary = analyze([]);
  assert.equal(summary.status, "no_data");
  assert.deepEqual(summary.reasons, ["no_records"]);
  assert.equal(summary.estimatedCost, 0);
  assert.equal(summary.recommendedAction, "start_logging");
});

test("repeated item waste becomes an attention signal with verified cost", () => {
  const summary = analyze([
    event("waste-1", "tomatoes", 2000, "2026-08-01T16:00:00.000Z"),
    event("waste-2", "tomatoes", 1000, "2026-08-03T15:00:00.000Z", {
      metadata: { note: "Trim loss after prep" }
    })
  ]);

  assert.equal(summary.status, "attention");
  assert.ok(summary.reasons.includes("repeat_item"));
  assert.equal(summary.estimatedCost, 7.5);
  assert.equal(summary.costComplete, true);
  assert.equal(summary.topItems[0]?.quantity, 3000);
  assert.equal(summary.topItems[0]?.distinctDayCount, 2);
  assert.equal(summary.recommendedAction, "review_repeat_item");
  assert.equal(summary.recentEvents[0]?.note, "Trim loss after prep");
});

test("a material verified cost increase is compared with the prior window", () => {
  const summary = analyze([
    event("waste-1", "tomatoes", 2000, "2026-07-24T16:00:00.000Z"),
    event("waste-2", "tomatoes", 5000, "2026-08-02T16:00:00.000Z")
  ]);

  assert.equal(summary.priorEstimatedCost, 5);
  assert.equal(summary.estimatedCost, 12.5);
  assert.equal(summary.trend, "up");
  assert.ok(summary.reasons.includes("cost_increase"));
  assert.equal(summary.status, "attention");
});

test("unverified cost setup remains visible without inventing dollars", () => {
  const summary = analyze(
    [event("waste-1", "tomatoes", 500, "2026-08-03T16:00:00.000Z")],
    [item("tomatoes", { canonical_unit_verification_status: "draft" })]
  );

  assert.equal(summary.estimatedCost, null);
  assert.equal(summary.costComplete, false);
  assert.equal(summary.unpricedEventCount, 1);
  assert.ok(summary.reasons.includes("unpriced_records"));
  assert.equal(summary.recommendedAction, "complete_cost_setup");
});

test("superseded waste is removed from analysis and invalid identity fails closed", () => {
  const waste = event("waste-1", "tomatoes", 500, "2026-08-03T16:00:00.000Z");
  const correction = event("correction-2", "tomatoes", 0, "2026-08-03T17:00:00.000Z", {
    eventType: "correction",
    supersedesEventId: waste.id
  });
  assert.equal(analyze([waste, correction]).eventCount, 0);

  assert.throws(
    () => analyze([{ ...waste, restaurantId: "restaurant-b" }]),
    /cross-restaurant/
  );
  assert.throws(
    () =>
      buildWasteAnalysis({
        restaurantId,
        operatingDate: "2026-08-03",
        restaurantTimeZone: "Not/AZone",
        inventoryItems: [item("tomatoes")],
        events: []
      }),
    /valid restaurant timezone/
  );
  assert.throws(
    () =>
      buildWasteAnalysis({
        restaurantId,
        operatingDate: "2026-02-30",
        restaurantTimeZone: "America/New_York",
        inventoryItems: [item("tomatoes")],
        events: []
      }),
    /operating date/
  );
});

test("the replaceable demo dataset carries reviewable persisted waste evidence", () => {
  const now = new Date("2026-08-03T16:00:00.000Z");
  const state = createInitialDemoState(undefined, { preset: "default" }, now);
  const summary = buildWasteAnalysis({
    restaurantId: state.currentRestaurantId,
    operatingDate: "2026-08-03",
    restaurantTimeZone: state.restaurants[0]!.timezone,
    inventoryItems: state.inventoryItems.map(normalizeInventoryItem),
    events: state.inventoryEvents
  });

  assert.equal(summary.eventCount, 4);
  assert.equal(summary.itemCount, 3);
  assert.equal(summary.status, "attention");
  assert.equal(summary.topItems[0]?.itemName, "Bell peppers");
  assert.equal(summary.topItems[0]?.distinctDayCount, 2);
  assert.equal(summary.costComplete, true);
  assert.equal(summary.trend, "up");

  seedDemoActivityFromState(state);
  const wasteEventCount = state.inventoryEvents.filter((event) => event.eventType === "waste").length;
  assert.equal(
    state.activityEvents.filter((event) => event.activityType === "waste_analysis_completed")
      .length,
    wasteEventCount
  );
  seedDemoActivityFromState(state);
  assert.equal(
    state.activityEvents.filter((event) => event.activityType === "waste_analysis_completed")
      .length,
    wasteEventCount
  );

  const { inventoryEvents: _events, ...legacy } = state;
  const repaired = repairDemoState({ ...legacy, schema_version: 7 });
  assert.equal(repaired.migrated, true);
  assert.ok(repaired.state.inventoryEvents.length > 0);
  assert.equal(
    repaired.state.inventoryEvents.every((event) => event.eventType === "count"),
    true
  );
});
