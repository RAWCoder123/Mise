import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPurchaseLinesSourceDocumentToken,
  canonicalizePurchaseLinesSourceDocumentReference,
  requireCanonicalPurchaseLinesSourceDocumentReference
} from "../services/domain/purchaseLinesSourceDocumentIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseLinesSourceDocumentIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/purchaseLines.ts", import.meta.url),
  "utf8"
);

const sourceDocumentReference = "INV-4471";
const creditMemoReference = "CM-8892";

test("MISE-005ML pins purchaseLines sourceDocumentReference to ASCII C", () => {
  assert.match(identitySource, /MISE-005ML/);
  assert.match(applicationSource, /MISE-005ML/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseLinesSourceDocumentToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalPurchaseLinesSourceDocumentReference\(\s*input\.sourceDocumentReference\s*\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/purchaseLinesSourceDocumentIdentity"/
  );

  // Leave restaurant workspace on Unicode trim (owned by #728 / MISE-005KY).
  assert.match(
    applicationSource,
    /function requireRestaurantId\(restaurantId: string\) \{\s*const normalized = restaurantId\.trim\(\);\s*if \(!normalized\) throw new Error\("Missing restaurant workspace\."\);\s*return normalized;\s*\}/s
  );
  assert.match(
    applicationSource,
    /\/\/ MISE-005ML: ASCII-C source-document identity for purchase-line ingestion\.\s*const sourceDocumentReference = requireCanonicalPurchaseLinesSourceDocumentReference\(\s*input\.sourceDocumentReference\s*\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalPurchaseLineRestaurantId/);
  assert.doesNotMatch(applicationSource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/purchaseLineRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)PurchaseLineRestaurant/
  );

  // Leave lineId on Unicode trim (owned by #764 / MISE-005MH).
  assert.match(
    applicationSource,
    /const normalizedLineId = lineId\.trim\(\);\s*if \(!normalizedLineId\) throw new Error\("Missing purchase line\."\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalPurchaseLinesLineId/);
  assert.doesNotMatch(applicationSource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/purchaseLinesObjectIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)PurchaseLines(?:Object|Line)/
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesTaskIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /ordersWorkflowObjectIdentity/);
  assert.doesNotMatch(identitySource, /posMappingWorkflowIdentity/);
  assert.doesNotMatch(identitySource, /posRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /dailyReportRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingDecisionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /dailyPhaseBriefRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingBriefRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /pilotReadinessRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantAppRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /setupRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /autonomyRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /todayTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
});

test("ASCII trim keeps ordinary purchaseLines sourceDocumentReference padding stable", () => {
  assert.equal(
    asciiTrimPurchaseLinesSourceDocumentToken(`  ${sourceDocumentReference}  `),
    sourceDocumentReference
  );
  assert.equal(
    canonicalizePurchaseLinesSourceDocumentReference(`\t${sourceDocumentReference}\n`),
    sourceDocumentReference
  );
  assert.equal(
    requireCanonicalPurchaseLinesSourceDocumentReference(` ${sourceDocumentReference} `),
    sourceDocumentReference
  );

  assert.equal(
    asciiTrimPurchaseLinesSourceDocumentToken(`  ${creditMemoReference}  `),
    creditMemoReference
  );
  assert.equal(
    canonicalizePurchaseLinesSourceDocumentReference(`\t${creditMemoReference}\n`),
    creditMemoReference
  );
  assert.equal(
    requireCanonicalPurchaseLinesSourceDocumentReference(` ${creditMemoReference} `),
    creditMemoReference
  );
});

test("ASCII purchaseLines sourceDocumentReference trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedDoc = `\u00a0${sourceDocumentReference}\u00a0`;
  // Unicode trim invents an exact match against the unpadded invoice key.
  assert.equal(nbspPaddedDoc.trim(), sourceDocumentReference);
  assert.notEqual(
    asciiTrimPurchaseLinesSourceDocumentToken(nbspPaddedDoc),
    sourceDocumentReference
  );
  assert.equal(canonicalizePurchaseLinesSourceDocumentReference(nbspPaddedDoc), null);
  assert.throws(
    () => requireCanonicalPurchaseLinesSourceDocumentReference(nbspPaddedDoc),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A source document reference is required."
  );

  const emSpacePaddedCredit = `\u2003${creditMemoReference}\u2003`;
  assert.equal(emSpacePaddedCredit.trim(), creditMemoReference);
  assert.equal(canonicalizePurchaseLinesSourceDocumentReference(emSpacePaddedCredit), null);
  assert.throws(
    () => requireCanonicalPurchaseLinesSourceDocumentReference(emSpacePaddedCredit),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A source document reference is required."
  );
});

test("PurchaseLines sourceDocumentReference rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizePurchaseLinesSourceDocumentReference(""), null);
  assert.equal(canonicalizePurchaseLinesSourceDocumentReference("   "), null);
  assert.equal(canonicalizePurchaseLinesSourceDocumentReference("a".repeat(201)), null);
  assert.equal(canonicalizePurchaseLinesSourceDocumentReference("bad\u0000ref"), null);
  assert.equal(
    canonicalizePurchaseLinesSourceDocumentReference("a".repeat(200)),
    "a".repeat(200)
  );
  assert.throws(
    () => requireCanonicalPurchaseLinesSourceDocumentReference(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A source document reference is required."
  );
  assert.throws(
    () => requireCanonicalPurchaseLinesSourceDocumentReference(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A source document reference is required."
  );
  assert.throws(
    () => requireCanonicalPurchaseLinesSourceDocumentReference(undefined),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A source document reference is required."
  );
  assert.throws(
    () => requireCanonicalPurchaseLinesSourceDocumentReference("bad\u0000ref"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A source document reference is required."
  );
});
