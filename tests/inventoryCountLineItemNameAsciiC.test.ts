import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryCountLineItemName,
  canonicalizeInventoryCountLineItemName,
  normalizeInventoryCountLineItemName
} from "../services/domain/presentationInventoryCountLineItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryCountLineItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WX pins Inventory count line.item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WX/);
  assert.match(countSource, /MISE-005WX/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryCountLineItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    countSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryCountLineItemNameIdentity"/
  );
  assert.match(countSource, /normalizeInventoryCountLineItemName\(/);
  assert.match(
    countSource,
    /normalizeInventoryCountLineItemName\(line\.item_name\)\s*\|\|\s*\n?\s*t\("inventory\.count\.itemName\.none"\)/
  );
  assert.doesNotMatch(countSource, /\{line\.item_name\}/);
  assert.doesNotMatch(
    countSource,
    /accessibilityLabel=\{t\("inventory\.count\.countedAccessibility", \{\s*item: line\.item_name/
  );
  assert.doesNotMatch(
    countSource,
    /accessibilityLabel=\{t\("inventory\.count\.noteAccessibility", \{\s*item: line\.item_name/
  );

  assert.match(catalogSource, /"inventory\.count\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"inventory\.count\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"inventory\.count\.itemName\.none": "商品"/);

  // Leave sibling hub / detail / recommendation / notice tips alone.
  assert.doesNotMatch(countSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(countSource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(countSource, /normalizeInventoryDetailSupplierName/);
  assert.doesNotMatch(countSource, /normalizeRecommendationDecisionRowItemName/);
  assert.doesNotMatch(countSource, /normalizeOrdersHubNoticeItemName/);
  assert.doesNotMatch(countSource, /normalizeSupplierDraftLine/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecommendationDecisionRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationOrdersHubNoticeItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave count subtitle restaurant.name and draft field values alone.
  assert.match(
    countSource,
    /t\("inventory\.count\.subtitleRestaurant", \{\s*restaurant: restaurant\.name\s*\}\)/
  );

  assert.equal(normalizeInventoryCountLineItemName(itemName), itemName);
  assert.equal(normalizeInventoryCountLineItemName(` ${itemName} `), itemName);
  assert.equal(normalizeInventoryCountLineItemName(`Artículo ${itemName}`), `Artículo ${itemName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Inventory count line item names", () => {
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
  assert.equal(asciiTrimInventoryCountLineItemName(padded), padded);
  assert.equal(canonicalizeInventoryCountLineItemName(padded), null);
  assert.equal(canonicalizeInventoryCountLineItemName(nbspName), null);
  assert.equal(normalizeInventoryCountLineItemName(padded), null);
  assert.equal(normalizeInventoryCountLineItemName(nbspName), null);
  assert.equal(normalizeInventoryCountLineItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryCountLineItemName(internalEm), internalEm);
  assert.equal(normalizeInventoryCountLineItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeInventoryCountLineItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Inventory count line item names", () => {
  assert.equal(normalizeInventoryCountLineItemName(undefined), null);
  assert.equal(normalizeInventoryCountLineItemName(null), null);
  assert.equal(normalizeInventoryCountLineItemName(""), null);
  assert.equal(normalizeInventoryCountLineItemName("   "), null);
  assert.equal(normalizeInventoryCountLineItemName(123 as unknown as string), null);
  assert.equal(normalizeInventoryCountLineItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInventoryCountLineItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeInventoryCountLineItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeInventoryCountLineItemName(em), null);
});

test("Inventory count bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // on the count-line title and a11y interpolations.
  assert.equal(normalizeInventoryCountLineItemName(""), null);
  assert.equal(normalizeInventoryCountLineItemName(em), null);
  assert.equal(normalizeInventoryCountLineItemName(nbsp), null);
  assert.match(
    countSource,
    /normalizeInventoryCountLineItemName\(line\.item_name\)\s*\|\|\s*\n?\s*t\("inventory\.count\.itemName\.none"\)/
  );
});

test("Inventory count line item-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimInventoryCountLineItemName(padded), padded.trim());
  assert.equal(normalizeInventoryCountLineItemName(padded), null);
  assert.equal(normalizeInventoryCountLineItemName(`\t${itemName}\n`), itemName);
});
