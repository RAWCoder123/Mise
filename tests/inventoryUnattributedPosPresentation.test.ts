import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inventoryHasAbsorbedSameDayPos,
  inventoryPosEvidenceQuantity,
  localizeInventoryPrediction
} from "../i18n/inventoryPresentation";
import type { InventoryItem, InventoryPrediction } from "../types/mise";

const item: InventoryItem = {
  id: "item-1",
  restaurant_id: "restaurant-a",
  item_name: "Chicken breast",
  category: "Protein",
  unit: "lb",
  current_quantity: 36,
  par_level: 40,
  reorder_threshold: 12,
  estimated_unit_cost: 4,
  supplier_id: "supplier-a",
  supplier_name: "Fresh Foods",
  last_updated: "2026-09-01T15:00:00.000Z",
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
    projectedQuantity: 36,
    projectedStatus: "Good",
    daysCoverage: 7,
    coverageLabel: "several",
    demandTrend: "normal",
    trendLabel: "normal",
    suggestedOrderQuantity: 0,
    suggestedAction: "none",
    urgency: "low",
    basis: "history",
    depletionCopy: "",
    confidenceCopy: "",
    recommendationCopy: "",
    whyItMatters: "",
    countEvidence: "verified_count",
    countedAt: "2026-09-01T14:00:00.000Z",
    countAgeHours: 1,
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
  "inventory.prediction.action.update": "Update count before ordering",
  "inventory.prediction.action.order": "Order {quantity} {unit}",
  "inventory.prediction.action.delay": "Delay next order",
  "inventory.prediction.action.none": "No order needed",
  "inventory.prediction.basis.history":
    "Based on {count} recent service days mapped through recipe baselines",
  "inventory.prediction.basis.historyToday":
    "Based on today’s mapped POS sales and {count} recent service days",
  "inventory.prediction.basis.demo": "Based on the demo demand pattern and mapped recipe baselines",
  "inventory.prediction.basis.today": "Based on today’s POS sales mapped through recipe baselines",
  "inventory.prediction.basis.learning": "Mise is still learning this item",
  "inventory.prediction.depletion.none": "No mapped POS depletion has been recorded for this item today.",
  "inventory.prediction.depletion.recorded":
    "POS sales depleted about {used} {unit} today. Projected on hand is {projected} {unit}.",
  "inventory.prediction.depletion.absorbed":
    "Today’s verified count already reflects about {used} {unit} of mapped POS demand, so Mise is not subtracting it again. Projected on hand is {projected} {unit}.",
  "inventory.prediction.confidence.history":
    "Demand memory uses a trimmed rolling average, so one unusual day cannot set the baseline.",
  "inventory.prediction.confidence.service":
    "Confidence improves after at least seven service days and three observations of this menu item.",
  "inventory.prediction.confidence.current":
    "The recommendation uses the current par level until enough sales history builds up.",
  "inventory.prediction.why.threshold": "Mapped POS sales pushed projected stock below the reorder threshold.",
  "inventory.prediction.why.learning": "Mise needs more sales history before it can predict coverage with confidence.",
  "inventory.prediction.why.tomorrow": "Current stock may not cover tomorrow’s projected demand.",
  "inventory.prediction.why.rising": "{item} may move faster than your usual ordering rhythm.",
  "inventory.prediction.why.high": "This may tie up cash or create waste risk before the next order cycle.",
  "inventory.prediction.why.aligned": "Current stock appears aligned with recent usage.",
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

test("inventoryHasAbsorbedSameDayPos is true only when unattributed POS demand exists", () => {
  assert.equal(inventoryHasAbsorbedSameDayPos(prediction({ unattributedTodayDepletion: 4 })), true);
  assert.equal(inventoryHasAbsorbedSameDayPos(prediction({ todayDepletion: 4 })), false);
  assert.equal(inventoryHasAbsorbedSameDayPos(prediction()), false);
});

test("inventoryPosEvidenceQuantity prefers post-count depletion over absorbed demand", () => {
  assert.equal(inventoryPosEvidenceQuantity(prediction({ todayDepletion: 3, unattributedTodayDepletion: 4 })), 3);
  assert.equal(inventoryPosEvidenceQuantity(prediction({ unattributedTodayDepletion: 4 })), 4);
  assert.equal(inventoryPosEvidenceQuantity(prediction()), 0);
});

test("localizeInventoryPrediction explains absorbed same-day POS instead of none", () => {
  const localized = localizeInventoryPrediction(
    t as never,
    (value) => String(value),
    item,
    prediction({
      todayDepletion: 0,
      unattributedTodayDepletion: 4,
      isTemporallyAuthoritative: false,
      projectedQuantity: 36,
      historySource: "restaurant_history",
      historySampleDays: 7
    })
  );

  assert.equal(localized.absorbedSameDayPos, true);
  assert.equal(localized.posEvidenceQuantity, 4);
  assert.match(localized.depletion, /already reflects about 4 lb/);
  assert.match(localized.depletion, /not subtracting it again/);
  assert.doesNotMatch(localized.depletion, /No mapped POS depletion/);
  assert.match(localized.basis, /today’s mapped POS sales/);
});

test("localizeInventoryPrediction keeps recorded depletion when post-count POS exists", () => {
  const localized = localizeInventoryPrediction(
    t as never,
    (value) => String(value),
    item,
    prediction({
      todayDepletion: 4,
      unattributedTodayDepletion: 0,
      projectedQuantity: 32,
      isTemporallyAuthoritative: true
    })
  );

  assert.equal(localized.absorbedSameDayPos, false);
  assert.equal(localized.posEvidenceQuantity, 4);
  assert.match(localized.depletion, /POS sales depleted about 4 lb/);
  assert.doesNotMatch(localized.depletion, /already reflects/);
});

test("Inventory detail surfaces temporal-authority notice and absorbed POS rails", () => {
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");

  assert.match(detail, /absorbedSameDayPos/);
  assert.match(detail, /posEvidenceQuantity/);
  assert.match(detail, /inventory\.detail\.temporalAuthority\.title/);
  assert.match(detail, /inventory\.detail\.temporalAuthority\.body/);
  assert.match(detail, /inventory\.detail\.posAbsorbed/);
  assert.match(detail, /posEvidenceQuantity > 0/);
});

test("catalog ships absorbed POS and temporal-authority copy in EN, ES, and zh-Hans", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "inventory.prediction.depletion.absorbed",
    "inventory.detail.posAbsorbed",
    "inventory.detail.temporalAuthority.title",
    "inventory.detail.temporalAuthority.body",
    "inventory.detail.temporalAuthority.meta"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} should appear once per locale`);
  }
});
