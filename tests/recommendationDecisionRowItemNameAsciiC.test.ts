import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecommendationDecisionRowItemName,
  canonicalizeRecommendationDecisionRowItemName,
  normalizeRecommendationDecisionRowItemName
} from "../services/domain/presentationRecommendationDecisionRowItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationRecommendationDecisionRowItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const rowSource = readFileSync(
  new URL("../components/RecommendationDecisionRow.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WU pins RecommendationDecisionRow item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WU/);
  assert.match(rowSource, /MISE-005WU/);

  assert.match(
    identitySource,
    /export function asciiTrimRecommendationDecisionRowItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    rowSource,
    /from "\.\.\/services\/domain\/presentationRecommendationDecisionRowItemNameIdentity"/
  );
  assert.match(rowSource, /normalizeRecommendationDecisionRowItemName\(/);
  assert.match(
    rowSource,
    /normalizeRecommendationDecisionRowItemName\(recommendation\.item_name\)\s*\|\|\s*t\("orders\.recommendation\.itemName\.none"\)/
  );
  assert.doesNotMatch(
    rowSource,
    /<Text style=\{styles\.itemName\}>\{recommendation\.item_name\}<\/Text>/
  );

  assert.match(catalogSource, /"orders\.recommendation\.itemName\.none": "Item"/);
  assert.match(catalogSource, /"orders\.recommendation\.itemName\.none": "Artículo"/);
  assert.match(catalogSource, /"orders\.recommendation\.itemName\.none": "商品"/);

  // Leave sibling supplier_name / inventory item_name / draft-line tips alone.
  assert.doesNotMatch(rowSource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(rowSource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(rowSource, /normalizeInventoryDetailSupplierName/);
  assert.doesNotMatch(rowSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(rowSource, /normalizeSupplierDraftLine/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftLineIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave reason free-text and unit presentation on raw recommendation fields.
  assert.match(rowSource, /\{recommendation\.reason\}/);
  assert.match(rowSource, /unit: recommendation\.unit/);

  assert.equal(normalizeRecommendationDecisionRowItemName(itemName), itemName);
  assert.equal(normalizeRecommendationDecisionRowItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeRecommendationDecisionRowItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for RecommendationDecisionRow item names", () => {
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
  assert.equal(asciiTrimRecommendationDecisionRowItemName(padded), padded);
  assert.equal(canonicalizeRecommendationDecisionRowItemName(padded), null);
  assert.equal(canonicalizeRecommendationDecisionRowItemName(nbspName), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(padded), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(nbspName), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecommendationDecisionRowItemName(internalEm), internalEm);
  assert.equal(normalizeRecommendationDecisionRowItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeRecommendationDecisionRowItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for RecommendationDecisionRow item names", () => {
  assert.equal(normalizeRecommendationDecisionRowItemName(undefined), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(null), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(""), null);
  assert.equal(normalizeRecommendationDecisionRowItemName("   "), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(123 as unknown as string), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecommendationDecisionRowItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeRecommendationDecisionRowItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(em), null);
});

test("RecommendationDecisionRow bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking item identity
  // on the itemName Text and a11y interpolations.
  assert.equal(normalizeRecommendationDecisionRowItemName(""), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(em), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(nbsp), null);
  assert.match(
    rowSource,
    /normalizeRecommendationDecisionRowItemName\(recommendation\.item_name\)\s*\|\|\s*t\("orders\.recommendation\.itemName\.none"\)/
  );
});

test("RecommendationDecisionRow item-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimRecommendationDecisionRowItemName(padded), padded.trim());
  assert.equal(normalizeRecommendationDecisionRowItemName(padded), null);
  assert.equal(normalizeRecommendationDecisionRowItemName(`\t${itemName}\n`), itemName);
});
