import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventoryHealthAccessibilityLabel,
  buildInventoryLocationHealthAccessibilityLabel,
  buildInventoryLocationHealthBreakdown,
  getInventoryHealthPercentages,
  getInventoryHealthTotal,
  getWellStockedPercentage,
  inventoryHealthStatusOrder,
  normalizeInventoryHealthCounts
} from "../services/presentation/inventoryHealthPresentation";

const labels = {
  good: "Good",
  watch: "Watch",
  low: "Low",
  critical: "Critical",
  wellStocked: "Well stocked",
  empty: "No items"
};

test("inventory health presentation preserves semantic ordering and independently rounded percentages", () => {
  const counts = { good: 4, watch: 1, low: 1, critical: 1 };

  assert.deepEqual(inventoryHealthStatusOrder, ["good", "watch", "low", "critical"]);
  assert.equal(getInventoryHealthTotal(counts), 7);
  assert.equal(getWellStockedPercentage(counts), 57);
  assert.deepEqual(getInventoryHealthPercentages(counts), {
    good: 57,
    watch: 14,
    low: 14,
    critical: 14
  });
});

test("inventory health presentation safely normalizes empty, negative, and non-finite input", () => {
  const unsafe = { good: -4, watch: Number.NaN, low: Number.POSITIVE_INFINITY, critical: 0 };

  assert.deepEqual(normalizeInventoryHealthCounts(unsafe), { good: 0, watch: 0, low: 0, critical: 0 });
  assert.equal(getInventoryHealthTotal(unsafe), 0);
  assert.equal(getWellStockedPercentage(unsafe), 0);
  assert.deepEqual(getInventoryHealthPercentages(unsafe), { good: 0, watch: 0, low: 0, critical: 0 });
});

test("inventory health accessibility keeps exact counts while announcing the aggregate percentage", () => {
  const formatCount = (value: number) => `#${value}`;
  const formatPercentage = (value: number) => `${value} percent`;

  assert.equal(
    buildInventoryHealthAccessibilityLabel({
      counts: { good: 4, watch: 1, low: 1, critical: 1 },
      labels,
      formatCount,
      formatPercentage
    }),
    "Well stocked: 57 percent. Good: #4. Watch: #1. Low: #1. Critical: #1."
  );
  assert.equal(
    buildInventoryHealthAccessibilityLabel({
      counts: { good: 0, watch: 0, low: 0, critical: 0 },
      labels,
      formatCount,
      formatPercentage
    }),
    "No items"
  );
});

test("inventory location health attributes each stocked item to every station holding it", () => {
  const breakdown = buildInventoryLocationHealthBreakdown({
    locations: [
      { id: "loc_main", name: "Main", sortOrder: 0 },
      { id: "loc_line", name: "Line", sortOrder: 20 },
      { id: "loc_walk", name: "Walk-in", sortOrder: 10 }
    ],
    balances: [
      { inventoryItemId: "item_a", storageLocationId: "loc_main", quantity: 4 },
      { inventoryItemId: "item_a", storageLocationId: "loc_line", quantity: 1 },
      { inventoryItemId: "item_b", storageLocationId: "loc_walk", quantity: 2 },
      { inventoryItemId: "item_c", storageLocationId: "loc_main", quantity: 0 },
      { inventoryItemId: "item_unknown", storageLocationId: "loc_main", quantity: 3 }
    ],
    itemStatuses: [
      { itemId: "item_a", status: "Critical" },
      { itemId: "item_b", status: "Good" },
      { itemId: "item_c", status: "Watch" }
    ]
  });

  assert.equal(breakdown.stationCount, 3);
  assert.equal(breakdown.stockedStationCount, 3);
  assert.deepEqual(
    breakdown.locations.map((row) => row.name),
    ["Main", "Walk-in", "Line"]
  );
  assert.deepEqual(breakdown.locations[0], {
    locationId: "loc_main",
    name: "Main",
    sortOrder: 0,
    itemCount: 1,
    counts: { good: 0, watch: 0, low: 0, critical: 1 },
    atRiskCount: 1
  });
  assert.deepEqual(breakdown.locations[1], {
    locationId: "loc_walk",
    name: "Walk-in",
    sortOrder: 10,
    itemCount: 1,
    counts: { good: 1, watch: 0, low: 0, critical: 0 },
    atRiskCount: 0
  });
  assert.deepEqual(breakdown.locations[2], {
    locationId: "loc_line",
    name: "Line",
    sortOrder: 20,
    itemCount: 1,
    counts: { good: 0, watch: 0, low: 0, critical: 1 },
    atRiskCount: 1
  });
});

test("inventory location health keeps empty stations and ignores invalid balance rows", () => {
  const breakdown = buildInventoryLocationHealthBreakdown({
    locations: [
      { id: "loc_main", name: "Main", sortOrder: 0 },
      { id: "loc_line", name: "Line", sortOrder: 1 }
    ],
    balances: [
      { inventoryItemId: "item_a", storageLocationId: "loc_main", quantity: Number.NaN },
      { inventoryItemId: "", storageLocationId: "loc_main", quantity: 2 },
      { inventoryItemId: "item_a", storageLocationId: "loc_main", quantity: -1 }
    ],
    itemStatuses: [{ itemId: "item_a", status: "Low" }]
  });

  assert.equal(breakdown.stockedStationCount, 0);
  assert.deepEqual(breakdown.locations.map((row) => row.itemCount), [0, 0]);
  assert.equal(
    buildInventoryLocationHealthAccessibilityLabel({
      breakdown,
      labels: {
        stations: "Stations",
        emptyStation: "empty",
        items: (count) => `${count} items`,
        atRisk: (count) => `${count} at risk.`
      }
    }),
    "Main: empty Line: empty"
  );
});
