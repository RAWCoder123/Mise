import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersWorkflowObjectToken,
  canonicalizeOrdersWorkflowObjectId,
  requireCanonicalOrdersWorkflowObjectId
} from "../services/domain/ordersWorkflowObjectIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersWorkflowObjectIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/orders.ts", import.meta.url),
  "utf8"
);

const supplierOrderId = "00000000-0000-4000-8000-000000000601";
const purchaseDecisionEventId = "pde-demo-event";
const supplierId = "00000000-0000-4000-8000-000000000201";

test("MISE-005MC pins orders requireWorkflowId object labels to ASCII C", () => {
  assert.match(identitySource, /MISE-005MC/);
  assert.match(applicationSource, /MISE-005MC/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersWorkflowObjectToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalOrdersWorkflowObjectId\(value, label\)/);
  assert.match(applicationSource, /requireWorkflowId\(orderId, "supplier order"\)/);
  assert.match(applicationSource, /requireWorkflowId\(eventId, "purchase decision event"\)/);
  assert.match(applicationSource, /requireWorkflowId\(supplierId, "supplier"\)/);
  assert.match(
    applicationSource,
    /function requireWorkflowId\(value: string, label: string\) \{\s*if \(\s*label === "supplier order" \|\|\s*label === "purchase decision event" \|\|\s*label === "supplier"\s*\) \{\s*return requireCanonicalOrdersWorkflowObjectId\(value, label\);/s
  );

  // Leave restaurant workflow label on Unicode trim (owned by #756 / MISE-005LZ).
  assert.match(applicationSource, /requireWorkflowId\(restaurantId, "restaurant"\)/);
  assert.match(
    applicationSource,
    /const normalized = typeof value === "string" \? value\.trim\(\) : "";\s*if \(!normalized \|\| normalized\.length > 128\) throw new Error\(`Missing \$\{label\}\.`\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalOrdersWorkflowRestaurantId/);
  assert.doesNotMatch(identitySource, /ordersWorkflowRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/ordersWorkflowRestaurantIdentity"/);

  // Leave authorities path (#754) Unicode trim alone on main.
  assert.match(
    applicationSource,
    /export async function fetchPurchaseRecommendationAuthorities\(\s*restaurantId: string\s*\): Promise<Record<string, PurchaseAuthorityResult>> \{\s*const normalizedRestaurantId = restaurantId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalOrdersWorkspaceId/);
  assert.doesNotMatch(applicationSource, /ordersRestaurantIdentity/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /from "\.\/ordersRestaurantIdentity"/);
  assert.doesNotMatch(identitySource, /export function (?:asciiTrim|canonicalize|requireCanonical)OrdersRestaurant/);
  assert.doesNotMatch(identitySource, /posMappingWorkflowIdentity/);
  assert.doesNotMatch(identitySource, /posRestaurantIdentity/);
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

test("ASCII trim keeps ordinary orders object workflow padding stable", () => {
  assert.equal(asciiTrimOrdersWorkflowObjectToken(`  ${supplierOrderId}  `), supplierOrderId);
  assert.equal(canonicalizeOrdersWorkflowObjectId(`\t${supplierOrderId}\n`), supplierOrderId);
  assert.equal(
    requireCanonicalOrdersWorkflowObjectId(` ${supplierOrderId} `, "supplier order"),
    supplierOrderId
  );

  assert.equal(
    asciiTrimOrdersWorkflowObjectToken(`  ${purchaseDecisionEventId}  `),
    purchaseDecisionEventId
  );
  assert.equal(
    canonicalizeOrdersWorkflowObjectId(`\t${purchaseDecisionEventId}\n`),
    purchaseDecisionEventId
  );
  assert.equal(
    requireCanonicalOrdersWorkflowObjectId(` ${purchaseDecisionEventId} `, "purchase decision event"),
    purchaseDecisionEventId
  );

  assert.equal(asciiTrimOrdersWorkflowObjectToken(`  ${supplierId}  `), supplierId);
  assert.equal(canonicalizeOrdersWorkflowObjectId(`\t${supplierId}\n`), supplierId);
  assert.equal(requireCanonicalOrdersWorkflowObjectId(` ${supplierId} `, "supplier"), supplierId);
});

test("ASCII orders object trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedOrder = `\u00a0${supplierOrderId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded supplier order id.
  assert.equal(nbspPaddedOrder.trim(), supplierOrderId);
  assert.notEqual(asciiTrimOrdersWorkflowObjectToken(nbspPaddedOrder), supplierOrderId);
  assert.equal(canonicalizeOrdersWorkflowObjectId(nbspPaddedOrder), null);
  assert.throws(
    () => requireCanonicalOrdersWorkflowObjectId(nbspPaddedOrder, "supplier order"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );

  const emSpacePaddedEvent = `\u2003${purchaseDecisionEventId}\u2003`;
  assert.equal(emSpacePaddedEvent.trim(), purchaseDecisionEventId);
  assert.equal(canonicalizeOrdersWorkflowObjectId(emSpacePaddedEvent), null);
  assert.throws(
    () => requireCanonicalOrdersWorkflowObjectId(emSpacePaddedEvent, "purchase decision event"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing purchase decision event."
  );

  const nbspPaddedSupplier = `\u00a0${supplierId}\u00a0`;
  assert.equal(nbspPaddedSupplier.trim(), supplierId);
  assert.equal(canonicalizeOrdersWorkflowObjectId(nbspPaddedSupplier), null);
  assert.throws(
    () => requireCanonicalOrdersWorkflowObjectId(nbspPaddedSupplier, "supplier"),
    (error: unknown) => error instanceof Error && error.message === "Missing supplier."
  );
});

test("Orders object workflow rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeOrdersWorkflowObjectId(""), null);
  assert.equal(canonicalizeOrdersWorkflowObjectId("   "), null);
  assert.equal(canonicalizeOrdersWorkflowObjectId("a".repeat(129)), null);
  assert.equal(canonicalizeOrdersWorkflowObjectId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalOrdersWorkflowObjectId(null, "supplier order"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkflowObjectId("", "purchase decision event"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing purchase decision event."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkflowObjectId(undefined, "supplier"),
    (error: unknown) => error instanceof Error && error.message === "Missing supplier."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkflowObjectId("bad\u0000id", "supplier order"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier order."
  );
});
