import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { deliveryClientIdForOrder } from "../services/domain/supplierDelivery";
import {
  asciiTrimSupplierDeliveryOrderToken,
  canonicalizeSupplierDeliveryOrderId,
  requireCanonicalSupplierDeliveryOrderId
} from "../services/domain/supplierDeliveryOrderIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/supplierDeliveryOrderIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/supplierDelivery.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/deliveries.ts", import.meta.url),
  "utf8"
);

const orderId = "00000000-0000-4000-8000-000000000601";
const demoOrderId = "so-demo-order";
const receivedAt = "2026-10-10T12:00:00.000Z";

test("MISE-005MR pins supplierDelivery deliveryClientIdForOrder orderId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MR/);
  assert.match(domainSource, /MISE-005MR/);

  assert.match(
    identitySource,
    /export function asciiTrimSupplierDeliveryOrderToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /requireCanonicalSupplierDeliveryOrderId\(orderId\)/
  );
  assert.match(
    domainSource,
    /from "\.\/supplierDeliveryOrderIdentity"/
  );

  // Leave application receive paths on Unicode trim for open tips #748/#760/#765.
  assert.match(
    applicationSource,
    /const normalizedRestaurantId = restaurantId\.trim\(\);\s*const normalizedOrderId = supplierOrderId\.trim\(\);/s
  );
  assert.match(
    applicationSource,
    /options\.clientDeliveryId\?\.trim\(\) \|\| deliveryClientIdForOrder\(normalizedOrderId, receivedAt\)/
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalDeliveriesSupplierOrderId/);
  assert.doesNotMatch(applicationSource, /resolveCanonicalDeliveriesClientDeliveryId/);
  assert.doesNotMatch(applicationSource, /requireCanonicalDeliveriesWorkspaceId/);
  assert.doesNotMatch(applicationSource, /supplierDeliveryOrderIdentity/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomationSupplierIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountItemIdentity/);
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
});

test("ASCII trim keeps ordinary supplier-delivery order padding stable", () => {
  assert.equal(asciiTrimSupplierDeliveryOrderToken(`  ${orderId}  `), orderId);
  assert.equal(canonicalizeSupplierDeliveryOrderId(`\t${orderId}\n`), orderId);
  assert.equal(requireCanonicalSupplierDeliveryOrderId(` ${orderId} `), orderId);
  assert.equal(
    deliveryClientIdForOrder(` ${orderId} `, receivedAt),
    `supplier_delivery:${orderId}:${receivedAt}`
  );

  assert.equal(asciiTrimSupplierDeliveryOrderToken(`  ${demoOrderId}  `), demoOrderId);
  assert.equal(canonicalizeSupplierDeliveryOrderId(`\t${demoOrderId}\n`), demoOrderId);
  assert.equal(requireCanonicalSupplierDeliveryOrderId(` ${demoOrderId} `), demoOrderId);
  assert.equal(
    deliveryClientIdForOrder(` ${demoOrderId} `, receivedAt),
    `supplier_delivery:${demoOrderId}:${receivedAt}`
  );
});

test("ASCII supplier-delivery order trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedOrder = `\u00a0${orderId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded order id.
  assert.equal(nbspPaddedOrder.trim(), orderId);
  assert.notEqual(asciiTrimSupplierDeliveryOrderToken(nbspPaddedOrder), orderId);
  assert.equal(canonicalizeSupplierDeliveryOrderId(nbspPaddedOrder), null);
  assert.throws(
    () => requireCanonicalSupplierDeliveryOrderId(nbspPaddedOrder),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );
  assert.throws(
    () => deliveryClientIdForOrder(nbspPaddedOrder, receivedAt),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );

  const emSpacePaddedDemo = `\u2003${demoOrderId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoOrderId);
  assert.equal(canonicalizeSupplierDeliveryOrderId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalSupplierDeliveryOrderId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );
  assert.throws(
    () => deliveryClientIdForOrder(emSpacePaddedDemo, receivedAt),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );
});

test("Supplier-delivery order rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeSupplierDeliveryOrderId(""), null);
  assert.equal(canonicalizeSupplierDeliveryOrderId("   "), null);
  assert.equal(canonicalizeSupplierDeliveryOrderId("a".repeat(129)), null);
  assert.equal(canonicalizeSupplierDeliveryOrderId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalSupplierDeliveryOrderId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );
  assert.throws(
    () => requireCanonicalSupplierDeliveryOrderId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );
  assert.throws(
    () => requireCanonicalSupplierDeliveryOrderId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );
  assert.throws(
    () => requireCanonicalSupplierDeliveryOrderId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );
  assert.throws(
    () => deliveryClientIdForOrder("", receivedAt),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier delivery requires an order id."
  );
});
