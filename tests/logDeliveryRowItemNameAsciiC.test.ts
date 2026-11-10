import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimLogDeliveryRowItemName,
  canonicalizeLogDeliveryRowItemName,
  normalizeLogDeliveryRowItemName
} from "../services/domain/presentationLogDeliveryRowItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationLogDeliveryRowItemNameIdentity.ts",
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

test("MISE-005ABO pins Log Delivery row a11y item.item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABO/);
  assert.match(logDeliverySource, /MISE-005ABO/);

  assert.match(
    identitySource,
    /export function asciiTrimLogDeliveryRowItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    logDeliverySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationLogDeliveryRowItemNameIdentity"/
  );
  assert.match(logDeliverySource, /normalizeLogDeliveryRowItemName\(/);
  assert.match(
    logDeliverySource,
    /normalizeLogDeliveryRowItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("logDelivery\.row\.accessibility\.item\.none"\)/
  );
  assert.doesNotMatch(
    logDeliverySource,
    /accessibilityLabel=\{t\("logDelivery\.row\.accessibility", \{ item: item\.item_name \}\)/
  );

  assert.match(catalogSource, /"logDelivery\.row\.accessibility\.item\.none": "Item"/);
  assert.match(catalogSource, /"logDelivery\.row\.accessibility\.item\.none": "Artículo"/);
  assert.match(catalogSource, /"logDelivery\.row\.accessibility\.item\.none": "商品"/);

  // Leave OperationalRow title display and sibling tips alone.
  assert.match(logDeliverySource, /title=\{item\.item_name\}/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliverySelectedItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryHistoryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationWasteActionReviewItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationScanItemRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeLogDeliveryRowItemName(itemName), itemName);
  assert.equal(normalizeLogDeliveryRowItemName(` ${itemName} `), itemName);
  assert.equal(normalizeLogDeliveryRowItemName(`Case-${itemName}`), `Case-${itemName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Log Delivery row a11y names", () => {
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
  assert.equal(asciiTrimLogDeliveryRowItemName(padded), padded);
  assert.equal(canonicalizeLogDeliveryRowItemName(padded), null);
  assert.equal(canonicalizeLogDeliveryRowItemName(nbspName), null);
  assert.equal(normalizeLogDeliveryRowItemName(padded), null);
  assert.equal(normalizeLogDeliveryRowItemName(nbspName), null);
  assert.equal(normalizeLogDeliveryRowItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeLogDeliveryRowItemName(internalEm), internalEm);
  assert.equal(normalizeLogDeliveryRowItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeLogDeliveryRowItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Log Delivery row a11y names", () => {
  assert.equal(normalizeLogDeliveryRowItemName(undefined), null);
  assert.equal(normalizeLogDeliveryRowItemName(null), null);
  assert.equal(normalizeLogDeliveryRowItemName(""), null);
  assert.equal(normalizeLogDeliveryRowItemName("   "), null);
  assert.equal(normalizeLogDeliveryRowItemName(123 as unknown as string), null);
  assert.equal(normalizeLogDeliveryRowItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeLogDeliveryRowItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeLogDeliveryRowItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeLogDeliveryRowItemName(em), null);
});

test("Log Delivery row a11y bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking item into a11y.
  assert.equal(normalizeLogDeliveryRowItemName(""), null);
  assert.equal(normalizeLogDeliveryRowItemName(em), null);
  assert.equal(normalizeLogDeliveryRowItemName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName ?? "", "");
  assert.equal(unicodeOnlyName ?? "", em);
  assert.notEqual(unicodeOnlyName ?? "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.match(
    logDeliverySource,
    /normalizeLogDeliveryRowItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("logDelivery\.row\.accessibility\.item\.none"\)/
  );
});

test("Log Delivery row a11y item.item_name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimLogDeliveryRowItemName(padded), padded.trim());
  assert.equal(normalizeLogDeliveryRowItemName(padded), null);
  assert.equal(normalizeLogDeliveryRowItemName(`\t${itemName}\n`), itemName);
});
