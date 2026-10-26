import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSalesThroughDate,
  canonicalizeInsightsSalesThroughDate,
  normalizeInsightsSalesThroughDate
} from "../services/domain/insightsSalesThroughDateIdentity";
import { buildInsightsSalesAnalytics } from "../services/domain/insightsSalesAnalytics";
import type { PosSale } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/insightsSalesThroughDateIdentity.ts", import.meta.url),
  "utf8"
);
const analyticsSource = readFileSync(
  new URL("../services/domain/insightsSalesAnalytics.ts", import.meta.url),
  "utf8"
);

const throughDate = "2026-08-01";
const em = "\u2003";
const nbsp = "\u00a0";

function sale(overrides: Partial<PosSale> & Pick<PosSale, "item_name" | "sale_date">): PosSale {
  return {
    id: overrides.id ?? `sale_${overrides.item_name}_${overrides.sale_date}`,
    restaurant_id: overrides.restaurant_id ?? "r1",
    sale_date: overrides.sale_date,
    item_name: overrides.item_name,
    category: overrides.category ?? "Mains",
    quantity_sold: overrides.quantity_sold ?? 1,
    gross_sales: overrides.gross_sales ?? 10,
    net_sales: overrides.net_sales ?? 9,
    source_pos: overrides.source_pos ?? "square",
    created_at: overrides.created_at ?? "2026-08-01T12:00:00.000Z"
  };
}

test("MISE-005QJ pins Insights sales throughDate to ASCII C", () => {
  assert.match(identitySource, /MISE-005QJ/);
  assert.match(analyticsSource, /MISE-005QJ/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSalesThroughDate\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    analyticsSource,
    /normalizeInsightsSalesThroughDate\(input\.throughDate\)/
  );
  assert.match(analyticsSource, /from "\.\/insightsSalesThroughDateIdentity"/);

  // Leave restaurant workspace and aggregation-label Unicode trim on existing
  // contracts (#781 / #869 own those surfaces when landed).
  assert.match(
    analyticsSource,
    /const restaurantId = input\.restaurantId\.trim\(\);/
  );
  assert.match(
    analyticsSource,
    /\(value \?\? ""\)\.trim\(\)\.replace\(\/\\s\+\/g, " "\)/
  );
  assert.doesNotMatch(analyticsSource, /input\.throughDate\?\.trim\(\)/);

  // Do not rewrite sibling Insights restaurant / label / purchase-line tips.
  assert.doesNotMatch(identitySource, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesAnalyticsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineIsoDateIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/operationalSignals"/);
  assert.doesNotMatch(analyticsSource, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(analyticsSource, /purchaseLineIsoDateIdentity/);
});

test("ASCII C prep keeps ordinary Insights sales throughDate padding stable", () => {
  assert.equal(asciiTrimInsightsSalesThroughDate(`  ${throughDate}  `), throughDate);
  assert.equal(asciiTrimInsightsSalesThroughDate(`\t${throughDate}\n`), throughDate);
  assert.equal(canonicalizeInsightsSalesThroughDate(`  ${throughDate}  `), throughDate);
  assert.equal(normalizeInsightsSalesThroughDate(`  ${throughDate}  `), throughDate);
  assert.equal(normalizeInsightsSalesThroughDate(null), null);
  assert.equal(normalizeInsightsSalesThroughDate(undefined), null);
  assert.equal(normalizeInsightsSalesThroughDate(""), null);
  assert.equal(normalizeInsightsSalesThroughDate("   "), null);

  const analytics = buildInsightsSalesAnalytics({
    restaurantId: "r1",
    throughDate: `  ${throughDate}  `,
    lookbackDays: 1,
    sales: [
      sale({ item_name: "Chicken Bowl", sale_date: throughDate, quantity_sold: 2, gross_sales: 20 }),
      sale({
        id: "sale_outside",
        item_name: "Iced Tea",
        sale_date: "2026-07-31",
        quantity_sold: 9,
        gross_sales: 90
      })
    ]
  });

  assert.equal(analytics.throughDate, throughDate);
  assert.equal(analytics.windowStart, throughDate);
  assert.equal(analytics.totalUnits, 2);
  assert.deepEqual(
    analytics.unitsTrend.map((point) => [point.date, point.units]),
    [[throughDate, 2]]
  );
});

test("NBSP and em-space padding cannot invent Insights sales throughDate", () => {
  const padded = `${em}${throughDate}${em}`;
  const nbspPadded = `${nbsp}${throughDate}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean calendar-window end.
  assert.equal(padded.trim(), throughDate);
  assert.equal(nbspPadded.trim(), throughDate);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsSalesThroughDate(padded), padded);
  assert.equal(canonicalizeInsightsSalesThroughDate(padded), null);
  assert.equal(canonicalizeInsightsSalesThroughDate(nbspPadded), null);
  assert.equal(normalizeInsightsSalesThroughDate(padded), null);
  assert.equal(normalizeInsightsSalesThroughDate(nbspPadded), null);
  assert.equal(normalizeInsightsSalesThroughDate("not-a-date"), null);
  assert.equal(normalizeInsightsSalesThroughDate("2026-13-40"), null);

  // Soft null falls through to latestSaleDate like prior empty `.trim()`.
  const analytics = buildInsightsSalesAnalytics({
    restaurantId: "r1",
    throughDate: padded,
    lookbackDays: 1,
    sales: [
      sale({ item_name: "Chicken Bowl", sale_date: "2026-08-03", quantity_sold: 3, gross_sales: 30 }),
      sale({
        id: "sale_older",
        item_name: "Soup",
        sale_date: "2026-08-01",
        quantity_sold: 1,
        gross_sales: 10
      })
    ]
  });

  assert.equal(analytics.throughDate, "2026-08-03");
  assert.equal(analytics.windowStart, "2026-08-03");
  assert.equal(analytics.totalUnits, 3);
});

test("ASCII-only empty and control throughDate soft-fall through without inventing", () => {
  assert.equal(normalizeInsightsSalesThroughDate(`${em}${em}`), null);
  assert.equal(normalizeInsightsSalesThroughDate(`${nbsp}`), null);
  assert.equal(normalizeInsightsSalesThroughDate(`\u0000${throughDate}`), null);
  assert.equal(normalizeInsightsSalesThroughDate(`${throughDate}\u007f`), null);

  const analytics = buildInsightsSalesAnalytics({
    restaurantId: "r1",
    throughDate: `${em}${em}`,
    lookbackDays: 2,
    sales: [
      sale({ item_name: "Soup", sale_date: "2026-08-02", quantity_sold: 4, gross_sales: 40 }),
      sale({
        id: "sale_day_before",
        item_name: "Soup",
        sale_date: "2026-08-01",
        quantity_sold: 1,
        gross_sales: 10
      })
    ]
  });

  assert.equal(analytics.throughDate, "2026-08-02");
  assert.equal(analytics.windowStart, "2026-08-01");
  assert.equal(analytics.totalUnits, 5);
});
