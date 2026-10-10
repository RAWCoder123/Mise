import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDeliveriesSupplierOrderToken,
  canonicalizeDeliveriesSupplierOrderId,
  requireCanonicalDeliveriesSupplierOrderId
} from "../services/domain/deliveriesSupplierOrderIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/deliveriesSupplierOrderIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/deliveries.ts", import.meta.url),
  "utf8"
);

const supplierOrderId = "00000000-0000-4000-8000-000000000601";
const demoSupplierOrderId = "so-demo-order";

test("MISE-005MD pins deliveries supplierOrderId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MD/);
  assert.match(applicationSource, /MISE-005MD/);

  assert.match(
    identitySource,
    /export function asciiTrimDeliveriesSupplierOrderToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalDeliveriesSupplierOrderId\(supplierOrderId\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/deliveriesSupplierOrderIdentity"/
  );

  // Leave restaurant workspace on Unicode trim (owned by #748 / MISE-005LR).
  assert.match(
    applicationSource,
    /export async function fetchDeliveryHistory\(restaurantId: string\): Promise<DeliveryHistoryEntry\[]> \{\s*const normalizedRestaurantId = restaurantId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.match(
    applicationSource,
    /const normalizedRestaurantId = restaurantId\.trim\(\);\s*\/\/ MISE-005MD: ASCII-C supplier-order identity for deliveries receive\.\s*const normalizedOrderId = requireCanonicalDeliveriesSupplierOrderId\(supplierOrderId\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalDeliveriesWorkspaceId/);
  assert.doesNotMatch(applicationSource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/deliveriesRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)DeliveriesRestaurant/
  );

  // Leave optional clientDeliveryId Unicode trim alone on this tip.
  assert.match(
    applicationSource,
    /options\.clientDeliveryId\?\.trim\(\) \|\| deliveryClientIdForOrder\(normalizedOrderId, receivedAt\)/
  );

  // Leave sibling tips alone (do not import or define their helpers here).
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

test("ASCII trim keeps ordinary deliveries supplier-order padding stable", () => {
  assert.equal(asciiTrimDeliveriesSupplierOrderToken(`  ${supplierOrderId}  `), supplierOrderId);
  assert.equal(canonicalizeDeliveriesSupplierOrderId(`\t${supplierOrderId}\n`), supplierOrderId);
  assert.equal(requireCanonicalDeliveriesSupplierOrderId(` ${supplierOrderId} `), supplierOrderId);

  assert.equal(
    asciiTrimDeliveriesSupplierOrderToken(`  ${demoSupplierOrderId}  `),
    demoSupplierOrderId
  );
  assert.equal(
    canonicalizeDeliveriesSupplierOrderId(`\t${demoSupplierOrderId}\n`),
    demoSupplierOrderId
  );
  assert.equal(
    requireCanonicalDeliveriesSupplierOrderId(` ${demoSupplierOrderId} `),
    demoSupplierOrderId
  );
});

test("ASCII deliveries supplier-order trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedOrder = `\u00a0${supplierOrderId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded supplier order id.
  assert.equal(nbspPaddedOrder.trim(), supplierOrderId);
  assert.notEqual(asciiTrimDeliveriesSupplierOrderToken(nbspPaddedOrder), supplierOrderId);
  assert.equal(canonicalizeDeliveriesSupplierOrderId(nbspPaddedOrder), null);
  assert.throws(
    () => requireCanonicalDeliveriesSupplierOrderId(nbspPaddedOrder),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );

  const emSpacePaddedDemo = `\u2003${demoSupplierOrderId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoSupplierOrderId);
  assert.equal(canonicalizeDeliveriesSupplierOrderId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalDeliveriesSupplierOrderId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
});

test("Deliveries supplier-order rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeDeliveriesSupplierOrderId(""), null);
  assert.equal(canonicalizeDeliveriesSupplierOrderId("   "), null);
  assert.equal(canonicalizeDeliveriesSupplierOrderId("a".repeat(129)), null);
  assert.equal(canonicalizeDeliveriesSupplierOrderId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalDeliveriesSupplierOrderId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
  assert.throws(
    () => requireCanonicalDeliveriesSupplierOrderId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
  assert.throws(
    () => requireCanonicalDeliveriesSupplierOrderId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
  assert.throws(
    () => requireCanonicalDeliveriesSupplierOrderId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
});
