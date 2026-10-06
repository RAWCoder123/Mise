import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import type { VerifiedProviderSaleMapping } from "../services/domain/providerSaleIdentity";

const domainSource = readFileSync(
  new URL("../services/domain/operationalSignals.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-signals";
const operatingDate = "2026-10-06";
const menuItemId = "menu-chicken-bowl";
const inventoryItemId = "inv-chicken";

/** Ten service days before the operating date — enough for historicalDailyDemand. */
const historyDates = [
  "2026-09-26",
  "2026-09-27",
  "2026-09-28",
  "2026-09-29",
  "2026-09-30",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05"
];

function manualSale(itemName: string, saleDate: string, quantity: number) {
  return {
    restaurant_id: restaurantId,
    sale_date: saleDate,
    item_name: itemName,
    quantity_sold: quantity,
    source_pos: "manual" as const
  };
}

function providerSale(
  saleDate: string,
  quantity: number,
  overrides: Partial<{
    item_name: string;
    provider_location_id: string;
    provider_catalog_item_id: string;
    provider_variation_id: string;
  }> = {}
) {
  return {
    restaurant_id: restaurantId,
    sale_date: saleDate,
    item_name: overrides.item_name ?? "Chicken Bowl",
    quantity_sold: quantity,
    source_pos: "square",
    provider_location_id: overrides.provider_location_id ?? "loc-1",
    provider_catalog_item_id: overrides.provider_catalog_item_id ?? "cat-1",
    provider_variation_id: overrides.provider_variation_id ?? "var-1"
  };
}

const providerMappings: VerifiedProviderSaleMapping[] = [
  {
    restaurantId,
    sourcePos: "square",
    providerLocationId: "loc-1",
    externalCatalogItemId: "cat-1",
    externalVariationId: "var-1",
    menuItemId
  }
];

const inventoryItems = [
  {
    id: inventoryItemId,
    restaurant_id: restaurantId,
    item_name: "Chicken breast",
    supplier_id: "supplier-1",
    supplier_name: "North Market",
    unit: "lb",
    current_quantity: 40,
    par_level: 20,
    reorder_threshold: 8
  }
];

const mappings = [
  {
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    menu_item_name: "Chicken Bowl",
    inventory_item_id: inventoryItemId,
    quantity_used_per_sale: 0.5,
    unit: "lb"
  }
];

test("MISE-005JH pins operationalSignals demand-spike identity to ASCII C + saleDemandKey", () => {
  assert.match(domainSource, /MISE-005JH/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  assert.match(domainSource, /saleDemandKey\(sale, providerMappings\)/);
  assert.match(domainSource, /insightDemandSlug\(demandKey\)/);
  assert.doesNotMatch(
    domainSource,
    /demand\.get\(normalizeKey\(sale\.item_name\)\)/
  );
  assert.doesNotMatch(
    domainSource,
    /insight_spike_\$\{normalizeKey/
  );

  const slugBody = domainSource.slice(
    domainSource.indexOf("function insightDemandSlug("),
    domainSource.indexOf("function round(")
  );
  assert.match(slugBody, /asciiCNormalizeToken\(demandKey\)/);
  assert.doesNotMatch(slugBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(slugBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(slugBody, /\.trim\(\)/);
});

test("manual demand spikes keep Kelvin-sign names distinct under ASCII C", () => {
  const sales = [
    ...historyDates.map((date) => manualSale("Chicken Bowl", date, 5)),
    ...historyDates.map((date) =>
      // Unicode toLowerCase would fold K → k and share Chicken Bowl's baseline.
      manualSale("Khicken Bowl", date, 5)
    ),
    manualSale("Chicken Bowl", operatingDate, 20),
    // Stay under the 1.2x spike threshold for Kelvin's own baseline so a
    // distinct ASCII-C (or Unicode khicken) key must not invent a second spike.
    manualSale("Khicken Bowl", operatingDate, 5)
  ];

  const { insights } = calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems,
    sales,
    menuItemIngredients: mappings.map(({ menu_item_id: _menuItemId, ...rest }) => rest),
    recommendationHistory: [],
    ledgerComplete: true
  });

  const spikes = insights.filter((insight) => insight.id.startsWith("insight_spike_"));
  assert.equal(spikes.length, 1);
  assert.equal(spikes[0]?.title, "Chicken Bowl demand is rising");
  assert.ok(!spikes.some((insight) => insight.title.includes("K")));
  // Unicode fold would produce insight_spike_chicken_bowl for Kelvin too.
  assert.equal(spikes[0]?.id, "insight_spike_chicken_bowl");
});

test("provider-mapped sales look up spike baselines by saleDemandKey menu identity", () => {
  const sales = [
    ...historyDates.map((date, index) =>
      providerSale(date, 4, {
        // Historical display name drift must not break menu:id demand keys.
        item_name: index % 2 === 0 ? "Chicken Bowl" : "CHICKEN BOWL (LUNCH)"
      })
    ),
    providerSale(operatingDate, 12, { item_name: "Chicken Bowl Special" })
  ];

  const { insights } = calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems,
    sales,
    menuItemIngredients: mappings,
    providerMappings,
    recommendationHistory: [],
    ledgerComplete: true
  });

  const spike = insights.find((insight) => insight.id.startsWith("insight_spike_"));
  assert.ok(spike, "expected a demand-rising insight for the verified provider sale");
  assert.equal(spike.title, "Chicken Bowl Special demand is rising");
  assert.match(spike.id, /insight_spike_menu_menu_chicken_bowl/);
  assert.equal(
    "liftPercent" in spike.presentation.values
      ? spike.presentation.values.liftPercent
      : undefined,
    200
  );
});
