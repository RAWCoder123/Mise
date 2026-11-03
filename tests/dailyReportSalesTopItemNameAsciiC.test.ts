import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportSalesTopItemName,
  canonicalizeDailyReportSalesTopItemName,
  normalizeDailyReportSalesTopItemName
} from "../services/domain/presentationDailyReportSalesTopItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportSalesTopItemNameIdentity.ts",
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

test("MISE-005XC pins Daily Report sales top-sellers item.itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XC/);
  assert.match(dailyReportSource, /MISE-005XC/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportSalesTopItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportSalesTopItemNameIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportSalesTopItemName\(/);
  assert.match(
    dailyReportSource,
    /normalizeDailyReportSalesTopItemName\(item\.itemName\)\s*\|\|\s*\n?\s*t\("dailyReport\.sales\.topItem\.itemName\.none"\)/
  );

  assert.match(catalogSource, /"dailyReport\.sales\.topItem\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"dailyReport\.sales\.topItem\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"dailyReport\.sales\.topItem\.itemName\.none": "商品"/);

  // Leave sibling tips and waste/delivery/supplier paths alone.
  assert.doesNotMatch(dailyReportSource, /normalizeWasteItemName/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportWaste/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportDeliver/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportSupplier/);
  assert.doesNotMatch(dailyReportSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(dailyReportSource, /normalizeLogDeliveryHistoryItemName/);
  assert.doesNotMatch(identitySource, /presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryHistoryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave waste.topItem, deliveries.line, and supplier.supplierName raw interpolations alone.
  assert.match(
    dailyReportSource,
    /item:\s*visibleReport\.wasteAnalysis\.topItems\[0\]\.itemName/
  );
  assert.match(
    dailyReportSource,
    /item:\s*line\.itemName/
  );
  assert.match(
    dailyReportSource,
    /\{supplier\.supplierName\}/
  );
  // React list keys remain raw (not display chrome).
  assert.match(
    dailyReportSource,
    /key=\{`\$\{item\.itemName\}-\$\{item\.quantitySold\}`\}/
  );

  assert.equal(normalizeDailyReportSalesTopItemName(itemName), itemName);
  assert.equal(normalizeDailyReportSalesTopItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeDailyReportSalesTopItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report sales top-item names", () => {
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
  assert.equal(asciiTrimDailyReportSalesTopItemName(padded), padded);
  assert.equal(canonicalizeDailyReportSalesTopItemName(padded), null);
  assert.equal(canonicalizeDailyReportSalesTopItemName(nbspName), null);
  assert.equal(normalizeDailyReportSalesTopItemName(padded), null);
  assert.equal(normalizeDailyReportSalesTopItemName(nbspName), null);
  assert.equal(normalizeDailyReportSalesTopItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportSalesTopItemName(internalEm), internalEm);
  assert.equal(normalizeDailyReportSalesTopItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportSalesTopItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report sales top-item names", () => {
  assert.equal(normalizeDailyReportSalesTopItemName(undefined), null);
  assert.equal(normalizeDailyReportSalesTopItemName(null), null);
  assert.equal(normalizeDailyReportSalesTopItemName(""), null);
  assert.equal(normalizeDailyReportSalesTopItemName("   "), null);
  assert.equal(normalizeDailyReportSalesTopItemName(123 as unknown as string), null);
  assert.equal(normalizeDailyReportSalesTopItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportSalesTopItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeDailyReportSalesTopItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeDailyReportSalesTopItemName(em), null);
});

test("Daily Report sales top-item bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // into dailyReport.sales.topItemLine.
  assert.equal(normalizeDailyReportSalesTopItemName(""), null);
  assert.equal(normalizeDailyReportSalesTopItemName(em), null);
  assert.equal(normalizeDailyReportSalesTopItemName(nbsp), null);
  assert.match(
    dailyReportSource,
    /normalizeDailyReportSalesTopItemName\(item\.itemName\)\s*\|\|\s*\n?\s*t\("dailyReport\.sales\.topItem\.itemName\.none"\)/
  );
});

test("Daily Report sales top-item identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimDailyReportSalesTopItemName(padded), padded.trim());
  assert.equal(normalizeDailyReportSalesTopItemName(padded), null);
  assert.equal(normalizeDailyReportSalesTopItemName(`\t${itemName}\n`), itemName);
});
