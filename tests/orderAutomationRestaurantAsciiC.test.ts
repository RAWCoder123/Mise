import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrderAutomationRestaurantToken,
  canonicalizeOrderAutomationRestaurantId,
  requireCanonicalOrderAutomationWorkspaceId
} from "../services/domain/orderAutomationRestaurantIdentity";
import { assessOrderAutomation } from "../services/domain/orderAutomation";
import type { InventoryItem, PurchaseRecommendation } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/orderAutomationRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/orderAutomation.ts", import.meta.url),
  "utf8"
);
const supplierReliabilitySource = readFileSync(
  new URL("../services/domain/supplierReliability.ts", import.meta.url),
  "utf8"
);
const insightsSalesAnalyticsSource = readFileSync(
  new URL("../services/domain/insightsSalesAnalytics.ts", import.meta.url),
  "utf8"
);

const restaurantId = "rest_automation";
const supplierId = "00000000-0000-4000-8000-000000000101";
const demoRestaurantId = "restaurant_a";
const supplierName = "Fresh Produce Co.";
const now = new Date("2026-07-26T16:00:00.000Z");

function inventory(id: string, workspace: string = restaurantId): InventoryItem {
  return {
    id,
    restaurant_id: workspace,
    item_name: id,
    category: "Produce",
    unit: "lb",
    current_quantity: 2,
    par_level: 20,
    reorder_threshold: 5,
    estimated_unit_cost: 4,
    supplier_id: supplierId,
    supplier_name: supplierName,
    last_updated: "2026-07-26T12:00:00.000Z"
  };
}

function recommendation(
  id: string,
  itemId: string,
  workspace: string = restaurantId
): PurchaseRecommendation {
  return {
    id,
    restaurant_id: workspace,
    inventory_item_id: itemId,
    item_name: itemId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    recommended_quantity: 10,
    unit: "lb",
    reason: "Projected stock is below the reorder threshold.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-07-26T12:30:00.000Z"
  };
}

function assess(workspace: string) {
  return assessOrderAutomation({
    restaurantId: workspace,
    supplierId,
    supplierName,
    candidates: [recommendation("rec-1", "item-1", restaurantId)],
    inventoryItems: [inventory("item-1", restaurantId)],
    recommendationHistory: [],
    inventoryLedgerEvents: [],
    now,
    policy: {
      enabled: false,
      allowAutomaticSend: false,
      maximumOrderValue: 500,
      maximumLineValue: 250,
      maximumInventoryAgeHours: 24,
      maximumRecommendationAgeHours: 24,
      minimumHistoricalApprovals: 3,
      maximumQuantityVarianceRatio: 0.25,
      historyLookbackDays: 180
    }
  });
}

test("MISE-005MW pins orderAutomation restaurantId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MW/);
  assert.match(domainSource, /MISE-005MW/);

  assert.match(
    identitySource,
    /export function asciiTrimOrderAutomationRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /requireCanonicalOrderAutomationWorkspaceId\(input\.restaurantId\)/
  );
  assert.match(domainSource, /from "\.\/orderAutomationRestaurantIdentity"/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /const restaurantId = input\.restaurantId\.trim\(\)/);

  // Leave supplier identity (#773) and presentation name on Unicode trim on main.
  assert.match(domainSource, /const supplierId = input\.supplierId\.trim\(\);/);
  assert.match(domainSource, /const supplierName = input\.supplierName\.trim\(\);/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /orderAutomationSupplierIdentity/);
  assert.doesNotMatch(identitySource, /salesTrendsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSpendRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountAuthorityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierReliabilityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesAnalyticsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)OrderAutomationSupplier/
  );

  // Sibling domain restaurant workspace Unicode trims remain for later tips.
  assert.match(supplierReliabilitySource, /input\.restaurantId\.trim\(\)/);
  assert.match(insightsSalesAnalyticsSource, /input\.restaurantId\.trim\(\)/);
});

test("ASCII trim keeps ordinary order-automation workspace padding stable", () => {
  assert.equal(asciiTrimOrderAutomationRestaurantToken(`  ${restaurantId}  `), restaurantId);
  assert.equal(canonicalizeOrderAutomationRestaurantId(`\t${restaurantId}\n`), restaurantId);
  assert.equal(requireCanonicalOrderAutomationWorkspaceId(` ${restaurantId} `), restaurantId);

  assert.equal(asciiTrimOrderAutomationRestaurantToken(`  ${demoRestaurantId}  `), demoRestaurantId);
  assert.equal(canonicalizeOrderAutomationRestaurantId(`\t${demoRestaurantId}\n`), demoRestaurantId);
  assert.equal(
    requireCanonicalOrderAutomationWorkspaceId(` ${demoRestaurantId} `),
    demoRestaurantId
  );

  const assessment = assess(`  ${restaurantId}  `);
  assert.equal(assessment.restaurantId, restaurantId);
  assert.equal(assessment.supplierId, supplierId);
  assert.ok(assessment.blockers.includes("automation_disabled"));
  assert.ok(!assessment.lines[0]?.blockers.includes("tenant_mismatch"));
});

test("ASCII order-automation trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${restaurantId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), restaurantId);
  assert.notEqual(asciiTrimOrderAutomationRestaurantToken(nbspPadded), restaurantId);
  assert.equal(canonicalizeOrderAutomationRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalOrderAutomationWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );
  assert.throws(
    () => assess(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );

  const emSpacePadded = `\u2003${restaurantId}\u2003`;
  assert.equal(emSpacePadded.trim(), restaurantId);
  assert.equal(canonicalizeOrderAutomationRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalOrderAutomationWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );
  assert.throws(
    () => assess(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );

  const nbspPaddedDemo = `\u00a0${demoRestaurantId}\u00a0`;
  assert.equal(nbspPaddedDemo.trim(), demoRestaurantId);
  assert.equal(canonicalizeOrderAutomationRestaurantId(nbspPaddedDemo), null);
});

test("Order-automation workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeOrderAutomationRestaurantId(""), null);
  assert.equal(canonicalizeOrderAutomationRestaurantId("   "), null);
  assert.equal(canonicalizeOrderAutomationRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeOrderAutomationRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalOrderAutomationWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalOrderAutomationWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalOrderAutomationWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalOrderAutomationWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );
  assert.throws(
    () => assess(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a restaurant."
  );
});
