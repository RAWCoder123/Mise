import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimWasteActionReviewItemName,
  canonicalizeWasteActionReviewItemName,
  normalizeWasteActionReviewItemName
} from "../services/domain/presentationWasteActionReviewItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationWasteActionReviewItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const wasteSource = readFileSync(new URL("../app/more/waste.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XM pins Waste action reviewItem a11y itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XM/);
  assert.match(wasteSource, /MISE-005XM/);

  assert.match(
    identitySource,
    /export function asciiTrimWasteActionReviewItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    wasteSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationWasteActionReviewItemNameIdentity"/
  );
  assert.match(wasteSource, /normalizeWasteActionReviewItemName\(/);
  assert.match(
    wasteSource,
    /normalizeWasteActionReviewItemName\(item\.itemName\)\s*\|\|\s*\n?\s*t\("waste\.action\.reviewItem\.item\.none"\)/
  );
  assert.doesNotMatch(
    wasteSource,
    /accessibilityLabel=\{t\("waste\.action\.reviewItem", \{ item: item\.itemName \}\)/
  );

  assert.match(catalogSource, /"waste\.action\.reviewItem\.item\.none": "Item"/);
  assert.match(catalogSource, /"waste\.action\.reviewItem\.item\.none": "Artículo"/);
  assert.match(catalogSource, /"waste\.action\.reviewItem\.item\.none": "商品"/);

  // Leave OperationalRow title display and unknownItem / other tips alone.
  assert.match(wasteSource, /title=\{item\.itemName\}/);
  assert.match(wasteSource, /waste\.event\.unknownItem/);
  assert.doesNotMatch(identitySource, /presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportWasteTopItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationCreateTaskListRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeWasteActionReviewItemName(itemName), itemName);
  assert.equal(normalizeWasteActionReviewItemName(` ${itemName} `), itemName);
  assert.equal(normalizeWasteActionReviewItemName(`Case-${itemName}`), `Case-${itemName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Waste reviewItem a11y names", () => {
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
  assert.equal(asciiTrimWasteActionReviewItemName(padded), padded);
  assert.equal(canonicalizeWasteActionReviewItemName(padded), null);
  assert.equal(canonicalizeWasteActionReviewItemName(nbspName), null);
  assert.equal(normalizeWasteActionReviewItemName(padded), null);
  assert.equal(normalizeWasteActionReviewItemName(nbspName), null);
  assert.equal(normalizeWasteActionReviewItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeWasteActionReviewItemName(internalEm), internalEm);
  assert.equal(normalizeWasteActionReviewItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeWasteActionReviewItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Waste reviewItem a11y names", () => {
  assert.equal(normalizeWasteActionReviewItemName(undefined), null);
  assert.equal(normalizeWasteActionReviewItemName(null), null);
  assert.equal(normalizeWasteActionReviewItemName(""), null);
  assert.equal(normalizeWasteActionReviewItemName("   "), null);
  assert.equal(normalizeWasteActionReviewItemName(123 as unknown as string), null);
  assert.equal(normalizeWasteActionReviewItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeWasteActionReviewItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeWasteActionReviewItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeWasteActionReviewItemName(em), null);
});

test("Waste reviewItem a11y bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking item into a11y.
  assert.equal(normalizeWasteActionReviewItemName(""), null);
  assert.equal(normalizeWasteActionReviewItemName(em), null);
  assert.equal(normalizeWasteActionReviewItemName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName ?? "", "");
  assert.equal(unicodeOnlyName ?? "", em);
  assert.notEqual(unicodeOnlyName ?? "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.match(
    wasteSource,
    /normalizeWasteActionReviewItemName\(item\.itemName\)\s*\|\|\s*\n?\s*t\("waste\.action\.reviewItem\.item\.none"\)/
  );
});

test("Waste reviewItem a11y itemName identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimWasteActionReviewItemName(padded), padded.trim());
  assert.equal(normalizeWasteActionReviewItemName(padded), null);
  assert.equal(normalizeWasteActionReviewItemName(`\t${itemName}\n`), itemName);
});
