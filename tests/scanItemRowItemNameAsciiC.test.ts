import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimScanItemRowItemName,
  canonicalizeScanItemRowItemName,
  normalizeScanItemRowItemName
} from "../services/domain/presentationScanItemRowItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationScanItemRowItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const scanItemSource = readFileSync(new URL("../app/more/scan-item.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XA pins Scan Item row item.item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005XA/);
  assert.match(scanItemSource, /MISE-005XA/);

  assert.match(
    identitySource,
    /export function asciiTrimScanItemRowItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    scanItemSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationScanItemRowItemNameIdentity"/
  );
  assert.match(scanItemSource, /normalizeScanItemRowItemName\(/);
  assert.match(
    scanItemSource,
    /normalizeScanItemRowItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("scanItem\.row\.itemName\.none"\)/
  );
  assert.doesNotMatch(scanItemSource, /title=\{item\.item_name\}/);
  assert.doesNotMatch(
    scanItemSource,
    /accessibilityLabel=\{t\("scanItem\.row\.accessibility", \{\s*item: item\.item_name/
  );

  assert.match(catalogSource, /"scanItem\.row\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"scanItem\.row\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"scanItem\.row\.itemName\.none": "商品"/);

  // Leave sibling Log Delivery / Inventory hub / count / detail tips alone.
  assert.doesNotMatch(scanItemSource, /normalizeLogDeliveryItemName/);
  assert.doesNotMatch(scanItemSource, /normalizeLogDeliverySelectedItemName/);
  assert.doesNotMatch(scanItemSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(scanItemSource, /normalizeInventoryCountLineItemName/);
  assert.doesNotMatch(scanItemSource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliverySelectedItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryCountLineItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave Scan Item search/filter haystack matching on raw item.item_name.
  assert.match(
    scanItemSource,
    /const haystack = \[item\.item_name, item\.id, item\.category, item\.supplier_name, item\.unit\]/
  );

  assert.equal(normalizeScanItemRowItemName(itemName), itemName);
  assert.equal(normalizeScanItemRowItemName(` ${itemName} `), itemName);
  assert.equal(normalizeScanItemRowItemName(`Artículo ${itemName}`), `Artículo ${itemName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Scan Item row item names", () => {
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
  assert.equal(asciiTrimScanItemRowItemName(padded), padded);
  assert.equal(canonicalizeScanItemRowItemName(padded), null);
  assert.equal(canonicalizeScanItemRowItemName(nbspName), null);
  assert.equal(normalizeScanItemRowItemName(padded), null);
  assert.equal(normalizeScanItemRowItemName(nbspName), null);
  assert.equal(normalizeScanItemRowItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeScanItemRowItemName(internalEm), internalEm);
  assert.equal(normalizeScanItemRowItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeScanItemRowItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Scan Item row item names", () => {
  assert.equal(normalizeScanItemRowItemName(undefined), null);
  assert.equal(normalizeScanItemRowItemName(null), null);
  assert.equal(normalizeScanItemRowItemName(""), null);
  assert.equal(normalizeScanItemRowItemName("   "), null);
  assert.equal(normalizeScanItemRowItemName(123 as unknown as string), null);
  assert.equal(normalizeScanItemRowItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeScanItemRowItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeScanItemRowItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeScanItemRowItemName(em), null);
});

test("Scan Item row bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // on the OperationalRow title and a11y interpolations.
  assert.equal(normalizeScanItemRowItemName(""), null);
  assert.equal(normalizeScanItemRowItemName(em), null);
  assert.equal(normalizeScanItemRowItemName(nbsp), null);
  assert.match(
    scanItemSource,
    /normalizeScanItemRowItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("scanItem\.row\.itemName\.none"\)/
  );
});

test("Scan Item row item-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimScanItemRowItemName(padded), padded.trim());
  assert.equal(normalizeScanItemRowItemName(padded), null);
  assert.equal(normalizeScanItemRowItemName(`\t${itemName}\n`), itemName);
});
