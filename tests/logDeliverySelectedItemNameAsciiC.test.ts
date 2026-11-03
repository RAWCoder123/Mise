import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimLogDeliverySelectedItemName,
  canonicalizeLogDeliverySelectedItemName,
  normalizeLogDeliverySelectedItemName
} from "../services/domain/presentationLogDeliverySelectedItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationLogDeliverySelectedItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WZ pins Log Delivery selected.item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WZ/);
  assert.match(logDeliverySource, /MISE-005WZ/);

  assert.match(
    identitySource,
    /export function asciiTrimLogDeliverySelectedItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    logDeliverySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationLogDeliverySelectedItemNameIdentity"/
  );
  assert.match(logDeliverySource, /normalizeLogDeliverySelectedItemName\(/);
  assert.match(
    logDeliverySource,
    /normalizeLogDeliverySelectedItemName\(selected\.item_name\)\s*\|\|\s*\n?\s*t\("logDelivery\.selected\.itemName\.none"\)/
  );
  assert.doesNotMatch(logDeliverySource, /\? selected\.item_name/);
  assert.doesNotMatch(logDeliverySource, /title=\{selected\.item_name\}/);

  assert.match(catalogSource, /"logDelivery\.selected\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"logDelivery\.selected\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"logDelivery\.selected\.itemName\.none": "商品"/);

  // Leave sibling tips and pick-list/history/search paths alone.
  assert.doesNotMatch(logDeliverySource, /normalizeLogDeliveryItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryCountLineItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeScanItem/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryCountLineItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave pick-list raw item.item_name, history titles, and search haystack alone.
  assert.match(logDeliverySource, /title=\{item\.item_name\}/);
  assert.match(
    logDeliverySource,
    /accessibilityLabel=\{t\("logDelivery\.row\.accessibility", \{\s*item: item\.item_name/
  );
  assert.match(logDeliverySource, /\{entry\.itemName\}/);
  assert.match(
    logDeliverySource,
    /const haystack = \[item\.item_name, item\.id, item\.category, item\.supplier_name\]/
  );

  assert.equal(normalizeLogDeliverySelectedItemName(itemName), itemName);
  assert.equal(normalizeLogDeliverySelectedItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeLogDeliverySelectedItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Log Delivery selected item names", () => {
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
  assert.equal(asciiTrimLogDeliverySelectedItemName(padded), padded);
  assert.equal(canonicalizeLogDeliverySelectedItemName(padded), null);
  assert.equal(canonicalizeLogDeliverySelectedItemName(nbspName), null);
  assert.equal(normalizeLogDeliverySelectedItemName(padded), null);
  assert.equal(normalizeLogDeliverySelectedItemName(nbspName), null);
  assert.equal(normalizeLogDeliverySelectedItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeLogDeliverySelectedItemName(internalEm), internalEm);
  assert.equal(normalizeLogDeliverySelectedItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeLogDeliverySelectedItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Log Delivery selected item names", () => {
  assert.equal(normalizeLogDeliverySelectedItemName(undefined), null);
  assert.equal(normalizeLogDeliverySelectedItemName(null), null);
  assert.equal(normalizeLogDeliverySelectedItemName(""), null);
  assert.equal(normalizeLogDeliverySelectedItemName("   "), null);
  assert.equal(normalizeLogDeliverySelectedItemName(123 as unknown as string), null);
  assert.equal(normalizeLogDeliverySelectedItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeLogDeliverySelectedItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeLogDeliverySelectedItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeLogDeliverySelectedItemName(em), null);
});

test("Log Delivery selected bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // on the Screen subtitle and StatusNotice title.
  assert.equal(normalizeLogDeliverySelectedItemName(""), null);
  assert.equal(normalizeLogDeliverySelectedItemName(em), null);
  assert.equal(normalizeLogDeliverySelectedItemName(nbsp), null);
  assert.match(
    logDeliverySource,
    /normalizeLogDeliverySelectedItemName\(selected\.item_name\)\s*\|\|\s*\n?\s*t\("logDelivery\.selected\.itemName\.none"\)/
  );
});

test("Log Delivery selected item-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimLogDeliverySelectedItemName(padded), padded.trim());
  assert.equal(normalizeLogDeliverySelectedItemName(padded), null);
  assert.equal(normalizeLogDeliverySelectedItemName(`\t${itemName}\n`), itemName);
});
