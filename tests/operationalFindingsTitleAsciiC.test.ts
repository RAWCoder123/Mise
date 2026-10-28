import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  Insight,
  InventoryItem,
  MenuItemIngredient,
  PosSale,
  PurchaseRecommendation
} from "../types/mise";
import { buildDailyOperationalBrief } from "../services/domain/operationalFindings";
import {
  boundedCanonicalOperationalFindingsTitle,
  canonicalOperationalFindingsTitle
} from "../services/domain/operationalFindingsTitleIdentity";
import type { VerifiedCountCandidate } from "../services/domain/inventoryCountAuthority";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingsTitleIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const generatedAt = "2026-07-27T12:00:00.000Z";
const supplierId = "10000000-0000-4000-8000-000000000012";
const cleanTitle = "Review chicken coverage";
const accentedTitle = "Revisar cobertura de pollo";

const item: InventoryItem = {
  id: "item-chicken",
  restaurant_id: restaurantId,
  item_name: "Chicken Breast",
  category: "Protein",
  unit: "lb",
  current_quantity: 2,
  par_level: 40,
  reorder_threshold: 8,
  estimated_unit_cost: 4.5,
  supplier_id: supplierId,
  supplier_name: "Fresh Produce Co.",
  last_updated: "2026-07-27T11:00:00.000Z",
  canonical_unit: "g",
  canonical_quantity_per_unit: 453.592,
  canonical_unit_verification_status: "verified",
  canonical_unit_verified_at: "2026-07-26T12:00:00.000Z",
  canonical_unit_verified_by: "owner-a"
};

const mapping: MenuItemIngredient = {
  id: "mapping-chicken",
  restaurant_id: restaurantId,
  menu_item_name: "Chicken Bowl",
  inventory_item_id: item.id,
  quantity_used_per_sale: 0.5,
  unit: "lb"
};

const recommendation: PurchaseRecommendation = {
  id: "recommendation-chicken",
  restaurant_id: restaurantId,
  inventory_item_id: item.id,
  item_name: item.item_name,
  supplier_id: supplierId,
  supplier_name: item.supplier_name,
  recommended_quantity: 38,
  unit: "lb",
  reason: "Chicken Breast has less than one service day of projected coverage.",
  urgency: "high",
  status: "pending",
  supplier_order_id: null,
  created_at: "2026-07-27T11:05:00.000Z"
};

const sale: PosSale = {
  id: "sale-chicken",
  restaurant_id: restaurantId,
  source_record_id: "csv-1",
  sale_date: "2026-07-27",
  item_name: "Chicken Bowl",
  category: "Entree",
  quantity_sold: 20,
  gross_sales: 300,
  net_sales: 280,
  source_pos: "Manual CSV Upload",
  created_at: "2026-07-27T10:00:00.000Z"
};

const insight: Insight = {
  id: "insight-cost",
  restaurant_id: restaurantId,
  insight_type: "cost",
  title: "Produce cost needs review",
  description: "Received produce cost is above the recent restaurant baseline.",
  why_it_matters: "A sustained increase can change menu margin.",
  recommended_action: "Review the latest produce receipt before the next order.",
  severity: "info",
  created_at: "2026-07-27T11:15:00.000Z"
};

function verifiedCount(effectiveAt: string): VerifiedCountCandidate {
  return {
    restaurantId,
    inventoryItemId: item.id,
    effectiveAt,
    eventType: "count",
    sequence: 1
  };
}

