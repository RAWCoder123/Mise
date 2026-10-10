import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDeliveriesClientDeliveryToken,
  canonicalizeDeliveriesClientDeliveryId,
  requireCanonicalDeliveriesClientDeliveryId,
  resolveCanonicalDeliveriesClientDeliveryId
} from "../services/domain/deliveriesClientDeliveryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/deliveriesClientDeliveryIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/deliveries.ts", import.meta.url),
  "utf8"
);

const clientDeliveryId = "00000000-0000-4000-8000-000000000701";
const demoClientDeliveryId = "demo-delivery-pantry-1";
const generatedFallback = "supplier_delivery:so-demo-order:2026-10-10T12:00:00.000Z";

test("MISE-005MI pins deliveries clientDeliveryId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MI/);
  assert.match(applicationSource, /MISE-005MI/);

  assert.match(
    identitySource,
    /export function asciiTrimDeliveriesClientDeliveryToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /resolveCanonicalDeliveriesClientDeliveryId\(\s*options\.clientDeliveryId,\s*deliveryClientIdForOrder\(normalizedOrderId, receivedAt\)\s*\)/s
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/deliveriesClientDeliveryIdentity"/
  );

  // Leave restaurant workspace on Unicode trim (owned by #748 / MISE-005LR).
  assert.match(
    applicationSource,
    /export async function fetchDeliveryHistory\(restaurantId: string\): Promise<DeliveryHistoryEntry\[]> \{\s*const normalizedRestaurantId = restaurantId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.match(
    applicationSource,
    /const normalizedRestaurantId = restaurantId\.trim\(\);\s*const normalizedOrderId = supplierOrderId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);\s*if \(!normalizedOrderId\) throw new Error\("Missing supplier order\."\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalDeliveriesWorkspaceId/);
  assert.doesNotMatch(applicationSource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/deliveriesRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)DeliveriesRestaurant/
  );

  // Leave supplierOrderId Unicode trim alone on this tip (owned by #760 / MISE-005MD).
  assert.match(
    applicationSource,
    /const normalizedOrderId = supplierOrderId\.trim\(\);/
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalDeliveriesSupplierOrderId/);
  assert.doesNotMatch(applicationSource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/deliveriesSupplierOrderIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)DeliveriesSupplierOrder/
  );

  // Optional Unicode trim path must not remain on clientDeliveryId.
  assert.doesNotMatch(applicationSource, /options\.clientDeliveryId\?\.trim\(\)/);

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
  assert.doesNotMatch(identitySource, /purchaseLinesObjectIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
});

test("ASCII trim keeps ordinary deliveries client-delivery padding stable", () => {
  assert.equal(asciiTrimDeliveriesClientDeliveryToken(`  ${clientDeliveryId}  `), clientDeliveryId);
  assert.equal(canonicalizeDeliveriesClientDeliveryId(`\t${clientDeliveryId}\n`), clientDeliveryId);
  assert.equal(requireCanonicalDeliveriesClientDeliveryId(` ${clientDeliveryId} `), clientDeliveryId);
  assert.equal(
    resolveCanonicalDeliveriesClientDeliveryId(` ${clientDeliveryId} `, generatedFallback),
    clientDeliveryId
  );

  assert.equal(
    asciiTrimDeliveriesClientDeliveryToken(`  ${demoClientDeliveryId}  `),
    demoClientDeliveryId
  );
  assert.equal(
    canonicalizeDeliveriesClientDeliveryId(`\t${demoClientDeliveryId}\n`),
    demoClientDeliveryId
  );
  assert.equal(
    requireCanonicalDeliveriesClientDeliveryId(` ${demoClientDeliveryId} `),
    demoClientDeliveryId
  );
  assert.equal(
    resolveCanonicalDeliveriesClientDeliveryId(` ${demoClientDeliveryId} `, generatedFallback),
    demoClientDeliveryId
  );
});

test("ASCII deliveries client-delivery trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedDelivery = `\u00a0${clientDeliveryId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded client delivery id.
  assert.equal(nbspPaddedDelivery.trim(), clientDeliveryId);
  assert.notEqual(asciiTrimDeliveriesClientDeliveryToken(nbspPaddedDelivery), clientDeliveryId);
  assert.equal(canonicalizeDeliveriesClientDeliveryId(nbspPaddedDelivery), null);
  assert.throws(
    () => requireCanonicalDeliveriesClientDeliveryId(nbspPaddedDelivery),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
  assert.throws(
    () => resolveCanonicalDeliveriesClientDeliveryId(nbspPaddedDelivery, generatedFallback),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );

  const emSpacePaddedDemo = `\u2003${demoClientDeliveryId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoClientDeliveryId);
  assert.equal(canonicalizeDeliveriesClientDeliveryId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalDeliveriesClientDeliveryId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
  assert.throws(
    () => resolveCanonicalDeliveriesClientDeliveryId(emSpacePaddedDemo, generatedFallback),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
});

test("Deliveries client-delivery optional resolve falls back; rejects empty and control-bearing tokens", () => {
  assert.equal(
    resolveCanonicalDeliveriesClientDeliveryId(undefined, generatedFallback),
    generatedFallback
  );
  assert.equal(
    resolveCanonicalDeliveriesClientDeliveryId(null, generatedFallback),
    generatedFallback
  );
  assert.equal(
    resolveCanonicalDeliveriesClientDeliveryId("", generatedFallback),
    generatedFallback
  );
  assert.equal(
    resolveCanonicalDeliveriesClientDeliveryId("   ", generatedFallback),
    generatedFallback
  );

  assert.equal(canonicalizeDeliveriesClientDeliveryId(""), null);
  assert.equal(canonicalizeDeliveriesClientDeliveryId("   "), null);
  assert.equal(canonicalizeDeliveriesClientDeliveryId("a".repeat(201)), null);
  assert.equal(canonicalizeDeliveriesClientDeliveryId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalDeliveriesClientDeliveryId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
  assert.throws(
    () => requireCanonicalDeliveriesClientDeliveryId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
  assert.throws(
    () => requireCanonicalDeliveriesClientDeliveryId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
  assert.throws(
    () => requireCanonicalDeliveriesClientDeliveryId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
  assert.throws(
    () => resolveCanonicalDeliveriesClientDeliveryId("bad\u0000id", generatedFallback),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
  assert.throws(
    () => resolveCanonicalDeliveriesClientDeliveryId(42, generatedFallback),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing client delivery id."
  );
});
