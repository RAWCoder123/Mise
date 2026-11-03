import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportDeliveriesLineItemName,
  canonicalizeDailyReportDeliveriesLineItemName,
  normalizeDailyReportDeliveriesLineItemName
} from "../services/domain/presentationDailyReportDeliveriesLineItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportDeliveriesLineItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const dailyReportSource = readFileSync(
  new URL("../app/more/daily-report.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XE pins Daily Report deliveries.line itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XE/);
  assert.match(dailyReportSource, /MISE-005XE/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportDeliveriesLineItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportDeliveriesLineItemNameIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportDeliveriesLineItemName\(/);
  assert.match(
    dailyReportSource,
    /normalizeDailyReportDeliveriesLineItemName\(line\.itemName\)\s*\|\|\s*\n?\s*t\("dailyReport\.deliveries\.line\.itemName\.none"\)/
  );

  assert.match(catalogSource, /"dailyReport\.deliveries\.line\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"dailyReport\.deliveries\.line\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"dailyReport\.deliveries\.line\.itemName\.none": "商品"/);

  // Leave sibling tips alone.
  assert.doesNotMatch(dailyReportSource, /normalizeWasteItemName/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportWaste/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportSales/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportSupplier/);
  assert.doesNotMatch(dailyReportSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(dailyReportSource, /normalizeLogDeliveryHistoryItemName/);
  assert.doesNotMatch(identitySource, /presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryHistoryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportSalesTopItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportWasteTopItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave waste.topItem and sales top-sellers raw interpolations alone on main.
  assert.match(
    dailyReportSource,
    /item:\s*visibleReport\.wasteAnalysis\.topItems\[0\]\.itemName/
  );
  assert.match(
    dailyReportSource,
    /item:\s*item\.itemName/
  );
  // React list keys remain raw (not display chrome).
  assert.match(
    dailyReportSource,
    /key=\{line\.id\}/
  );

  assert.equal(normalizeDailyReportDeliveriesLineItemName(itemName), itemName);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeDailyReportDeliveriesLineItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report deliveries line item names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Roma${em}Tomatoes`;
  const internalNbsp = `Roma${nbsp}Tomatoes`;

  // Inventing proof: Unicode trim would invent the clean item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportDeliveriesLineItemName(padded), padded);
  assert.equal(canonicalizeDailyReportDeliveriesLineItemName(padded), null);
  assert.equal(canonicalizeDailyReportDeliveriesLineItemName(nbspName), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(padded), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(nbspName), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportDeliveriesLineItemName(internalEm), internalEm);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report deliveries line item names", () => {
  assert.equal(normalizeDailyReportDeliveriesLineItemName(undefined), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(null), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(""), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName("   "), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(123 as unknown as string), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportDeliveriesLineItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(em), null);
});

test("Daily Report deliveries.line bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // into dailyReport.deliveries.line.
  assert.equal(normalizeDailyReportDeliveriesLineItemName(""), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(em), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(nbsp), null);
  assert.match(
    dailyReportSource,
    /normalizeDailyReportDeliveriesLineItemName\(line\.itemName\)\s*\|\|\s*\n?\s*t\("dailyReport\.deliveries\.line\.itemName\.none"\)/
  );
});

test("Daily Report deliveries.line identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimDailyReportDeliveriesLineItemName(padded), padded.trim());
  assert.equal(normalizeDailyReportDeliveriesLineItemName(padded), null);
  assert.equal(normalizeDailyReportDeliveriesLineItemName(`\t${itemName}\n`), itemName);
});
