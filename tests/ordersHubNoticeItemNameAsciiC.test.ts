import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersHubNoticeItemName,
  canonicalizeOrdersHubNoticeItemName,
  normalizeOrdersHubNoticeItemName
} from "../services/domain/presentationOrdersHubNoticeItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationOrdersHubNoticeItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const ordersSource = readFileSync(
  new URL("../app/(tabs)/orders.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WW pins Orders hub notice item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WW/);
  assert.match(ordersSource, /MISE-005WW/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersHubNoticeItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    ordersSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOrdersHubNoticeItemNameIdentity"/
  );
  assert.match(ordersSource, /normalizeOrdersHubNoticeItemName\(/);
  assert.match(
    ordersSource,
    /normalizeOrdersHubNoticeItemName\(approved\.item_name\)\s*\|\|\s*t\("orders\.notice\.itemName\.none"\)/
  );
  assert.match(
    ordersSource,
    /normalizeOrdersHubNoticeItemName\(dismissed\.item_name\)\s*\|\|\s*t\("orders\.notice\.itemName\.none"\)/
  );
  assert.match(
    ordersSource,
    /normalizeOrdersHubNoticeItemName\(restored\.item_name\)\s*\|\|\s*t\("orders\.notice\.itemName\.none"\)/
  );
  assert.match(
    ordersSource,
    /normalizeOrdersHubNoticeItemName\(\s*visibleUndoAction\.recommendation\.item_name\s*\)\s*\|\|\s*t\("orders\.notice\.itemName\.none"\)/
  );
  assert.doesNotMatch(
    ordersSource,
    /t\("orders\.notice\.approved", \{\s*item:\s*approved\.item_name\s*\}\)/
  );
  assert.doesNotMatch(
    ordersSource,
    /t\("orders\.notice\.dismissed", \{\s*item:\s*dismissed\.item_name\s*\}\)/
  );
  assert.doesNotMatch(
    ordersSource,
    /t\("orders\.notice\.undoRestored", \{\s*item:\s*restored\.item_name\s*\}\)/
  );
  assert.doesNotMatch(
    ordersSource,
    /\{\s*item:\s*visibleUndoAction\.recommendation\.item_name\s*\}/
  );

  assert.match(catalogSource, /"orders\.notice\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"orders\.notice\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"orders\.notice\.itemName\.none": "商品"/);

  // Leave sibling item_name / supplier_name tips alone.
  assert.doesNotMatch(ordersSource, /normalizeRecommendationDecisionRowItemName/);
  assert.doesNotMatch(ordersSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(ordersSource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(ordersSource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(ordersSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(identitySource, /presentationRecommendationDecisionRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave copied-supplier notice and telemetry supplier_name on raw fields.
  assert.match(
    ordersSource,
    /t\("orders\.notice\.copied", \{\s*supplier:\s*order\.supplier_name\s*\}\)/
  );

  assert.equal(normalizeOrdersHubNoticeItemName(itemName), itemName);
  assert.equal(normalizeOrdersHubNoticeItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeOrdersHubNoticeItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Orders hub notice item names", () => {
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
  assert.equal(asciiTrimOrdersHubNoticeItemName(padded), padded);
  assert.equal(canonicalizeOrdersHubNoticeItemName(padded), null);
  assert.equal(canonicalizeOrdersHubNoticeItemName(nbspName), null);
  assert.equal(normalizeOrdersHubNoticeItemName(padded), null);
  assert.equal(normalizeOrdersHubNoticeItemName(nbspName), null);
  assert.equal(normalizeOrdersHubNoticeItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOrdersHubNoticeItemName(internalEm), internalEm);
  assert.equal(normalizeOrdersHubNoticeItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeOrdersHubNoticeItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Orders hub notice item names", () => {
  assert.equal(normalizeOrdersHubNoticeItemName(undefined), null);
  assert.equal(normalizeOrdersHubNoticeItemName(null), null);
  assert.equal(normalizeOrdersHubNoticeItemName(""), null);
  assert.equal(normalizeOrdersHubNoticeItemName("   "), null);
  assert.equal(normalizeOrdersHubNoticeItemName(123 as unknown as string), null);
  assert.equal(normalizeOrdersHubNoticeItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeOrdersHubNoticeItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeOrdersHubNoticeItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeOrdersHubNoticeItemName(em), null);
});

test("Orders hub notice bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still interpolated blank-looking item identity
  // into StatusNotice and undo-toast copy.
  assert.equal(normalizeOrdersHubNoticeItemName(""), null);
  assert.equal(normalizeOrdersHubNoticeItemName(em), null);
  assert.equal(normalizeOrdersHubNoticeItemName(nbsp), null);
  assert.match(
    ordersSource,
    /normalizeOrdersHubNoticeItemName\(approved\.item_name\)\s*\|\|\s*t\("orders\.notice\.itemName\.none"\)/
  );
});

test("Orders hub notice item-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimOrdersHubNoticeItemName(padded), padded.trim());
  assert.equal(normalizeOrdersHubNoticeItemName(padded), null);
  assert.equal(normalizeOrdersHubNoticeItemName(`\t${itemName}\n`), itemName);
});
