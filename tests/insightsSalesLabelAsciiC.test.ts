import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSalesLabel,
  canonicalizeInsightsSalesLabel,
  normalizeInsightsSalesLabel
} from "../services/domain/insightsSalesLabelIdentity";
import { buildInsightsSalesAnalytics } from "../services/domain/insightsSalesAnalytics";
import type { PosSale } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/insightsSalesLabelIdentity.ts", import.meta.url),
  "utf8"
);
const analyticsSource = readFileSync(
  new URL("../services/domain/insightsSalesAnalytics.ts", import.meta.url),
  "utf8"
);

const itemName = "Chicken Bowl";
const category = "Mains";
const sourcePos = "square";

function sale(overrides: Partial<PosSale> & Pick<PosSale, "item_name" | "sale_date">): PosSale {
  return {
    id: overrides.id ?? `sale_${overrides.item_name}_${overrides.sale_date}`,
    restaurant_id: overrides.restaurant_id ?? "r1",
    sale_date: overrides.sale_date,
    item_name: overrides.item_name,
    category: overrides.category ?? category,
    quantity_sold: overrides.quantity_sold ?? 1,
    gross_sales: overrides.gross_sales ?? 10,
    net_sales: overrides.net_sales ?? 9,
    source_pos: overrides.source_pos ?? sourcePos,
    created_at: overrides.created_at ?? "2026-08-01T12:00:00.000Z"
  };
}

