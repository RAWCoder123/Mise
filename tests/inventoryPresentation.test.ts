import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isContaminatedProjection,
  localizeInventoryPrediction
} from "../i18n/inventoryPresentation";
import type { InventoryItem, InventoryPrediction } from "../types/mise";

const item: InventoryItem = {
  id: "item-1",
  restaurant_id: "restaurant-a",
  item_name: "Chicken breast",
  category: "Protein",
  unit: "lb",
  current_quantity: 100,
  par_level: 40,
  reorder_threshold: 12,
  estimated_unit_cost: 4,
  supplier_id: "supplier-a",
  supplier_name: "Fresh Foods",
  last_updated: "2026-08-17T12:00:00.000Z",
  canonical_unit: "g",
  canonical_quantity_per_unit: 453.592,
  canonical_unit_verification_status: "verified",
  canonical_unit_verified_at: "2026-08-01T12:00:00.000Z",
  canonical_unit_verified_by: "owner-a"
};

function prediction(overrides: Partial<InventoryPrediction> = {}): InventoryPrediction {
  return {
    averageDailyUsage: 5,
    historySampleDays: 7,
    historySource: "restaurant_history",
    todayDepletion: 0,
    projectedQuantity: 100,
    projectedStatus: "Watch",
    daysCoverage: 4,
    coverageLabel: "several",
    demandTrend: "normal",
    trendLabel: "normal",
    suggestedOrderQuantity: 0,
    suggestedAction: "update",
    urgency: "medium",
    basis: "history",
    depletionCopy: "",
    confidenceCopy: "",
    recommendationCopy: "",
    whyItMatters: "",
    countEvidence: "verified_count",
    countedAt: "2026-08-17T10:00:00.000Z",
    countAgeHours: 2,
    countFreshness: "fresh",
    unattributedTodayDepletion: 0,
    isTemporallyAuthoritative: true,
    ...overrides
  };
}

const messages: Record<string, string> = {
  "inventory.status.watch": "Watch",
  "inventory.status.good": "Good",
  "inventory.status.low": "Low",
  "inventory.status.critical": "Critical",
  "inventory.prediction.coverage.contaminated": "On-hand chronology is untrusted",
  "inventory.prediction.coverage.several": "Likely enough for several days",
  "inventory.prediction.coverage.learning": "Mise is still learning this pattern",
  "inventory.prediction.coverage.high": "Unusually high stock",
  "inventory.prediction.coverage.today": "May run out today",
  "inventory.prediction.coverage.tomorrow": "May run low tomorrow",
  "inventory.prediction.coverage.days": "Likely enough for {count} days",
  "inventory.prediction.trend.normal": "Normal demand",
  "inventory.prediction.trend.rising": "Demand rising",
  "inventory.prediction.trend.falling": "Demand easing",
  "inventory.prediction.trend.learning": "Mise is learning",
  "inventory.prediction.action.recount": "Record a new physical count",
  "inventory.prediction.action.update": "Update count before ordering",
  "inventory.prediction.action.order": "Order {quantity} {unit}",
  "inventory.prediction.action.delay": "Delay next order",
  "inventory.prediction.action.none": "No order needed",
  "inventory.prediction.basis.contaminated": "On-hand was last overwritten by an invalid future-dated count",
  "inventory.prediction.basis.history": "Based on {count} recent service days mapped through recipe baselines",
  "inventory.prediction.basis.historyToday": "Based on today’s mapped POS sales and {count} recent service days",
  "inventory.prediction.basis.demo": "Based on the demo demand pattern and mapped recipe baselines",
  "inventory.prediction.basis.today": "Based on today’s POS sales mapped through recipe baselines",
  "inventory.prediction.basis.learning": "Mise is still learning this item",
  "inventory.prediction.depletion.none": "No mapped POS depletion has been recorded for this item today.",
  "inventory.prediction.depletion.recorded":
    "POS sales depleted about {used} {unit} today. Projected on hand is {projected} {unit}.",
  "inventory.prediction.confidence.contaminated":
    "Quantity confidence is suspended until a valid physical count replaces the contaminated on-hand number.",
  "inventory.prediction.confidence.history":
    "Demand memory uses a trimmed rolling average, so one unusual day cannot set the baseline.",
  "inventory.prediction.confidence.service":
    "Confidence improves after at least seven service days and three observations of this menu item.",
  "inventory.prediction.confidence.current":
    "The recommendation uses the current par level until enough sales history builds up.",
  "inventory.prediction.why.contaminated":
    "A future-dated count overwrote on-hand, so quantity-based planning is blocked until you recount.",
  "inventory.prediction.why.threshold": "Mapped POS sales pushed projected stock below the reorder threshold.",
  "inventory.prediction.why.learning": "Mise needs more sales history before it can predict coverage with confidence.",
  "inventory.prediction.why.tomorrow": "Current stock may not cover tomorrow’s projected demand.",
  "inventory.prediction.why.rising": "{item} may move faster than your usual ordering rhythm.",
  "inventory.prediction.why.high": "This may tie up cash or create waste risk before the next order cycle.",
  "inventory.prediction.why.aligned": "Current stock appears aligned with recent usage.",
  "inventory.prediction.recommendation.contaminated": "Record a new physical count before ordering. {coverage}.",
  "inventory.prediction.recommendation.update": "Update the count before ordering. {coverage}.",
  "inventory.prediction.recommendation.order":
    "Mise recommends ordering {quantity} {unit} of {item}. {coverage}.",
  "inventory.prediction.recommendation.delay": "Delay the next order while stock remains high. {coverage}.",
  "inventory.prediction.recommendation.none": "No order is needed right now. {coverage}."
};

