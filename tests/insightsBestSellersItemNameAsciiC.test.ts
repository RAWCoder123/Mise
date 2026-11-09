import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsBestSellersItemName,
  canonicalizeInsightsBestSellersItemName,
  normalizeInsightsBestSellersItemName
} from "../services/domain/presentationInsightsBestSellersItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInsightsBestSellersItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const insightsSource = readFileSync(
  new URL("../app/(tabs)/insights.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const dailyReportSalesTopItemNameIdentityPath = new URL(
  "../services/domain/presentationDailyReportSalesTopItemNameIdentity.ts",
  import.meta.url
);
const askMiseTopSaleItemNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseTopSaleItemNameIdentity.ts",
  import.meta.url
);

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005AAK pins Insights analytics best-sellers item.itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAK/);
  assert.match(insightsSource, /MISE-005AAK/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsBestSellersItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsBestSellersItemNameIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsBestSellersItemName\(/);
  assert.match(
    insightsSource,
    /normalizeInsightsBestSellersItemName\(item\.itemName\)\s*\|\|\s*\n?\s*t\("insights\.analytics\.bestSellers\.itemName\.none"\)/
  );

  assert.match(catalogSource, /"insights\.analytics\.bestSellers\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"insights\.analytics\.bestSellers\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"insights\.analytics\.bestSellers\.itemName\.none": "商品"/);

  // Leave sibling Daily Report / Ask Mise / InsightListRow tips alone.
  assert.doesNotMatch(insightsSource, /normalizeDailyReportSalesTopItemName/);
  assert.doesNotMatch(insightsSource, /normalizeAskMiseTopSaleItemName/);
  assert.doesNotMatch(insightsSource, /normalizeInsightListRowTitle/);
  assert.doesNotMatch(identitySource, /presentationDailyReportSalesTopItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationAskMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(dailyReportSalesTopItemNameIdentityPath), "absent");
  assert.equal(filePresence(askMiseTopSaleItemNameIdentityPath), "absent");

  // React list keys remain raw (not display chrome).
  assert.match(insightsSource, /key=\{item\.itemName\}/);

  assert.equal(normalizeInsightsBestSellersItemName(itemName), itemName);
  assert.equal(normalizeInsightsBestSellersItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeInsightsBestSellersItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Insights best-sellers item names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Roma${em}Tomatoes`;
  const internalNbsp = `Roma${nbsp}Tomatoes`;

  // Inventing proof: Unicode trim would invent the clean item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass-name chrome would still render blank-looking / padded name.
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsBestSellersItemName(padded), padded);
  assert.equal(canonicalizeInsightsBestSellersItemName(padded), null);
  assert.equal(canonicalizeInsightsBestSellersItemName(nbspName), null);
  assert.equal(normalizeInsightsBestSellersItemName(padded), null);
  assert.equal(normalizeInsightsBestSellersItemName(nbspName), null);
  assert.equal(normalizeInsightsBestSellersItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsBestSellersItemName(internalEm), internalEm);
  assert.equal(normalizeInsightsBestSellersItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsBestSellersItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights best-sellers item names", () => {
  assert.equal(normalizeInsightsBestSellersItemName(undefined), null);
  assert.equal(normalizeInsightsBestSellersItemName(null), null);
  assert.equal(normalizeInsightsBestSellersItemName(""), null);
  assert.equal(normalizeInsightsBestSellersItemName("   "), null);
  assert.equal(normalizeInsightsBestSellersItemName(123 as unknown as string), null);
  assert.equal(normalizeInsightsBestSellersItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsBestSellersItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeInsightsBestSellersItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeInsightsBestSellersItemName(em), null);
});

test("Insights best-sellers itemName bypass proof: empty and Unicode-only-space soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // into Insights best-sellers seller-name chrome.
  assert.equal(normalizeInsightsBestSellersItemName(""), null);
  assert.equal(normalizeInsightsBestSellersItemName(em), null);
  assert.equal(normalizeInsightsBestSellersItemName(nbsp), null);
  assert.match(
    insightsSource,
    /normalizeInsightsBestSellersItemName\(item\.itemName\)\s*\|\|\s*\n?\s*t\("insights\.analytics\.bestSellers\.itemName\.none"\)/
  );
});

test("Insights best-sellers itemName identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimInsightsBestSellersItemName(padded), padded.trim());
  assert.equal(normalizeInsightsBestSellersItemName(padded), null);
  assert.equal(normalizeInsightsBestSellersItemName(`\t${itemName}\n`), itemName);
});
