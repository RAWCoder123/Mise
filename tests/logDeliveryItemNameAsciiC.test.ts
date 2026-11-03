import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimLogDeliveryItemName,
  canonicalizeLogDeliveryItemName,
  normalizeLogDeliveryItemName
} from "../services/domain/presentationLogDeliveryItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationLogDeliveryItemNameIdentity.ts", import.meta.url),
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

test("MISE-005WY pins Log Delivery pick-list item.item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WY/);
  assert.match(logDeliverySource, /MISE-005WY/);

  assert.match(
    identitySource,
    /export function asciiTrimLogDeliveryItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    logDeliverySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationLogDeliveryItemNameIdentity"/
  );
  assert.match(logDeliverySource, /normalizeLogDeliveryItemName\(/);
  assert.match(
    logDeliverySource,
    /normalizeLogDeliveryItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("logDelivery\.row\.itemName\.none"\)/
  );
  assert.doesNotMatch(logDeliverySource, /title=\{item\.item_name\}/);
  assert.doesNotMatch(
    logDeliverySource,
    /accessibilityLabel=\{t\("logDelivery\.row\.accessibility", \{\s*item: item\.item_name/
  );

  assert.match(catalogSource, /"logDelivery\.row\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"logDelivery\.row\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"logDelivery\.row\.itemName\.none": "商品"/);

  // Leave sibling tips and selected/history/search paths alone.
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryCountLineItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeScanItem/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryCountLineItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave selected form chrome, history titles, and search haystack alone.
  assert.match(logDeliverySource, /\? selected\.item_name/);
  assert.match(logDeliverySource, /title=\{selected\.item_name\}/);
  assert.match(logDeliverySource, /\{entry\.itemName\}/);
  assert.match(
    logDeliverySource,
    /const haystack = \[item\.item_name, item\.id, item\.category, item\.supplier_name\]/
  );

  assert.equal(normalizeLogDeliveryItemName(itemName), itemName);
  assert.equal(normalizeLogDeliveryItemName(` ${itemName} `), itemName);
  assert.equal(normalizeLogDeliveryItemName(`Artículo ${itemName}`), `Artículo ${itemName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Log Delivery item names", () => {
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
  assert.equal(asciiTrimLogDeliveryItemName(padded), padded);
  assert.equal(canonicalizeLogDeliveryItemName(padded), null);
  assert.equal(canonicalizeLogDeliveryItemName(nbspName), null);
  assert.equal(normalizeLogDeliveryItemName(padded), null);
  assert.equal(normalizeLogDeliveryItemName(nbspName), null);
  assert.equal(normalizeLogDeliveryItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeLogDeliveryItemName(internalEm), internalEm);
  assert.equal(normalizeLogDeliveryItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeLogDeliveryItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Log Delivery item names", () => {
  assert.equal(normalizeLogDeliveryItemName(undefined), null);
  assert.equal(normalizeLogDeliveryItemName(null), null);
  assert.equal(normalizeLogDeliveryItemName(""), null);
  assert.equal(normalizeLogDeliveryItemName("   "), null);
  assert.equal(normalizeLogDeliveryItemName(123 as unknown as string), null);
  assert.equal(normalizeLogDeliveryItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeLogDeliveryItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeLogDeliveryItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeLogDeliveryItemName(em), null);
});

test("Log Delivery bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // on the OperationalRow title and a11y interpolations.
  assert.equal(normalizeLogDeliveryItemName(""), null);
  assert.equal(normalizeLogDeliveryItemName(em), null);
  assert.equal(normalizeLogDeliveryItemName(nbsp), null);
  assert.match(
    logDeliverySource,
    /normalizeLogDeliveryItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("logDelivery\.row\.itemName\.none"\)/
  );
});

test("Log Delivery item-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimLogDeliveryItemName(padded), padded.trim());
  assert.equal(normalizeLogDeliveryItemName(padded), null);
  assert.equal(normalizeLogDeliveryItemName(`\t${itemName}\n`), itemName);
});
