import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupReferenceToken,
  canonicalizeSetupReferenceId,
  requireCanonicalSetupReferenceId
} from "../services/domain/setupReferenceIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupReferenceIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

const supplierReferenceId = "supplier-1";
const demoSupplierReferenceId = "demo-supplier:produce";

test("MISE-005MM pins setup referenceId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MM/);
  assert.match(applicationSource, /MISE-005MM/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupReferenceToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalSetupReferenceId\(value, label\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/setupReferenceIdentity"/
  );
  assert.match(
    applicationSource,
    /\/\/ MISE-005MM: ASCII-C setup client-reference identity for supplier drafts\.\s*return requireCanonicalSetupReferenceId\(value, label\);/s
  );

  // Leave restaurant workspace on Unicode trim (owned by #742 / MISE-005LL).
  assert.match(
    applicationSource,
    /const normalizedRestaurantId = restaurantId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalSetupWorkspaceId/);
  assert.doesNotMatch(applicationSource, /setupRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/setupRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)Setup(?:Restaurant|Workspace)/
  );

  // Leave attachment client_reference_id on raw attachment.id (no trim inventing path).
  assert.match(
    applicationSource,
    /client_reference_id: attachment\.id,/
  );
  assert.doesNotMatch(
    applicationSource,
    /client_reference_id: require(?:Canonical)?SetupReference/
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /purchaseLinesSourceDocumentIdentity/);
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
  assert.doesNotMatch(identitySource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountSessionIdentity/);
});

test("ASCII trim keeps ordinary setup referenceId padding stable", () => {
  assert.equal(
    asciiTrimSetupReferenceToken(`  ${supplierReferenceId}  `),
    supplierReferenceId
  );
  assert.equal(
    canonicalizeSetupReferenceId(`\t${supplierReferenceId}\n`),
    supplierReferenceId
  );
  assert.equal(
    requireCanonicalSetupReferenceId(` ${supplierReferenceId} `, "supplier"),
    supplierReferenceId
  );

  assert.equal(
    asciiTrimSetupReferenceToken(`  ${demoSupplierReferenceId}  `),
    demoSupplierReferenceId
  );
  assert.equal(
    canonicalizeSetupReferenceId(`\t${demoSupplierReferenceId}\n`),
    demoSupplierReferenceId
  );
  assert.equal(
    requireCanonicalSetupReferenceId(` ${demoSupplierReferenceId} `, "supplier"),
    demoSupplierReferenceId
  );
});

test("ASCII setup referenceId trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedSupplier = `\u00a0${supplierReferenceId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded supplier reference.
  assert.equal(nbspPaddedSupplier.trim(), supplierReferenceId);
  assert.notEqual(asciiTrimSetupReferenceToken(nbspPaddedSupplier), supplierReferenceId);
  assert.equal(canonicalizeSetupReferenceId(nbspPaddedSupplier), null);
  assert.throws(
    () => requireCanonicalSetupReferenceId(nbspPaddedSupplier, "supplier"),
    (error: unknown) =>
      error instanceof Error && error.message === "Setup supplier reference is invalid."
  );

  const emSpacePaddedDemo = `\u2003${demoSupplierReferenceId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoSupplierReferenceId);
  assert.equal(canonicalizeSetupReferenceId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalSetupReferenceId(emSpacePaddedDemo, "supplier"),
    (error: unknown) =>
      error instanceof Error && error.message === "Setup supplier reference is invalid."
  );
});

test("Setup referenceId rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeSetupReferenceId(""), null);
  assert.equal(canonicalizeSetupReferenceId("   "), null);
  assert.equal(canonicalizeSetupReferenceId("a".repeat(129)), null);
  assert.equal(canonicalizeSetupReferenceId("bad\u0000id"), null);
  assert.equal(canonicalizeSetupReferenceId("a".repeat(128)), "a".repeat(128));
  assert.throws(
    () => requireCanonicalSetupReferenceId(null, "supplier"),
    (error: unknown) =>
      error instanceof Error && error.message === "Setup supplier reference is invalid."
  );
  assert.throws(
    () => requireCanonicalSetupReferenceId("", "supplier"),
    (error: unknown) =>
      error instanceof Error && error.message === "Setup supplier reference is invalid."
  );
  assert.throws(
    () => requireCanonicalSetupReferenceId(undefined, "supplier"),
    (error: unknown) =>
      error instanceof Error && error.message === "Setup supplier reference is invalid."
  );
  assert.throws(
    () => requireCanonicalSetupReferenceId("bad\u0000id", "supplier"),
    (error: unknown) =>
      error instanceof Error && error.message === "Setup supplier reference is invalid."
  );
});