function t(key: string, values?: Record<string, string | number>) {
  const template = messages[key];
  assert.ok(template, `missing message ${key}`);
  if (!values) return template;
  return Object.entries(values).reduce(
    (current, [name, value]) => current.replaceAll(`{${name}}`, String(value)),
    template
  );
}

test("isContaminatedProjection only matches contaminated_projection evidence", () => {
  assert.equal(isContaminatedProjection(prediction({ countEvidence: "contaminated_projection" })), true);
  assert.equal(isContaminatedProjection(prediction({ countEvidence: "verified_count" })), false);
  assert.equal(isContaminatedProjection(prediction({ countEvidence: "no_verified_count" })), false);
});

test("localizeInventoryPrediction treats contaminated evidence distinctly from ordinary Watch", () => {
  const localized = localizeInventoryPrediction(
    t as never,
    (value) => String(value),
    item,
    prediction({
      countEvidence: "contaminated_projection",
      projectedStatus: "Watch",
      isTemporallyAuthoritative: false,
      countFreshness: "unverified",
      countedAt: null
    })
  );

  assert.equal(localized.contaminatedProjection, true);
  assert.equal(localized.coverage, "On-hand chronology is untrusted");
  assert.equal(localized.action, "Record a new physical count");
  assert.equal(localized.basis, "On-hand was last overwritten by an invalid future-dated count");
  assert.match(localized.confidence, /Quantity confidence is suspended/);
  assert.match(localized.whyItMatters, /future-dated count/);
  assert.match(localized.recommendation, /Record a new physical count before ordering/);
  assert.doesNotMatch(localized.recommendation, /Update the count before ordering/);
});

test("localizeInventoryPrediction keeps ordinary Watch copy when evidence is verified", () => {
  const localized = localizeInventoryPrediction(
    t as never,
    (value) => String(value),
    item,
    prediction({ countEvidence: "verified_count", projectedStatus: "Watch" })
  );

  assert.equal(localized.contaminatedProjection, false);
  assert.equal(localized.action, "Update count before ordering");
  assert.match(localized.recommendation, /Update the count before ordering/);
  assert.doesNotMatch(localized.coverage, /untrusted/);
});

test("Inventory detail and hub surface contaminated recount recovery instead of Add to order", () => {
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const hub = readFileSync("app/(tabs)/inventory.tsx", "utf8");

  assert.match(detail, /contaminatedProjection/);
  assert.match(detail, /inventory\.detail\.contaminated\.title/);
  assert.match(detail, /inventory\.detail\.contaminated\.addBlocked/);
  assert.match(detail, /prediction\.countEvidence === "contaminated_projection"/);
  assert.match(detail, /mutationAllowed && !contaminatedProjection/);
  assert.match(detail, /setOperation\("count"\)/);

  assert.match(hub, /prediction\.countEvidence === "contaminated_projection"/);
  assert.match(hub, /inventory\.row\.contaminated/);
  assert.match(hub, /inventory\.prediction\.action\.recount/);
});
