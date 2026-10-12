import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";
import {
  asciiTrimPurchaseLinesCreditsLineToken,
  canonicalizePurchaseLinesCreditsLineId,
  normalizeCanonicalPurchaseLinesCreditsLineId
} from "../services/domain/purchaseLinesCreditsLineIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseLinesCreditsLineIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseLines.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/purchaseLines.ts", import.meta.url),
  "utf8"
);

const creditsLineId = "0d1d1a1a-0000-4000-8000-000000000001";
const demoCreditsLineId = "purchase_line_0d1d1a1a-0000-4000-8000-000000000001";

function creditInput(
  overrides: Partial<Parameters<typeof normalizePurchaseLineInput>[0]> = {}
) {
  return normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "credit",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 86.5,
    extendedPrice: 86.5,
    currency: "USD",
    transactionDate: "2026-09-03",
    parseConfidence: "confirmed",
    ...overrides
  });
}

test("MISE-005NT pins purchaseLines creditsLineId to ASCII C", () => {
  assert.match(identitySource, /MISE-005NT/);
  assert.match(domainSource, /MISE-005NT/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseLinesCreditsLineToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /normalizeCanonicalPurchaseLinesCreditsLineId\(\s*input\.creditsLineId\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseLinesCreditsLineIdentity"/);

  // Leave sibling normalizePurchaseLineInput free-text / date / unit trims alone.
  assert.match(domainSource, /const trimmed = value\.trim\(\);\s*if \(trimmed === "" \|\| trimmed\.length > maximum/);
  assert.match(domainSource, /if \(!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/u\.test\(trimmed\)/);

  // Leave application restaurant / lineId / source-document on Unicode trim for
  // open tips #728 / #764 / #768.
  assert.match(
    applicationSource,
    /function requireRestaurantId\(restaurantId: string\) \{\s*const normalized = restaurantId\.trim\(\);\s*if \(!normalized\) throw new Error\("Missing restaurant workspace\."\);\s*return normalized;\s*\}/s
  );
  assert.match(
    applicationSource,
    /const normalizedLineId = lineId\.trim\(\);\s*if \(!normalizedLineId\) throw new Error\("Missing purchase line\."\);/
  );
  assert.match(
    applicationSource,
    /const sourceDocumentReference = input\.sourceDocumentReference\.trim\(\);/
  );
  assert.doesNotMatch(applicationSource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(applicationSource, /MISE-005NT/);

  // Do not rewrite sibling tip helpers.
  assert.doesNotMatch(identitySource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesSourceDocumentIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsRollbackReferenceIdentity/);
  assert.doesNotMatch(domainSource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(domainSource, /purchaseLinesSourceDocumentIdentity/);
  assert.doesNotMatch(domainSource, /purchaseLineRestaurantIdentity/);
});

test("ASCII trim keeps ordinary purchaseLines creditsLineId padding stable", () => {
  assert.equal(asciiTrimPurchaseLinesCreditsLineToken(`  ${creditsLineId}  `), creditsLineId);
  assert.equal(canonicalizePurchaseLinesCreditsLineId(`\t${creditsLineId}\n`), creditsLineId);
  assert.equal(
    normalizeCanonicalPurchaseLinesCreditsLineId(`  ${creditsLineId}  `),
    creditsLineId
  );

  assert.equal(
    asciiTrimPurchaseLinesCreditsLineToken(`  ${demoCreditsLineId}  `),
    demoCreditsLineId
  );
  assert.equal(
    canonicalizePurchaseLinesCreditsLineId(`\t${demoCreditsLineId}\n`),
    demoCreditsLineId
  );

  const linked = creditInput({ creditsLineId: `  ${creditsLineId}  ` });
  assert.equal(linked.creditsLineId, creditsLineId);
  assert.equal(linked.lineType, "credit");
});

test("NBSP and em-space padding cannot invent purchaseLines creditsLineId", () => {
  const nbspCredits = `\u00a0${creditsLineId}\u00a0`;
  const emCredits = `\u2003${creditsLineId}\u2003`;

  // Unicode trim invents an exact match against the unpadded credit-offset id.
  assert.equal(nbspCredits.trim(), creditsLineId);
  assert.notEqual(asciiTrimPurchaseLinesCreditsLineToken(nbspCredits), creditsLineId);
  assert.equal(canonicalizePurchaseLinesCreditsLineId(nbspCredits), null);
  assert.throws(
    () => normalizeCanonicalPurchaseLinesCreditsLineId(nbspCredits),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase line creditsLineId is invalid."
  );
  assert.throws(
    () => creditInput({ creditsLineId: nbspCredits }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase line creditsLineId is invalid."
  );

  assert.equal(emCredits.trim(), creditsLineId);
  assert.equal(canonicalizePurchaseLinesCreditsLineId(emCredits), null);
  assert.throws(
    () => normalizeCanonicalPurchaseLinesCreditsLineId(emCredits),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase line creditsLineId is invalid."
  );
  assert.throws(
    () => creditInput({ creditsLineId: emCredits }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase line creditsLineId is invalid."
  );
});

test("PurchaseLines creditsLineId soft-empty stays null; invalid tokens fail closed", () => {
  assert.equal(normalizeCanonicalPurchaseLinesCreditsLineId(null), null);
  assert.equal(normalizeCanonicalPurchaseLinesCreditsLineId(undefined), null);
  assert.equal(normalizeCanonicalPurchaseLinesCreditsLineId(""), null);
  assert.equal(normalizeCanonicalPurchaseLinesCreditsLineId("   "), null);
  assert.equal(normalizeCanonicalPurchaseLinesCreditsLineId("\u00a0\u00a0"), null);

  const unmatched = creditInput({ creditsLineId: null });
  assert.equal(unmatched.creditsLineId, null);

  const softEmpty = creditInput({ creditsLineId: "\u00a0\u00a0" });
  assert.equal(softEmpty.creditsLineId, null);

  assert.equal(canonicalizePurchaseLinesCreditsLineId("a".repeat(129)), null);
  assert.equal(canonicalizePurchaseLinesCreditsLineId("bad\u0000id"), null);
  assert.throws(
    () => normalizeCanonicalPurchaseLinesCreditsLineId(12),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase line creditsLineId is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLinesCreditsLineId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase line creditsLineId is invalid."
  );
  assert.throws(
    () => creditInput({ creditsLineId: "bad\u0000id" }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase line creditsLineId is invalid."
  );
});
