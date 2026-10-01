import assert from "node:assert/strict";
import test from "node:test";

import type { MessageKey, MessageValues } from "../i18n/catalog";
import { localizeInventoryPrediction } from "../i18n/inventoryPresentation";
import {
  inventoryNeedsRecountForFreshness,
  inventoryProjectionAllowsAddToOrder,
  resolveInventoryCountTrustState
} from "../services/presentation/inventoryCountFreshnessPresentation";
import type { InventoryItem, InventoryPrediction } from "../types/mise";

const t = (key: MessageKey, _values?: MessageValues) => key;
const formatNumber = (value: number) => String(value);

function baseItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item-1",
    restaurant_id: "rest-1",
    item_name: "Basil",
    category: "Produce",
    unit: "lb",
    current_quantity: 4,
    par_level: 8,
    reorder_threshold: 3,
    estimated_unit_cost: 2.5,
    supplier_id: "supplier-1",
    supplier_name: "Green Farm",
    last_updated: "2026-08-30T12:00:00.000Z",
    canonical_unit: "g",
    canonical_unit_verification_status: "verified",
    ...overrides
  };
}

function basePrediction(overrides: Partial<InventoryPrediction> = {}): InventoryPrediction {
  return {
    todayDepletion: 0,
    projectedQuantity: 4,
    projectedStatus: "Low",
    daysCoverage: 1.2,
    coverageLabel: "May run low tomorrow",
    demandTrend: "normal",
    trendLabel: "Normal demand",
    suggestedOrderQuantity: 6,
    suggestedAction: "Order",
    urgency: "medium",
    basis: "history",
    depletionCopy: "",
    confidenceCopy: "",
    recommendationCopy: "",
    whyItMatters: "",
    countEvidence: "verified_count",
    countedAt: "2026-08-31T08:00:00.000Z",
    countAgeHours: 4,
    countFreshness: "fresh",
    unattributedTodayDepletion: 0,
    isTemporallyAuthoritative: true,
    historySource: "restaurant_history",
    historySampleDays: 14,
    averageDailyUsage: 2,
    ...overrides
  };
}

test("resolveInventoryCountTrustState prefers contaminated, then stale, then unverified", () => {
  assert.equal(
    resolveInventoryCountTrustState(
      basePrediction({ countEvidence: "contaminated_projection", countFreshness: "fresh" })
    ),
    "contaminated"
  );
  assert.equal(
    resolveInventoryCountTrustState(basePrediction({ countFreshness: "stale" })),
    "stale"
  );
  assert.equal(
    resolveInventoryCountTrustState(
      basePrediction({ countEvidence: "no_verified_count", countFreshness: "unverified" })
    ),
    "unverified"
  );
  assert.equal(resolveInventoryCountTrustState(basePrediction()), "trusted");
});

test("inventoryProjectionAllowsAddToOrder only when trusted", () => {
  assert.equal(inventoryProjectionAllowsAddToOrder(basePrediction()), true);
  assert.equal(
    inventoryProjectionAllowsAddToOrder(basePrediction({ countFreshness: "stale" })),
    false
  );
  assert.equal(
    inventoryProjectionAllowsAddToOrder(
      basePrediction({ countEvidence: "no_verified_count", countFreshness: "unverified" })
    ),
    false
  );
  assert.equal(
    inventoryProjectionAllowsAddToOrder(
      basePrediction({ countEvidence: "contaminated_projection", countFreshness: "fresh" })
    ),
    false
  );
});

test("inventoryNeedsRecountForFreshness covers stale and unverified only", () => {
  assert.equal(inventoryNeedsRecountForFreshness(basePrediction()), false);
  assert.equal(
    inventoryNeedsRecountForFreshness(basePrediction({ countFreshness: "stale" })),
    true
  );
  assert.equal(
    inventoryNeedsRecountForFreshness(
      basePrediction({ countEvidence: "no_verified_count", countFreshness: "unverified" })
    ),
    true
  );
  assert.equal(
    inventoryNeedsRecountForFreshness(
      basePrediction({ countEvidence: "contaminated_projection", countFreshness: "fresh" })
    ),
    false
  );
});

test("localizeInventoryPrediction surfaces stale recount guidance and blocks add-to-order", () => {
  const localized = localizeInventoryPrediction(
    t,
    formatNumber,
    baseItem(),
    basePrediction({ countFreshness: "stale", countAgeHours: 40 })
  );

  assert.equal(localized.countTrust, "stale");
  assert.equal(localized.needsRecount, true);
  assert.equal(localized.addToOrderBlocked, true);
  assert.equal(localized.action, "inventory.prediction.action.recount");
  assert.equal(localized.coverage, "inventory.prediction.coverage.stale");
  assert.equal(localized.recommendation, "inventory.prediction.recommendation.stale");
});

test("localizeInventoryPrediction surfaces unverified recount guidance", () => {
  const localized = localizeInventoryPrediction(
    t,
    formatNumber,
    baseItem(),
    basePrediction({
      countEvidence: "no_verified_count",
      countFreshness: "unverified",
      countedAt: null,
      countAgeHours: null,
      isTemporallyAuthoritative: false
    })
  );

  assert.equal(localized.countTrust, "unverified");
  assert.equal(localized.needsRecount, true);
  assert.equal(localized.addToOrderBlocked, true);
  assert.equal(localized.action, "inventory.prediction.action.recount");
  assert.equal(localized.coverage, "inventory.prediction.coverage.unverified");
});

test("localizeInventoryPrediction keeps trusted fresh counts orderable", () => {
  const localized = localizeInventoryPrediction(t, formatNumber, baseItem(), basePrediction());

  assert.equal(localized.countTrust, "trusted");
  assert.equal(localized.needsRecount, false);
  assert.equal(localized.addToOrderBlocked, false);
  assert.match(localized.action, /inventory\.prediction\.action\.order/);
});