test("MISE-005QI pins Insights sales aggregation labels to ASCII C", () => {
  assert.match(identitySource, /MISE-005QI/);
  assert.match(analyticsSource, /MISE-005QI/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSalesLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(analyticsSource, /normalizeInsightsSalesLabel\(value\)/);
  assert.match(analyticsSource, /from "\.\/insightsSalesLabelIdentity"/);

  // Leave restaurant workspace and throughDate Unicode trim on existing contracts.
  assert.match(
    analyticsSource,
    /const restaurantId = input\.restaurantId\.trim\(\);/
  );
  assert.match(
    analyticsSource,
    /input\.throughDate\?\.trim\(\)/
  );

  // Do not rewrite sibling Insights restaurant / demand-key tips.
  assert.doesNotMatch(identitySource, /insightsSalesAnalyticsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /saleDemandKey/);
  assert.doesNotMatch(identitySource, /from "\.\/operationalSignals"/);
  assert.doesNotMatch(analyticsSource, /insightsSalesAnalyticsRestaurantIdentity/);
  assert.doesNotMatch(analyticsSource, /from "\.\/operationalSignals"/);
});

test("ASCII trim keeps ordinary Insights sales label padding stable", () => {
  assert.equal(asciiTrimInsightsSalesLabel(`  ${itemName}  `), itemName);
  assert.equal(canonicalizeInsightsSalesLabel(`\t${itemName}\n`), itemName);
  assert.equal(normalizeInsightsSalesLabel(`  ${itemName}  `), itemName);
  assert.equal(normalizeInsightsSalesLabel(`  ${category}  `), category);
  assert.equal(normalizeInsightsSalesLabel(`\t${sourcePos}\n`), sourcePos);

  const analytics = buildInsightsSalesAnalytics({
    restaurantId: "r1",
    throughDate: "2026-08-01",
    lookbackDays: 1,
    sales: [
      sale({ item_name: `  ${itemName}  `, category: `  ${category}  `, sale_date: "2026-08-01" }),
      sale({
        id: "sale_clean",
        item_name: itemName,
        category,
        quantity_sold: 2,
        gross_sales: 20,
        sale_date: "2026-08-01"
      })
    ]
  });

  assert.equal(analytics.bestSellers.length, 1);
  assert.equal(analytics.bestSellers[0]?.itemName, itemName);
  assert.equal(analytics.bestSellers[0]?.quantity, 3);
  assert.equal(analytics.categoryMix[0]?.label, category);
  assert.equal(analytics.sourceMix[0]?.label, sourcePos);
});

test("NBSP and em-space padding cannot invent Insights sales aggregation labels", () => {
  const nbspItem = `\u00a0${itemName}\u00a0`;
  const emItem = `\u2003${itemName}\u2003`;
  const nbspCategory = `\u00a0${category}\u00a0`;
  const emSource = `\u2003${sourcePos}\u2003`;

  assert.equal(nbspItem.trim(), itemName);
  assert.equal(emItem.trim(), itemName);
  assert.equal(nbspCategory.trim(), category);
  assert.equal(emSource.trim(), sourcePos);

  assert.equal(canonicalizeInsightsSalesLabel(nbspItem), null);
  assert.equal(canonicalizeInsightsSalesLabel(emItem), null);
  assert.equal(normalizeInsightsSalesLabel(nbspItem), "");
  assert.equal(normalizeInsightsSalesLabel(emItem), "");
  assert.equal(normalizeInsightsSalesLabel(nbspCategory), "");
  assert.equal(normalizeInsightsSalesLabel(emSource), "");

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness.
  assert.equal(normalizeInsightsSalesLabel("\u2003\u2003"), "");
  assert.equal(normalizeInsightsSalesLabel("\u00a0\u00a0"), "");

  const analytics = buildInsightsSalesAnalytics({
    restaurantId: "r1",
    throughDate: "2026-08-01",
    lookbackDays: 1,
    sales: [
      sale({
        id: "sale_nbsp",
        item_name: nbspItem,
        category: nbspCategory,
        source_pos: emSource,
        quantity_sold: 4,
        gross_sales: 40,
        sale_date: "2026-08-01"
      }),
      sale({
        id: "sale_clean",
        item_name: itemName,
        category,
        source_pos: sourcePos,
        quantity_sold: 1,
        gross_sales: 10,
        sale_date: "2026-08-01"
      })
    ]
  });

  // Unicode-padded labels must not invent equality with the clean keys.
  assert.equal(analytics.bestSellers.length, 2);
  assert.equal(analytics.bestSellers[0]?.itemName, "Item");
  assert.equal(analytics.bestSellers[0]?.quantity, 4);
  assert.equal(analytics.bestSellers[1]?.itemName, itemName);
  assert.equal(analytics.bestSellers[1]?.quantity, 1);

  assert.equal(analytics.categoryMix.length, 2);
  assert.equal(analytics.categoryMix[0]?.label, "Uncategorized");
  assert.equal(analytics.categoryMix[1]?.label, category);

  assert.equal(analytics.sourceMix.length, 2);
  assert.equal(analytics.sourceMix[0]?.label, "POS");
  assert.equal(analytics.sourceMix[1]?.label, sourcePos);
});

test("Control and non-string Insights sales labels soft-fail without inventing", () => {
  assert.equal(normalizeInsightsSalesLabel(null), "");
  assert.equal(normalizeInsightsSalesLabel(undefined), "");
  assert.equal(normalizeInsightsSalesLabel(12), "");
  assert.equal(normalizeInsightsSalesLabel(`${itemName}\u0000`), "");
  assert.equal(canonicalizeInsightsSalesLabel(`${itemName}\u0007`), null);

  const analytics = buildInsightsSalesAnalytics({
    restaurantId: "r1",
    throughDate: "2026-08-01",
    lookbackDays: 1,
    sales: [
      sale({
        id: "sale_control",
        item_name: `${itemName}\u0000`,
        category: `${category}\u0007`,
        source_pos: `${sourcePos}\u001f`,
        quantity_sold: 3,
        gross_sales: 30,
        sale_date: "2026-08-01"
      })
    ]
  });

  assert.equal(analytics.bestSellers[0]?.itemName, "Item");
  assert.equal(analytics.categoryMix[0]?.label, "Uncategorized");
  assert.equal(analytics.sourceMix[0]?.label, "POS");
});
