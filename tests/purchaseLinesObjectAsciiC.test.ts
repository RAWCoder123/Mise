import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPurchaseLinesObjectToken,
  canonicalizePurchaseLinesObjectId,
  requireCanonicalPurchaseLinesLineId
} from "../services/domain/purchaseLinesObjectIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseLinesObjectIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/purchaseLines.ts", import.meta.url),
  "utf8"
);

const lineId = "00000000-0000-4000-8000-000000000901";
const demoLineId = "purchase_line_00000000-0000-4000-8000-000000000901";

test("MISE-005MH pins purchaseLines lineId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MH/);
  assert.match(applicationSource, /MISE-005MH/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseLinesObjectToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalPurchaseLinesLineId\(lineId\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/purchaseLinesObjectIdentity"/
  );

  // Leave restaurant workspace on Unicode trim (owned by #728 / MISE-005KY).
  assert.match(
    applicationSource,
    /function requireRestaurantId\(restaurantId: string\) \{\s*const normalized = restaurantId\.trim\(\);\s*if \(!normalized\) throw new Error\("Missing restaurant workspace\."\);\s*return normalized;\s*\}/s
  );
  assert.match(
    applicationSource,
    /\/\/ MISE-005MH: ASCII-C line identity for purchase-line correction\.\s*const normalizedLineId = requireCanonicalPurchaseLinesLineId\(lineId\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalPurchaseLineRestaurantId/);
  assert.doesNotMatch(applicationSource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/purchaseLineRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)PurchaseLineRestaurant/
  );

  // Leave source-document and line-input trim surfaces alone.
  assert.match(
    applicationSource,
    /const sourceDocumentReference = input\.sourceDocumentReference\.trim\(\);/
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
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
  assert.doesNotMatch(identitySource, /floorNotesTaskIdentity/);
});

test("ASCII trim keeps ordinary purchaseLines lineId padding stable", () => {
  assert.equal(asciiTrimPurchaseLinesObjectToken(`  ${lineId}  `), lineId);
  assert.equal(canonicalizePurchaseLinesObjectId(`\t${lineId}\n`), lineId);
  assert.equal(requireCanonicalPurchaseLinesLineId(` ${lineId} `), lineId);

  assert.equal(asciiTrimPurchaseLinesObjectToken(`  ${demoLineId}  `), demoLineId);
  assert.equal(canonicalizePurchaseLinesObjectId(`\t${demoLineId}\n`), demoLineId);
  assert.equal(requireCanonicalPurchaseLinesLineId(` ${demoLineId} `), demoLineId);
});

test("ASCII purchaseLines lineId trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedLine = `\u00a0${lineId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded purchase line id.
  assert.equal(nbspPaddedLine.trim(), lineId);
  assert.notEqual(asciiTrimPurchaseLinesObjectToken(nbspPaddedLine), lineId);
  assert.equal(canonicalizePurchaseLinesObjectId(nbspPaddedLine), null);
  assert.throws(
    () => requireCanonicalPurchaseLinesLineId(nbspPaddedLine),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing purchase line."
  );

  const emSpacePaddedDemo = `\u2003${demoLineId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoLineId);
  assert.equal(canonicalizePurchaseLinesObjectId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalPurchaseLinesLineId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing purchase line."
  );
});

test("PurchaseLines lineId rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizePurchaseLinesObjectId(""), null);
  assert.equal(canonicalizePurchaseLinesObjectId("   "), null);
  assert.equal(canonicalizePurchaseLinesObjectId("a".repeat(129)), null);
  assert.equal(canonicalizePurchaseLinesObjectId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalPurchaseLinesLineId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing purchase line."
  );
  assert.throws(
    () => requireCanonicalPurchaseLinesLineId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing purchase line."
  );
  assert.throws(
    () => requireCanonicalPurchaseLinesLineId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing purchase line."
  );
  assert.throws(
    () => requireCanonicalPurchaseLinesLineId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing purchase line."
  );
});
