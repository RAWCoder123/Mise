import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildInsightsFromData } from "../services/domain/miseDomain";

const domainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-insight-slug";
const operatingDate = "2026-10-07";
const inventoryItemId = "inv-chicken";

const inventoryItems = [
  {
    id: inventoryItemId,
    restaurant_id: restaurantId,
    item_name: "Chicken breast",
    category: "protein",
    supplier_id: "supplier-1",
    supplier_name: "North Market",
    unit: "lb",
    current_quantity: 2,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 3.7,
    last_updated: `${operatingDate}T12:00:00.000Z`
  }
];

function todaySale(itemName: string, quantity: number) {
  return {
    id: `sale-${itemName}`,
    restaurant_id: restaurantId,
    sale_date: operatingDate,
    item_name: itemName,
    category: "entree",
    quantity_sold: quantity,
    gross_sales: quantity * 12,
    net_sales: quantity * 11,
    source_pos: "manual",
    created_at: `${operatingDate}T12:00:00.000Z`
  };
}

/** Constant demand fallback so today lift is deterministic without historical rows. */
function demandFallback(_itemName: string) {
  return 10;
}

test("MISE-005KI pins miseDomain spike/prep insight demand slugs to ASCII C", () => {
  assert.match(domainSource, /MISE-005KI/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(domainSource, /insightDemandSlug\(sale\.item_name\)/);
  assert.match(domainSource, /insightDemandSlug\(topSale\.item_name\)/);
  assert.doesNotMatch(
    domainSource,
    /insight_spike_\$\{sale\.item_name\.replace\(\/\\s\+\/g, "_"\)\.toLowerCase\(\)\}/
  );
  assert.doesNotMatch(
    domainSource,
    /insight_prep_\$\{topSale\.item_name\.replace\(\/\\s\+\/g, "_"\)\.toLowerCase\(\)\}/
  );

  const slugBody = domainSource.slice(
    domainSource.indexOf("function insightDemandSlug("),
    domainSource.indexOf("export function recommendationReason(")
  );
  assert.match(slugBody, /asciiCNormalizeToken\(value\)/);
  assert.doesNotMatch(slugBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(slugBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(slugBody, /\.trim\(\)/);
});

test("demand-spike insight ids keep Kelvin-sign names distinct under ASCII C", () => {
  const kelvinChicken = "chic\u212Aen Bowl";
  const insights = buildInsightsFromData(
    restaurantId,
    inventoryItems,
    [todaySale("Chicken Bowl", 20), todaySale(kelvinChicken, 20)],
    [],
    operatingDate,
    demandFallback
  );

  const spikes = insights.filter((insight) => insight.id.startsWith("insight_spike_"));
  assert.equal(spikes.length, 2);

  const chickenSpike = spikes.find((insight) => insight.title === "Chicken Bowl demand is rising");
  const kelvinSpike = spikes.find((insight) => insight.title === `${kelvinChicken} demand is rising`);
  assert.ok(chickenSpike, "expected ASCII chicken demand-rising insight");
  assert.ok(kelvinSpike, "expected Kelvin lookalike demand-rising insight");

  // Unicode toLowerCase would invent insight_spike_chicken_bowl for both.
  assert.equal(chickenSpike.id, "insight_spike_chicken_bowl");
  assert.equal(kelvinSpike.id, "insight_spike_chic_en_bowl");
  assert.notEqual(chickenSpike.id, kelvinSpike.id);
});

test("prep insight ids keep Kelvin-sign top sellers distinct under ASCII C", () => {
  const kelvinChicken = "chic\u212Aen Bowl";
  const mappings = [
    {
      id: "mapping-kelvin-chicken",
      restaurant_id: restaurantId,
      menu_item_name: kelvinChicken,
      inventory_item_id: inventoryItemId,
      quantity_used_per_sale: 0.5,
      unit: "lb"
    }
  ];

  const insights = buildInsightsFromData(
    restaurantId,
    inventoryItems,
    [todaySale(kelvinChicken, 20)],
    mappings,
    operatingDate,
    demandFallback
  );

  const prep = insights.find((insight) => insight.id.startsWith("insight_prep_"));
  assert.ok(prep, "expected a prep insight for the Kelvin top seller linked to low stock");
  // Unicode fold would invent insight_prep_chicken_bowl.
  assert.equal(prep.id, "insight_prep_chic_en_bowl");
  assert.notEqual(prep.id, "insight_prep_chicken_bowl");
  assert.equal(prep.title, `${kelvinChicken} depends on low stock`);
});
