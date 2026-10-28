import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  InventoryItem,
  MenuItemIngredient,
  PosSale
} from "../types/mise";
import { buildDailyOperationalBrief } from "../services/domain/operationalFindings";
import {
  boundedCanonicalOperationalFindingsUnmappedMenuItemName,
  canonicalOperationalFindingsUnmappedMenuItemName
} from "../services/domain/operationalFindingsUnmappedMenuItemNameIdentity";
import type { VerifiedCountCandidate } from "../services/domain/inventoryCountAuthority";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingsUnmappedMenuItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const generatedAt = "2026-07-27T12:00:00.000Z";
const supplierId = "10000000-0000-4000-8000-000000000012";
const cleanName = "Salmon Bowl";
const accentedName = "Bowl de Salmón";

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

function verifiedCount(effectiveAt: string): VerifiedCountCandidate {
  return {
    restaurantId,
    inventoryItemId: item.id,
    effectiveAt,
    eventType: "count",
    sequence: 1
  };
}

test("MISE-005SL pins operational-findings unmapped menu-item names to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005SL/);
  assert.match(domainSource, /MISE-005SL/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperationalFindingsUnmappedMenuItemName("),
    identitySource.indexOf("export function boundedCanonicalOperationalFindingsUnmappedMenuItemName(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(domainSource, /from "\.\/operationalFindingsUnmappedMenuItemNameIdentity"/);
  assert.match(
    domainSource,
    /boundedCanonicalOperationalFindingsUnmappedMenuItemName\(sale\.item_name, "menu item", 80\)/
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
    /rationale: boundedText\(rationale,/
  );

  // Leave restaurant workspace on Unicode trim in this tip (#755 owns that path).
  assert.match(domainSource, /const restaurantId = input\.restaurantId\.trim\(\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /operationalFindingsTitleIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsExplanationIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingEvidenceSummaryIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingRecommendedActionIdentity/);
  assert.doesNotMatch(identitySource, /pilotReadinessSaleItemIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksTitleIdentity/);

  assert.equal(canonicalOperationalFindingsUnmappedMenuItemName(`  ${cleanName}  `), cleanName);
  assert.equal(canonicalOperationalFindingsUnmappedMenuItemName(`\u00a0${cleanName}\u00a0`), cleanName);
  assert.equal(canonicalOperationalFindingsUnmappedMenuItemName(accentedName), accentedName);

  const emPadded = `\u2003${cleanName}\u2003`;
  assert.equal(emPadded.trim().replace(/\s+/g, " "), cleanName);
  assert.equal(canonicalOperationalFindingsUnmappedMenuItemName(emPadded), emPadded);
  assert.notEqual(canonicalOperationalFindingsUnmappedMenuItemName(emPadded), cleanName);

  assert.equal(
    boundedCanonicalOperationalFindingsUnmappedMenuItemName(emPadded, "menu item", 80),
    emPadded
  );
  assert.equal(
    boundedCanonicalOperationalFindingsUnmappedMenuItemName("\u2003\u2003", "menu item", 80),
    "menu item"
  );
  assert.equal(
    boundedCanonicalOperationalFindingsUnmappedMenuItemName("   ", "menu item", 80),
    "menu item"
  );
});

test("buildDailyOperationalBrief no longer invents clean unmapped menu-item names from em-space padding", () => {
  const paddedName = `\u2003${cleanName}\u2003`;
  assert.equal(paddedName.trim().replace(/\s+/g, " "), cleanName);

  const unmappedSale: PosSale = {
    ...sale,
    id: "sale-unmapped",
    item_name: paddedName,
    source_record_id: "csv-unmapped"
  };

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
  assert.ok(finding.freshness.missingData.includes(`menu_mapping:${paddedName}`));
  assert.ok(!finding.freshness.missingData.includes(`menu_mapping:${cleanName}`));
});

test("unmapped menu-item names keep mid-string em-spaces instead of inventing ASCII-collapsed keys", () => {
  const midPaddedName = `Salmon\u2003Bowl`;
  const unicodeInvented = midPaddedName.trim().replace(/\s+/g, " ");
  assert.equal(unicodeInvented, "Salmon Bowl");
  assert.notEqual(unicodeInvented, midPaddedName);

  const unmappedSale: PosSale = {
    ...sale,
    id: "sale-unmapped-mid",
    item_name: midPaddedName,
    source_record_id: "csv-unmapped-mid"
  };

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
  assert.ok(finding.freshness.missingData.includes(`menu_mapping:${midPaddedName}`));
  assert.ok(!finding.freshness.missingData.includes(`menu_mapping:${unicodeInvented}`));
});

test("soft-empty unmapped menu-item names fall back instead of inventing a clean key", () => {
  const unmappedSale: PosSale = {
    ...sale,
    id: "sale-unmapped-empty",
    item_name: "\u2003\u2003",
    source_record_id: "csv-unmapped-empty"
  };

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
  assert.ok(finding.freshness.missingData.includes("menu_mapping:menu item"));
});

test("sibling unmapped-sale evidence summary em-space padding still invents under Unicode trim until tipped", () => {
  const paddedName = `\u2003${cleanName}\u2003`;
  assert.equal(paddedName.trim().replace(/\s+/g, " "), cleanName);
  const expectedSummary = `${paddedName}: ${sale.quantity_sold} sold without a recipe mapping`;
  const unicodeInventedSummary = expectedSummary.trim().replace(/\s+/g, " ");
  assert.notEqual(unicodeInventedSummary, expectedSummary);
  assert.match(unicodeInventedSummary, /Salmon Bowl : 20 sold/);

  const unmappedSale: PosSale = {
    ...sale,
    id: "sale-unmapped-summary-sibling",
    item_name: paddedName,
    source_record_id: "csv-unmapped-summary-sibling"
  };

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
  // This tip owns missingData name tokens only; evidence summary remains on Unicode trim (#923).
  const saleEvidence = finding.evidence.find((entry) => entry.id === unmappedSale.id);
  assert.ok(saleEvidence);
  assert.equal(saleEvidence.summary, unicodeInventedSummary);
  assert.ok(finding.freshness.missingData.includes(`menu_mapping:${paddedName}`));
});
