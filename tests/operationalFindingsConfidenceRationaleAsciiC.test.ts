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
  boundedCanonicalOperationalFindingsConfidenceRationale,
  canonicalOperationalFindingsConfidenceRationale
} from "../services/domain/operationalFindingsConfidenceRationaleIdentity";
import type { VerifiedCountCandidate } from "../services/domain/inventoryCountAuthority";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingsConfidenceRationaleIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const generatedAt = "2026-07-27T12:00:00.000Z";
const supplierId = "10000000-0000-4000-8000-000000000012";
const cleanRationale =
  "Current tenant inventory, a verified canonical unit, and a menu mapping support this quantity.";
const accentedRationale = "La evidencia actual del restaurante respalda esta cantidad.";
const rationaleFallback = "Confidence is limited by available restaurant evidence.";

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

test("MISE-005SM pins operational-findings confidence rationale to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005SM/);
  assert.match(domainSource, /MISE-005SM/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalFindingsConfidenceRationale("),
    identitySource.indexOf("export function boundedCanonicalOperationalFindingsConfidenceRationale(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(domainSource, /from "\.\/operationalFindingsConfidenceRationaleIdentity"/);
  assert.match(
    domainSource,
    /rationale: boundedCanonicalOperationalFindingsConfidenceRationale\(\s*rationale,\s*"Confidence is limited by available restaurant evidence\.",\s*180\s*\)/
  );
  assert.doesNotMatch(domainSource, /rationale: boundedText\(rationale,/);

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
    /explanation: boundedText\(insight\.why_it_matters/
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
    /summary: boundedText\(\s*`\$\{recommendation\.item_name\}:/
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
  assert.doesNotMatch(identitySource, /operationalFindingsRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsUnmappedMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /pilotReadinessSaleItemIdentity/);

  assert.equal(canonicalOperationalFindingsConfidenceRationale(`  ${cleanRationale}  `), cleanRationale);
  assert.equal(
    canonicalOperationalFindingsConfidenceRationale(`\u00a0${cleanRationale}\u00a0`),
    cleanRationale
  );
  assert.equal(canonicalOperationalFindingsConfidenceRationale(accentedRationale), accentedRationale);

  const emPadded = `\u2003${cleanRationale}\u2003`;
  assert.equal(emPadded.trim().replace(/\s+/g, " "), cleanRationale);
  assert.equal(canonicalOperationalFindingsConfidenceRationale(emPadded), emPadded);
  assert.notEqual(canonicalOperationalFindingsConfidenceRationale(emPadded), cleanRationale);

  const midEm = "Current tenant inventory,\u2003a verified canonical unit";
  assert.equal(midEm.trim().replace(/\s+/g, " "), "Current tenant inventory, a verified canonical unit");
  assert.equal(canonicalOperationalFindingsConfidenceRationale(midEm), midEm);
  assert.notEqual(
    canonicalOperationalFindingsConfidenceRationale(midEm),
    "Current tenant inventory, a verified canonical unit"
  );

  assert.equal(
    boundedCanonicalOperationalFindingsConfidenceRationale(emPadded, rationaleFallback, 180),
    emPadded
  );
  assert.equal(
    boundedCanonicalOperationalFindingsConfidenceRationale("\u2003\u2003", rationaleFallback, 180),
    rationaleFallback
  );
  assert.equal(
    boundedCanonicalOperationalFindingsConfidenceRationale("   ", rationaleFallback, 180),
    rationaleFallback
  );
});

test("buildDailyOperationalBrief stores confidence rationale without Unicode-trim inventing path", () => {
  // Prior boundedConfidence Unicode-trimmed rationale before durable storage.
  // Call sites currently pass literals; prove the old contract invents on padding
  // and the brief still records the literal rationale through the pinned helper.
  const emPadded = `\u2003${cleanRationale}\u2003`;
  assert.equal(emPadded.trim().replace(/\s+/g, " "), cleanRationale);
  assert.notEqual(
    boundedCanonicalOperationalFindingsConfidenceRationale(emPadded, rationaleFallback, 180),
    cleanRationale
  );

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [recommendation],
    insights: [],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:recommendation:recommendation-chicken");
  assert.ok(finding);
  assert.equal(finding.confidence.rationale, cleanRationale);
  assert.notEqual(finding.confidence.rationale, emPadded);
});

test("insight confidence rationale stays on the pinned ASCII C path for fresh evidence", () => {
  const freshInsightRationale =
    "A deterministic Mise rule generated this finding from current restaurant evidence.";

  const brief = buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [],
    insights: [insight],
    inventoryLedgerEvents: [verifiedCount("2026-07-27T11:00:00.000Z")]
  });

  const finding = brief.findings.find((entry) => entry.id === "finding:insight:insight-cost");
  assert.ok(finding);
  assert.equal(finding.confidence.rationale, freshInsightRationale);
});

test("sibling title NBSP padding still invents under Unicode trim until tipped", () => {
  const paddedItemName = `\u00a0${item.item_name}\u00a0`;
  assert.equal(paddedItemName.trim().replace(/\s+/g, " "), item.item_name);

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
  assert.equal(finding.title, `Review ${item.item_name} coverage`);
  assert.equal(finding.confidence.rationale, cleanRationale);
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
  assert.equal(finding.confidence.rationale, cleanRationale);
});
