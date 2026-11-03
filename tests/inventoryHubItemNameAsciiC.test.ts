import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryHubItemName,
  canonicalizeInventoryHubItemName,
  normalizeInventoryHubItemName
} from "../services/domain/presentationInventoryHubItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryHubItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const hubSource = readFileSync(new URL("../app/(tabs)/inventory.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WV pins Inventory hub item.item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WV/);
  assert.match(hubSource, /MISE-005WV/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryHubItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    hubSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryHubItemNameIdentity"/
  );
  assert.match(hubSource, /normalizeInventoryHubItemName\(/);
  assert.match(
    hubSource,
    /normalizeInventoryHubItemName\(item\.item_name\)\s*\|\|\s*t\("inventory\.row\.itemName\.none"\)/
  );
  assert.doesNotMatch(hubSource, /title=\{item\.item_name\}/);
  assert.doesNotMatch(
    hubSource,
    /accessibilityLabel=\{t\("inventory\.row\.accessibilityLedger", \{\s*item: item\.item_name/
  );

  assert.match(catalogSource, /"inventory\.row\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"inventory\.row\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"inventory\.row\.itemName\.none": "商品"/);

  // Leave sibling supplier_name / detail item_name / recommendation tips alone.
  assert.doesNotMatch(hubSource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(hubSource, /normalizeInventoryDetailSupplierName/);
  assert.doesNotMatch(hubSource, /normalizeRecommendationDecisionRowItemName/);
  assert.doesNotMatch(hubSource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(hubSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(hubSource, /normalizeSupplierDraftLine/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecommendationDecisionRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave hub search/filter matching on raw item.item_name.
  assert.match(hubSource, /item\.item_name\.toLowerCase\(\)\.includes\(normalized\)/);

  assert.equal(normalizeInventoryHubItemName(itemName), itemName);
  assert.equal(normalizeInventoryHubItemName(` ${itemName} `), itemName);
  assert.equal(normalizeInventoryHubItemName(`Artículo ${itemName}`), `Artículo ${itemName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Inventory hub item names", () => {
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
  assert.equal(asciiTrimInventoryHubItemName(padded), padded);
  assert.equal(canonicalizeInventoryHubItemName(padded), null);
  assert.equal(canonicalizeInventoryHubItemName(nbspName), null);
  assert.equal(normalizeInventoryHubItemName(padded), null);
  assert.equal(normalizeInventoryHubItemName(nbspName), null);
  assert.equal(normalizeInventoryHubItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryHubItemName(internalEm), internalEm);
  assert.equal(normalizeInventoryHubItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeInventoryHubItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Inventory hub item names", () => {
  assert.equal(normalizeInventoryHubItemName(undefined), null);
  assert.equal(normalizeInventoryHubItemName(null), null);
  assert.equal(normalizeInventoryHubItemName(""), null);
  assert.equal(normalizeInventoryHubItemName("   "), null);
  assert.equal(normalizeInventoryHubItemName(123 as unknown as string), null);
  assert.equal(normalizeInventoryHubItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInventoryHubItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeInventoryHubItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeInventoryHubItemName(em), null);
});

test("Inventory hub bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // on the OperationalRow title and a11y interpolations.
  assert.equal(normalizeInventoryHubItemName(""), null);
  assert.equal(normalizeInventoryHubItemName(em), null);
  assert.equal(normalizeInventoryHubItemName(nbsp), null);
  assert.match(
    hubSource,
    /normalizeInventoryHubItemName\(item\.item_name\)\s*\|\|\s*t\("inventory\.row\.itemName\.none"\)/
  );
});

test("Inventory hub item-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimInventoryHubItemName(padded), padded.trim());
  assert.equal(normalizeInventoryHubItemName(padded), null);
  assert.equal(normalizeInventoryHubItemName(`\t${itemName}\n`), itemName);
});
