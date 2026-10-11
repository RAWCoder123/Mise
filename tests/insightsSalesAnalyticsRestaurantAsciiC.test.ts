import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSalesAnalyticsRestaurantToken,
  canonicalizeInsightsSalesAnalyticsRestaurantId,
  requireCanonicalInsightsSalesAnalyticsWorkspaceId
} from "../services/domain/insightsSalesAnalyticsRestaurantIdentity";
import { buildInsightsSalesAnalytics } from "../services/domain/insightsSalesAnalytics";
import type { PosSale } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/insightsSalesAnalyticsRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/insightsSalesAnalytics.ts", import.meta.url),
  "utf8"
);
const insightsApplicationSource = readFileSync(
  new URL("../services/application/insights.ts", import.meta.url),
  "utf8"
);
const salesTrendsSource = readFileSync(
  new URL("../services/domain/salesTrends.ts", import.meta.url),
  "utf8"
);
const supplierReliabilitySource = readFileSync(
  new URL("../services/domain/supplierReliability.ts", import.meta.url),
  "utf8"
);
const orderAutomationSource = readFileSync(
  new URL("../services/domain/orderAutomation.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

function sale(restaurantId: string): PosSale {
  return {
    id: "sale-1",
    restaurant_id: restaurantId,
    sale_date: "2026-07-10",
    item_name: "Dinner",
    category: "Entree",
    quantity_sold: 2,
    gross_sales: 40,
    net_sales: 38,
    source_pos: "Test POS",
    created_at: "2026-07-10T12:00:00.000Z"
  };
}

function analytics(restaurantId: string) {
  return buildInsightsSalesAnalytics({
    restaurantId,
    throughDate: "2026-07-10",
    lookbackDays: 1,
    sales: [sale(workspace)]
  });
}

test("MISE-005MY pins insightsSalesAnalytics restaurantId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MY/);
  assert.match(domainSource, /MISE-005MY/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSalesAnalyticsRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /requireCanonicalInsightsSalesAnalyticsWorkspaceId\(input\.restaurantId\)/
  );
  assert.match(domainSource, /from "\.\/insightsSalesAnalyticsRestaurantIdentity"/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /const restaurantId = input\.restaurantId\.trim\(\)/);

  // Leave Insights application (#740) and sibling domain restaurant tips alone.
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /salesTrendsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierReliabilityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSpendRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountAuthorityRestaurantIdentity/);

  // Insights application tip (#740) owns application/insights.ts Unicode trim on main.
  assert.match(insightsApplicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(insightsApplicationSource, /requireCanonicalInsightsSalesAnalyticsWorkspaceId/);
  assert.doesNotMatch(insightsApplicationSource, /MISE-005MY/);

  // Sibling domain restaurant workspace Unicode trims remain for later / open tips.
  assert.match(salesTrendsSource, /restaurantId\.trim\(\)/);
  assert.match(supplierReliabilitySource, /input\.restaurantId\.trim\(\)/);
  assert.match(orderAutomationSource, /input\.restaurantId\.trim\(\)/);
});

test("ASCII trim keeps ordinary insights sales-analytics workspace padding stable", () => {
  assert.equal(asciiTrimInsightsSalesAnalyticsRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeInsightsSalesAnalyticsRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalInsightsSalesAnalyticsWorkspaceId(` ${workspace} `), workspace);

  const result = analytics(`  ${workspace}  `);
  assert.equal(result.saleCount, 1);
  assert.equal(result.totalUnits, 2);
  assert.equal(result.totalGross, 40);
  assert.equal(result.bestSellers[0]?.itemName, "Dinner");
});

test("ASCII insights sales-analytics trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimInsightsSalesAnalyticsRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeInsightsSalesAnalyticsRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalInsightsSalesAnalyticsWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );
  assert.throws(
    () => analytics(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeInsightsSalesAnalyticsRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalInsightsSalesAnalyticsWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );
  assert.throws(
    () => analytics(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );
});

test("Insights sales-analytics workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInsightsSalesAnalyticsRestaurantId(""), null);
  assert.equal(canonicalizeInsightsSalesAnalyticsRestaurantId("   "), null);
  assert.equal(canonicalizeInsightsSalesAnalyticsRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeInsightsSalesAnalyticsRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalInsightsSalesAnalyticsWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInsightsSalesAnalyticsWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInsightsSalesAnalyticsWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInsightsSalesAnalyticsWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );
  assert.throws(
    () => analytics(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Sales analytics requires a restaurant workspace."
  );
});
