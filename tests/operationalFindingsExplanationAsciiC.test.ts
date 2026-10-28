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
  boundedCanonicalOperationalFindingsExplanation,
  canonicalOperationalFindingsExplanation
} from "../services/domain/operationalFindingsExplanationIdentity";
import type { VerifiedCountCandidate } from "../services/domain/inventoryCountAuthority";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingsExplanationIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const generatedAt = "2026-07-27T12:00:00.000Z";
const supplierId = "10000000-0000-4000-8000-000000000012";
const cleanExplanation = "Chicken Breast has less than one service day of projected coverage.";
const accentedExplanation = "El pecho de pollo tiene menos de un día de cobertura proyectada.";

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
  reason: cleanExplanation,
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

test("MISE-005SI pins operational-findings explanation to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005SI/);
  assert.match(domainSource, /MISE-005SI/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalFindingsExplanation("),
    identitySource.indexOf("export function boundedCanonicalOperationalFindingsExplanation(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(domainSource, /from "\.\/operationalFindingsExplanationIdentity"/);
  assert.match(
    domainSource,
    /explanation: boundedCanonicalOperationalFindingsExplanation\(\s*recommendation\.reason,\s*"Inventory is below the restaurant's configured operating level\."\s*\)/
  );
  assert.match(
    domainSource,
    /explanation: boundedCanonicalOperationalFindingsExplanation\(\s*insight\.why_it_matters \?\? insight\.description,\s*insight\.description\s*\)/
  );

  // Leave sibling boundedText surfaces on Unicode trim.
  assert.match(
    domainSource,
    /title: boundedText\(`Review \$\{recommendation\.item_name\} coverage`,/
  );
  assert.match(
    domainSource,
    /title: boundedText\(insight\.title, "Operational finding", 120\)/
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
  assert.doesNotMatch(identitySource, /operationalFindingsTitleIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);

  assert.equal(canonicalOperationalFindingsExplanation(`  ${cleanExplanation}  `), cleanExplanation);
  assert.equal(canonicalOperationalFindingsExplanation(`\u00a0${cleanExplanation}\u00a0`), cleanExplanation);
  assert.equal(canonicalOperationalFindingsExplanation(accentedExplanation), accentedExplanation);

  const emPadded = `\u2003${cleanExplanation}\u2003`;
  assert.equal(emPadded.trim().replace(/\s+/g, " "), cleanExplanation);
  assert.equal(canonicalOperationalFindingsExplanation(emPadded), emPadded);
  assert.notEqual(canonicalOperationalFindingsExplanation(emPadded), cleanExplanation);

  assert.equal(
    boundedCanonicalOperationalFindingsExplanation(emPadded, "Inventory is below the restaurant's configured operating level."),
    emPadded
  );
  assert.equal(
    boundedCanonicalOperationalFindingsExplanation("\u2003\u2003", "Inventory is below the restaurant's configured operating level."),
    "Inventory is below the restaurant's configured operating level."
  );
  assert.equal(
    boundedCanonicalOperationalFindingsExplanation("   ", "Inventory is below the restaurant's configured operating level."),
    "Inventory is below the restaurant's configured operating level."
  );
});

test("buildDailyOperationalBrief no longer invents clean explanations from em-space padding", () => {
  const paddedReason = `\u2003${recommendation.reason}\u2003`;
  assert.equal(paddedReason.trim().replace(/\s+/g, " "), recommendation.reason);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [{ ...recommendation, reason: paddedReason }],
    insights: [],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:recommendation:recommendation-chicken");
  assert.ok(finding);
  assert.equal(finding.explanation, paddedReason);
  assert.notEqual(finding.explanation, recommendation.reason);
});

test("insight explanations keep em-space padding instead of inventing a clean durable explanation", () => {
  const paddedWhy = `\u2003${insight.why_it_matters}\u2003`;
  assert.equal(paddedWhy.trim().replace(/\s+/g, " "), insight.why_it_matters);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [{ ...insight, why_it_matters: paddedWhy }],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:insight:insight-cost");
  assert.ok(finding);
  assert.equal(finding.explanation, paddedWhy);
  assert.notEqual(finding.explanation, insight.why_it_matters);
});

test("sibling title NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspTitle = `\u00a0${insight.title}\u00a0`;
  assert.equal(nbspTitle.trim().replace(/\s+/g, " "), insight.title);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [{ ...insight, title: nbspTitle }],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:insight:insight-cost");
  assert.ok(finding);
  assert.equal(finding.title, insight.title);
  assert.equal(finding.explanation, insight.why_it_matters);
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
  assert.equal(finding.explanation, insight.why_it_matters);
});
