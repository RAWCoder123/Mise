import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportWasteTopItemName,
  canonicalizeDailyReportWasteTopItemName,
  normalizeDailyReportWasteTopItemName
} from "../services/domain/presentationDailyReportWasteTopItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportWasteTopItemNameIdentity.ts",
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

test("MISE-005XD pins Daily Report waste.topItem itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XD/);
  assert.match(dailyReportSource, /MISE-005XD/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportWasteTopItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportWasteTopItemNameIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportWasteTopItemName\(/);
  assert.match(
    dailyReportSource,
    /normalizeDailyReportWasteTopItemName\(\s*visibleReport\.wasteAnalysis\.topItems\[0\]\.itemName\s*\)\s*\|\|\s*\n?\s*t\("dailyReport\.waste\.topItem\.itemName\.none"\)/
  );

  assert.match(catalogSource, /"dailyReport\.waste\.topItem\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"dailyReport\.waste\.topItem\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"dailyReport\.waste\.topItem\.itemName\.none": "商品"/);

  // Leave sibling tips and sales/delivery/supplier/unknownItem paths alone.
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportSalesTopItemName/);
  assert.doesNotMatch(dailyReportSource, /normalizeWasteItemName/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportDeliver/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportSupplier/);
  assert.doesNotMatch(dailyReportSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(dailyReportSource, /normalizeLogDeliveryHistoryItemName/);
  assert.doesNotMatch(identitySource, /presentationDailyReportSalesTopItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryHistoryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave sales.topItemLine, deliveries.line, supplier.supplierName, and
  // waste.event.unknownItem (dailyWasteActionCopy) raw / prior paths alone.
  assert.match(
    dailyReportSource,
    /item:\s*item\.itemName/
  );
  assert.match(
    dailyReportSource,
    /item:\s*line\.itemName/
  );
  assert.match(
    dailyReportSource,
    /\{supplier\.supplierName\}/
  );
  assert.match(
    dailyReportSource,
    /item:\s*item\?\.itemName\s*\?\?\s*t\("waste\.event\.unknownItem"\)/
  );

  assert.equal(normalizeDailyReportWasteTopItemName(itemName), itemName);
  assert.equal(normalizeDailyReportWasteTopItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeDailyReportWasteTopItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report waste top-item names", () => {
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
  assert.equal(asciiTrimDailyReportWasteTopItemName(padded), padded);
  assert.equal(canonicalizeDailyReportWasteTopItemName(padded), null);
  assert.equal(canonicalizeDailyReportWasteTopItemName(nbspName), null);
  assert.equal(normalizeDailyReportWasteTopItemName(padded), null);
  assert.equal(normalizeDailyReportWasteTopItemName(nbspName), null);
  assert.equal(normalizeDailyReportWasteTopItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportWasteTopItemName(internalEm), internalEm);
  assert.equal(normalizeDailyReportWasteTopItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportWasteTopItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report waste top-item names", () => {
  assert.equal(normalizeDailyReportWasteTopItemName(undefined), null);
  assert.equal(normalizeDailyReportWasteTopItemName(null), null);
  assert.equal(normalizeDailyReportWasteTopItemName(""), null);
  assert.equal(normalizeDailyReportWasteTopItemName("   "), null);
  assert.equal(normalizeDailyReportWasteTopItemName(123 as unknown as string), null);
  assert.equal(normalizeDailyReportWasteTopItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportWasteTopItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeDailyReportWasteTopItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeDailyReportWasteTopItemName(em), null);
});

test("Daily Report waste top-item bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // into dailyReport.waste.topItem.
  assert.equal(normalizeDailyReportWasteTopItemName(""), null);
  assert.equal(normalizeDailyReportWasteTopItemName(em), null);
  assert.equal(normalizeDailyReportWasteTopItemName(nbsp), null);
  assert.match(
    dailyReportSource,
    /normalizeDailyReportWasteTopItemName\(\s*visibleReport\.wasteAnalysis\.topItems\[0\]\.itemName\s*\)\s*\|\|\s*\n?\s*t\("dailyReport\.waste\.topItem\.itemName\.none"\)/
  );
});

test("Daily Report waste top-item identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimDailyReportWasteTopItemName(padded), padded.trim());
  assert.equal(normalizeDailyReportWasteTopItemName(padded), null);
  assert.equal(normalizeDailyReportWasteTopItemName(`\t${itemName}\n`), itemName);
});
