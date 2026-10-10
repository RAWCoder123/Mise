import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSalesTrendsRestaurantToken,
  canonicalizeSalesTrendsRestaurantId,
  requireCanonicalSalesTrendsWorkspaceId
} from "../services/domain/salesTrendsRestaurantIdentity";
import { buildRecordedSalesTrend } from "../services/domain/salesTrends";
import type { PosSale } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/salesTrendsRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/salesTrends.ts", import.meta.url),
  "utf8"
);
const insightsApplicationSource = readFileSync(
  new URL("../services/application/insights.ts", import.meta.url),
  "utf8"
);
const supplierSpendSource = readFileSync(
  new URL("../services/domain/supplierSpend.ts", import.meta.url),
  "utf8"
);
const wasteAnalysisSource = readFileSync(
  new URL("../services/domain/wasteAnalysis.ts", import.meta.url),
  "utf8"
);
const inventoryCountAuthoritySource = readFileSync(
  new URL("../services/domain/inventoryCountAuthority.ts", import.meta.url),
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
    quantity_sold: 1,
    gross_sales: 100,
    net_sales: 100,
    source_pos: "Test POS",
    created_at: "2026-07-10T12:00:00.000Z"
  };
}

test("MISE-005MS pins salesTrends restaurantId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MS/);
  assert.match(domainSource, /MISE-005MS/);

  assert.match(
    identitySource,
    /export function asciiTrimSalesTrendsRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /requireCanonicalSalesTrendsWorkspaceId\(restaurantId\)/);
  assert.doesNotMatch(domainSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /const normalizedRestaurantId = restaurantId\.trim\(\)/);

  // Leave Insights application (#740) and sibling domain restaurant tips alone.
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSpendRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountAuthorityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);

  // Insights application tip (#740) owns application/insights.ts Unicode trim on main.
  assert.match(insightsApplicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(insightsApplicationSource, /requireCanonicalSalesTrendsWorkspaceId/);
  assert.doesNotMatch(insightsApplicationSource, /MISE-005MS/);

  // Sibling domain restaurant workspace Unicode trims remain for later tips.
  assert.match(supplierSpendSource, /restaurantId\.trim\(\)/);
  assert.match(wasteAnalysisSource, /input\.restaurantId\.trim\(\)/);
  assert.match(inventoryCountAuthoritySource, /input\.restaurantId\.trim\(\)/);
});

test("ASCII trim keeps ordinary sales-trends workspace padding stable", () => {
  assert.equal(asciiTrimSalesTrendsRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeSalesTrendsRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalSalesTrendsWorkspaceId(` ${workspace} `), workspace);

  const trend = buildRecordedSalesTrend(`  ${workspace}  `, [sale(workspace)], { limit: 7 });
  assert.deepEqual(trend, [{ date: "2026-07-10", sales: 100 }]);
});

test("ASCII sales-trends trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimSalesTrendsRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeSalesTrendsRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalSalesTrendsWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );
  assert.throws(
    () => buildRecordedSalesTrend(nbspPadded, [sale(workspace)], { limit: 7 }),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeSalesTrendsRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalSalesTrendsWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );
  assert.throws(
    () => buildRecordedSalesTrend(emSpacePadded, [sale(workspace)], { limit: 7 }),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );
});

test("Sales-trends workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeSalesTrendsRestaurantId(""), null);
  assert.equal(canonicalizeSalesTrendsRestaurantId("   "), null);
  assert.equal(canonicalizeSalesTrendsRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeSalesTrendsRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalSalesTrendsWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalSalesTrendsWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalSalesTrendsWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalSalesTrendsWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );
  assert.throws(
    () => buildRecordedSalesTrend("", [sale(workspace)], { limit: 7 }),
    (error: unknown) =>
      error instanceof Error && error.message === "Sales trend requires a restaurant."
  );
});
