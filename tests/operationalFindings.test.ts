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
import {
  BETA_FINDING_POLICY_VERSION,
  buildDailyOperationalBrief
} from "../services/domain/operationalFindings";

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const generatedAt = "2026-07-27T12:00:00.000Z";

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

function build(overrides = {}) {
  return buildDailyOperationalBrief({
    restaurantId,
    operatingDate: "2026-07-27",
    generatedAt,
    sales: [sale],
    inventoryItems: [item],
    mappings: [mapping],
    recommendations: [recommendation],
    insights: [insight],
    ...overrides
  });
}

test("daily brief prioritizes deterministic tenant evidence into Now, Up next, and Later", () => {
  const unmappedSale: PosSale = {
    ...sale,
    id: "sale-unmapped",
    source_record_id: "csv-2",
    item_name: "Seasonal Soup"
  };
  const brief = build({ sales: [sale, unmappedSale] });

  assert.equal(brief.policyVersion, BETA_FINDING_POLICY_VERSION);
  assert.equal(brief.findings[0]?.id, `finding:recommendation:${recommendation.id}`);
  assert.deepEqual(brief.priorities.now, [`finding:recommendation:${recommendation.id}`]);
  assert.ok(brief.priorities.upNext.includes("finding:data-gap:mapping:2026-07-27"));
  assert.ok(brief.priorities.later.includes(`finding:insight:${insight.id}`));
  assert.equal(brief.findings.every((finding) => finding.restaurantId === restaurantId), true);
  assert.equal(brief.findings.every((finding) => finding.evidence.length <= 5), true);
  assert.equal(
    brief.findings.every((finding) => finding.confidence.score >= 0 && finding.confidence.score <= 1),
    true
  );
});

test("complete verified evidence produces a fresh high-confidence recommendation without sending", () => {
  const brief = build();
  const finding = brief.findings.find((entry) => entry.id === `finding:recommendation:${recommendation.id}`);

  assert.ok(finding);
  assert.equal(finding.freshness.state, "fresh");
  assert.equal(finding.confidence.score, 0.92);
  assert.deepEqual(finding.freshness.missingData, []);
  assert.match(finding.recommendedAction, /Review 38 lb/);
  assert.doesNotMatch(finding.recommendedAction, /\bsend\b/i);
});

test("stale evidence remains visible but cannot be labeled fresh", () => {
  const staleItem = { ...item, last_updated: "2026-07-20T11:00:00.000Z" };
  const brief = build({ inventoryItems: [staleItem] });
  const finding = brief.findings.find((entry) => entry.id === `finding:recommendation:${recommendation.id}`);

  assert.ok(finding);
  assert.equal(finding.freshness.state, "stale");
  assert.equal(finding.confidence.score, 0.55);
  assert.ok(Date.parse(finding.freshness.staleAfter) < Date.parse(generatedAt));
});

test("missing daily sales and inventory become explicit high-confidence data gaps", () => {
  const brief = build({
    sales: [],
    inventoryItems: [],
    mappings: [],
    recommendations: [],
    insights: []
  });

  assert.deepEqual(
    brief.priorities.now,
    [
      "finding:data-gap:inventory:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "finding:data-gap:sales:2026-07-27"
    ]
  );
  assert.equal(brief.findings.every((finding) => finding.freshness.state === "incomplete"), true);
  assert.equal(brief.findings.every((finding) => finding.confidence.score === 1), true);
});

test("mixed-tenant input fails closed before any finding can reference it", () => {
  assert.throws(
    () => build({ sales: [{ ...sale, restaurant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }] }),
    /failed restaurant scope validation/
  );
});

test("daily brief stays bounded and deterministic under noisy rule output", () => {
  const insights = Array.from({ length: 30 }, (_, index): Insight => ({
    ...insight,
    id: `insight-${index.toString().padStart(2, "0")}`,
    title: `Finding ${index}`
  }));
  const first = build({ insights });
  const second = build({ insights: [...insights].reverse() });

  assert.equal(first.findings.length, 12);
  assert.deepEqual(first, second);
});

test("screen-facing daily brief stays behind miseService and has no AI or mutation dependency", () => {
  const facade = readFileSync("services/miseService.ts", "utf8");
  const application = readFileSync("services/application/findings.ts", "utf8");
  const domain = readFileSync("services/domain/operationalFindings.ts", "utf8");

  assert.match(facade, /export \* from "\.\/application\/findings"/);
  assert.match(application, /repository\.fetchRestaurantData/);
  assert.match(application, /toDateKeyInTimeZone/);
  assert.doesNotMatch(application, /fetchPlanningData/);
  assert.doesNotMatch(application, /create|insert|update|delete|sendSupplier/i);
  assert.doesNotMatch(domain, /services\/ai|openai|generate-ai/i);
});
