import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimLogDeliveryHistoryItemName,
  canonicalizeLogDeliveryHistoryItemName,
  normalizeLogDeliveryHistoryItemName
} from "../services/domain/presentationLogDeliveryHistoryItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationLogDeliveryHistoryItemNameIdentity.ts",
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

test("MISE-005XB pins Log Delivery history entry.itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XB/);
  assert.match(logDeliverySource, /MISE-005XB/);

  assert.match(
    identitySource,
    /export function asciiTrimLogDeliveryHistoryItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    logDeliverySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationLogDeliveryHistoryItemNameIdentity"/
  );
  assert.match(logDeliverySource, /normalizeLogDeliveryHistoryItemName\(/);
  assert.match(
    logDeliverySource,
    /normalizeLogDeliveryHistoryItemName\(entry\.itemName\)\s*\|\|\s*\n?\s*t\("logDelivery\.history\.itemName\.none"\)/
  );
  assert.doesNotMatch(logDeliverySource, /\{entry\.itemName\}/);

  assert.match(catalogSource, /"logDelivery\.history\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"logDelivery\.history\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"logDelivery\.history\.itemName\.none": "商品"/);

  // Leave sibling tips and selected/pick-list/search paths alone.
  assert.doesNotMatch(logDeliverySource, /normalizeLogDeliverySelectedItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeLogDeliveryItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryCountLineItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(logDeliverySource, /normalizeScanItem/);
  assert.doesNotMatch(identitySource, /presentationLogDeliverySelectedItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryCountLineItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave pick-list raw item.item_name, selected.item_name, and search haystack alone.
  assert.match(logDeliverySource, /title=\{item\.item_name\}/);
  assert.match(
    logDeliverySource,
    /accessibilityLabel=\{t\("logDelivery\.row\.accessibility", \{\s*item: item\.item_name/
  );
  assert.match(
    logDeliverySource,
    /\? selected\.item_name\s*:/
  );
  assert.match(
    logDeliverySource,
    /title=\{selected\.item_name\}/
  );
  assert.match(
    logDeliverySource,
    /const haystack = \[item\.item_name, item\.id, item\.category, item\.supplier_name\]/
  );

  assert.equal(normalizeLogDeliveryHistoryItemName(itemName), itemName);
  assert.equal(normalizeLogDeliveryHistoryItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeLogDeliveryHistoryItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Log Delivery history item names", () => {
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
  assert.equal(asciiTrimLogDeliveryHistoryItemName(padded), padded);
  assert.equal(canonicalizeLogDeliveryHistoryItemName(padded), null);
  assert.equal(canonicalizeLogDeliveryHistoryItemName(nbspName), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(padded), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(nbspName), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeLogDeliveryHistoryItemName(internalEm), internalEm);
  assert.equal(normalizeLogDeliveryHistoryItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeLogDeliveryHistoryItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Log Delivery history item names", () => {
  assert.equal(normalizeLogDeliveryHistoryItemName(undefined), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(null), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(""), null);
  assert.equal(normalizeLogDeliveryHistoryItemName("   "), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(123 as unknown as string), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeLogDeliveryHistoryItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeLogDeliveryHistoryItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(em), null);
});

test("Log Delivery history bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // on the history card title.
  assert.equal(normalizeLogDeliveryHistoryItemName(""), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(em), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(nbsp), null);
  assert.match(
    logDeliverySource,
    /normalizeLogDeliveryHistoryItemName\(entry\.itemName\)\s*\|\|\s*\n?\s*t\("logDelivery\.history\.itemName\.none"\)/
  );
});

test("Log Delivery history item-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimLogDeliveryHistoryItemName(padded), padded.trim());
  assert.equal(normalizeLogDeliveryHistoryItemName(padded), null);
  assert.equal(normalizeLogDeliveryHistoryItemName(`\t${itemName}\n`), itemName);
});
