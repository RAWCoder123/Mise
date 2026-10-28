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
  boundedCanonicalOperationalFindingsRecommendedAction,
  canonicalOperationalFindingsRecommendedAction
} from "../services/domain/operationalFindingsRecommendedActionIdentity";
import type { VerifiedCountCandidate } from "../services/domain/inventoryCountAuthority";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingsRecommendedActionIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const generatedAt = "2026-07-27T12:00:00.000Z";
const supplierId = "10000000-0000-4000-8000-000000000012";
const cleanAction = "Review the latest produce receipt before the next order.";
const accentedAction = "Revisar el recibo de productos antes del próximo pedido.";

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
  recommended_action: cleanAction,
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

test("MISE-005SJ pins operational-findings recommendedAction to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005SJ/);
  assert.match(domainSource, /MISE-005SJ/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalFindingsRecommendedAction("),
    identitySource.indexOf("export function boundedCanonicalOperationalFindingsRecommendedAction(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(domainSource, /from "\.\/operationalFindingsRecommendedActionIdentity"/);
  assert.match(
    domainSource,
    /const recommendedAction = boundedCanonicalOperationalFindingsRecommendedAction\(\s*`Review \$\{recommendation\.recommended_quantity\}/
  );
  assert.match(
    domainSource,
    /const recommendedAction = boundedCanonicalOperationalFindingsRecommendedAction\(\s*insight\.recommended_action,\s*"Review the underlying restaurant evidence\."\s*\)/
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
    /summary: boundedText\(\s*`\$\{recommendation\.item_name\}:/
  );
  assert.match(
    domainSource,
    /rationale: boundedText\(rationale,/
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
  assert.doesNotMatch(identitySource, /operationalFindingsExplanationIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);

  assert.equal(canonicalOperationalFindingsRecommendedAction(`  ${cleanAction}  `), cleanAction);
  assert.equal(canonicalOperationalFindingsRecommendedAction(`\u00a0${cleanAction}\u00a0`), cleanAction);
  assert.equal(canonicalOperationalFindingsRecommendedAction(accentedAction), accentedAction);

  const emPadded = `\u2003${cleanAction}\u2003`;
  assert.equal(emPadded.trim().replace(/\s+/g, " "), cleanAction);
  assert.equal(canonicalOperationalFindingsRecommendedAction(emPadded), emPadded);
  assert.notEqual(canonicalOperationalFindingsRecommendedAction(emPadded), cleanAction);

  assert.equal(
    boundedCanonicalOperationalFindingsRecommendedAction(emPadded, "Review the underlying restaurant evidence."),
    emPadded
  );
  assert.equal(
    boundedCanonicalOperationalFindingsRecommendedAction("\u2003\u2003", "Review the underlying restaurant evidence."),
    "Review the underlying restaurant evidence."
  );
  assert.equal(
    boundedCanonicalOperationalFindingsRecommendedAction("   ", "Review the underlying restaurant evidence."),
    "Review the underlying restaurant evidence."
  );
});

test("buildDailyOperationalBrief no longer invents clean recommendedActions from em-space padding", () => {
  const paddedSupplier = `\u2003${recommendation.supplier_name}\u2003`;
  const expectedAction = `Review ${recommendation.recommended_quantity} ${recommendation.unit} from ${paddedSupplier}; edit or dismiss the draft suggestion as needed.`;
  // Prior boundedText Unicode-collapsed mid-string em-spaces into ASCII spaces,
  // inventing a different durable recommendedAction than the raw template.
  const unicodeInvented = expectedAction.trim().replace(/\s+/g, " ");
  assert.notEqual(unicodeInvented, expectedAction);
  assert.match(unicodeInvented, /Fresh Produce Co\. ;/);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [{ ...recommendation, supplier_name: paddedSupplier }],
    insights: [],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:recommendation:recommendation-chicken");
  assert.ok(finding);
  assert.equal(finding.recommendedAction, expectedAction);
  assert.notEqual(finding.recommendedAction, unicodeInvented);
  assert.equal(finding.managerFeedback.effectiveRecommendedAction, expectedAction);
});

test("insight recommendedActions keep em-space padding instead of inventing a clean durable action", () => {
  const paddedAction = `\u2003${insight.recommended_action}\u2003`;
  assert.equal(paddedAction.trim().replace(/\s+/g, " "), insight.recommended_action);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [{ ...insight, recommended_action: paddedAction }],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:insight:insight-cost");
  assert.ok(finding);
  assert.equal(finding.recommendedAction, paddedAction);
  assert.notEqual(finding.recommendedAction, insight.recommended_action);
  assert.equal(finding.managerFeedback.effectiveRecommendedAction, paddedAction);
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
  assert.equal(finding.recommendedAction, insight.recommended_action);
});

test("sibling explanation NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspWhy = `\u00a0${insight.why_it_matters}\u00a0`;
  assert.equal(nbspWhy.trim().replace(/\s+/g, " "), insight.why_it_matters);

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [{ ...insight, why_it_matters: nbspWhy }],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:insight:insight-cost");
  assert.ok(finding);
  assert.equal(finding.explanation, insight.why_it_matters);
  assert.equal(finding.recommendedAction, insight.recommended_action);
});
