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
  boundedCanonicalOperationalFindingsEvidenceSummary,
  canonicalOperationalFindingsEvidenceSummary
} from "../services/domain/operationalFindingsEvidenceSummaryIdentity";
import type { VerifiedCountCandidate } from "../services/domain/inventoryCountAuthority";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingsEvidenceSummaryIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const generatedAt = "2026-07-27T12:00:00.000Z";
const supplierId = "10000000-0000-4000-8000-000000000012";
const cleanSummary = "Received produce cost is above the recent restaurant baseline.";
const accentedSummary = "El costo de productos supera la línea base reciente del restaurante.";

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
  description: cleanSummary,
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

test("MISE-005SK pins operational-findings evidence summary to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005SK/);
  assert.match(domainSource, /MISE-005SK/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalFindingsEvidenceSummary("),
    identitySource.indexOf("export function boundedCanonicalOperationalFindingsEvidenceSummary(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(domainSource, /from "\.\/operationalFindingsEvidenceSummaryIdentity"/);
  assert.match(
    domainSource,
    /summary: boundedCanonicalOperationalFindingsEvidenceSummary\(\s*`\$\{recommendation\.item_name\}:/
  );
  assert.match(
    domainSource,
    /summary: boundedCanonicalOperationalFindingsEvidenceSummary\(\s*`\$\{item\.item_name\}:/
  );
  assert.match(
    domainSource,
    /summary: boundedCanonicalOperationalFindingsEvidenceSummary\(insight\.description, insight\.title\)/
  );
  assert.match(
    domainSource,
    /summary: boundedCanonicalOperationalFindingsEvidenceSummary\(\s*`\$\{sale\.item_name\}:/
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
    /explanation: boundedText\(recommendation\.reason,/
  );
  assert.match(
    domainSource,
    /explanation: boundedText\(insight\.why_it_matters \?\? insight\.description,/
  );
  assert.match(
    domainSource,
    /const recommendedAction = boundedText\(\s*`Review \$\{recommendation\.recommended_quantity\}/
  );
  assert.match(
    domainSource,
    /const recommendedAction = boundedText\(insight\.recommended_action,/
  );
  assert.match(
    domainSource,
    /rationale: boundedText\(rationale,/
  );
  assert.match(
    domainSource,
    /unmappedSales\.map\(\(sale\) => boundedText\(sale\.item_name,/
  );

  // Leave restaurant workspace on Unicode trim in this tip (#755 owns that path).
  assert.match(domainSource, /const restaurantId = input\.restaurantId\.trim\(\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /operationalFindingsTitleIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsExplanationIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);

  assert.equal(canonicalOperationalFindingsEvidenceSummary(`  ${cleanSummary}  `), cleanSummary);
  assert.equal(canonicalOperationalFindingsEvidenceSummary(`\u00a0${cleanSummary}\u00a0`), cleanSummary);
  assert.equal(canonicalOperationalFindingsEvidenceSummary(accentedSummary), accentedSummary);

  const emPadded = `\u2003${cleanSummary}\u2003`;
  assert.equal(emPadded.trim().replace(/\s+/g, " "), cleanSummary);
  assert.equal(canonicalOperationalFindingsEvidenceSummary(emPadded), emPadded);
  assert.notEqual(canonicalOperationalFindingsEvidenceSummary(emPadded), cleanSummary);

  assert.equal(
    boundedCanonicalOperationalFindingsEvidenceSummary(emPadded, "Pending purchase recommendation"),
    emPadded
  );
  assert.equal(
    boundedCanonicalOperationalFindingsEvidenceSummary("\u2003\u2003", "Pending purchase recommendation"),
    "Pending purchase recommendation"
  );
  assert.equal(
    boundedCanonicalOperationalFindingsEvidenceSummary("   ", "Pending purchase recommendation"),
    "Pending purchase recommendation"
  );
});

test("buildDailyOperationalBrief no longer invents clean recommendation evidence summaries from em-space padding", () => {
  const paddedItemName = `\u2003${recommendation.item_name}\u2003`;
  const expectedSummary = `${paddedItemName}: ${recommendation.recommended_quantity} ${recommendation.unit} suggested`;
  // Prior boundedText Unicode-collapsed mid-string em-spaces into ASCII spaces,
  // inventing a different durable evidence summary than the raw template.
  const unicodeInvented = expectedSummary.trim().replace(/\s+/g, " ");
  assert.notEqual(unicodeInvented, expectedSummary);
  assert.match(unicodeInvented, /Chicken Breast : 38 lb suggested/);

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
  const recommendationEvidence = finding.evidence.find((entry) => entry.type === "purchase_recommendation");
  assert.ok(recommendationEvidence);
  assert.equal(recommendationEvidence.summary, expectedSummary);
  assert.notEqual(recommendationEvidence.summary, unicodeInvented);
});

test("insight evidence summaries keep em-space padding instead of inventing a clean durable summary", () => {
  const paddedDescription = `\u2003${insight.description}\u2003`;
  assert.equal(paddedDescription.trim().replace(/\s+/g, " "), insight.description);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [{ ...insight, description: paddedDescription }],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:insight:insight-cost");
  assert.ok(finding);
  assert.equal(finding.evidence[0]?.summary, paddedDescription);
  assert.notEqual(finding.evidence[0]?.summary, insight.description);
});

test("unmapped sale evidence summaries keep em-space padding instead of inventing a clean durable summary", () => {
  const unmappedSale: PosSale = {
    ...sale,
    id: "sale-unmapped",
    item_name: `\u2003Salmon Bowl\u2003`,
    source_record_id: "csv-unmapped"
  };
  const expectedSummary = `${unmappedSale.item_name}: ${unmappedSale.quantity_sold} sold without a recipe mapping`;
  const unicodeInvented = expectedSummary.trim().replace(/\s+/g, " ");
  assert.notEqual(unicodeInvented, expectedSummary);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale, unmappedSale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:data-gap:mapping:2026-07-27");
  assert.ok(finding);
  const saleEvidence = finding.evidence.find((entry) => entry.id === unmappedSale.id);
  assert.ok(saleEvidence);
  assert.equal(saleEvidence.summary, expectedSummary);
  assert.notEqual(saleEvidence.summary, unicodeInvented);
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
  assert.equal(finding.evidence[0]?.summary, insight.description);
});
