import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventoryHealthAccessibilityLabel,
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