test("MISE-005SH pins operational-findings title to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005SH/);
  assert.match(domainSource, /MISE-005SH/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalFindingsTitle("),
    identitySource.indexOf("export function boundedCanonicalOperationalFindingsTitle(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(domainSource, /from "\.\/operationalFindingsTitleIdentity"/);
  assert.match(
    domainSource,
    /title: boundedCanonicalOperationalFindingsTitle\(\s*`Review \$\{recommendation\.item_name\} coverage`,\s*"Review inventory coverage",\s*120\s*\)/
  );
  assert.match(
    domainSource,
    /title: boundedCanonicalOperationalFindingsTitle\(insight\.title, "Operational finding", 120\)/
  );

  // Leave sibling boundedText surfaces on Unicode trim.
  assert.match(
    domainSource,
    /explanation: boundedText\(recommendation\.reason,/
  );
  assert.match(
    domainSource,
    /const recommendedAction = boundedText\(\s*`Review \$\{recommendation\.recommended_quantity\}/
  );
  assert.match(
    domainSource,
    /summary: boundedText\(\s*`\$\{recommendation\.item_name\}:/
  );
  assert.match(
    domainSource,
    /rationale: boundedText\(rationale,/
  );
  assert.match(
    domainSource,
    /explanation: boundedText\(insight\.why_it_matters/
  );
  assert.match(
    domainSource,
    /const recommendedAction = boundedText\(insight\.recommended_action,/
  );
  assert.match(
    domainSource,
    /summary: boundedText\(insight\.description, insight\.title\)/
  );
  assert.match(
    domainSource,
    /summary: boundedText\(`\$\{sale\.item_name\}:/
  );
  assert.match(
    domainSource,
    /unmappedSales\.map\(\(sale\) => boundedText\(sale\.item_name,/
  );

  // Leave restaurant workspace on Unicode trim in this tip (#755 owns that path).
  assert.match(domainSource, /const restaurantId = input\.restaurantId\.trim\(\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);

  assert.equal(canonicalOperationalFindingsTitle(`  ${cleanTitle}  `), cleanTitle);
  assert.equal(canonicalOperationalFindingsTitle(`\u00a0${cleanTitle}\u00a0`), cleanTitle);
  assert.equal(canonicalOperationalFindingsTitle(accentedTitle), accentedTitle);

  const emPadded = `\u2003${cleanTitle}\u2003`;
  assert.equal(emPadded.trim().replace(/\s+/g, " "), cleanTitle);
  assert.equal(canonicalOperationalFindingsTitle(emPadded), emPadded);
  assert.notEqual(canonicalOperationalFindingsTitle(emPadded), cleanTitle);

  assert.equal(
    boundedCanonicalOperationalFindingsTitle(emPadded, "Operational finding", 120),
    emPadded
  );
  assert.equal(
    boundedCanonicalOperationalFindingsTitle("\u2003\u2003", "Operational finding", 120),
    "Operational finding"
  );
  assert.equal(
    boundedCanonicalOperationalFindingsTitle("   ", "Operational finding", 120),
    "Operational finding"
  );
});

test("buildDailyOperationalBrief no longer invents clean titles from em-space padding", () => {
  const paddedItemName = `\u2003${item.item_name}\u2003`;
  assert.equal(paddedItemName.trim(), item.item_name);

  const priorInventedTitle = `Review ${paddedItemName} coverage`.trim().replace(/\s+/g, " ");
  assert.equal(priorInventedTitle, `Review ${item.item_name} coverage`);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [{ ...recommendation, item_name: paddedItemName }],
    insights: [],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:recommendation:recommendation-chicken");
  assert.ok(finding);
  assert.equal(finding.title, `Review ${paddedItemName} coverage`);
  assert.notEqual(finding.title, `Review ${item.item_name} coverage`);
});

test("insight titles keep em-space padding instead of inventing a clean durable title", () => {
  const paddedInsightTitle = `\u2003${insight.title}\u2003`;
  assert.equal(paddedInsightTitle.trim().replace(/\s+/g, " "), insight.title);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [{ ...insight, title: paddedInsightTitle }],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:insight:insight-cost");
  assert.ok(finding);
  assert.equal(finding.title, paddedInsightTitle);
  assert.notEqual(finding.title, insight.title);
});

test("sibling explanation NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspReason = `\u00a0${recommendation.reason}\u00a0`;
  assert.equal(nbspReason.trim().replace(/\s+/g, " "), recommendation.reason);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [{ ...recommendation, reason: nbspReason }],
    insights: [],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:recommendation:recommendation-chicken");
  assert.ok(finding);
  assert.equal(finding.explanation, recommendation.reason);
  assert.equal(finding.title, `Review ${item.item_name} coverage`);
});

test("sibling recommendedAction NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspAction = `\u00a0${insight.recommended_action}\u00a0`;
  assert.equal(nbspAction.trim().replace(/\s+/g, " "), insight.recommended_action);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [{ ...insight, recommended_action: nbspAction }],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:insight:insight-cost");
  assert.ok(finding);
  assert.equal(finding.recommendedAction, insight.recommended_action);
  assert.equal(finding.title, insight.title);
});
