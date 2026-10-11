import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSupplierReliabilityRestaurantToken,
  canonicalizeSupplierReliabilityRestaurantId,
  requireCanonicalSupplierDeliveryEvidenceWorkspaceId,
  requireCanonicalSupplierReliabilityWorkspaceId
} from "../services/domain/supplierReliabilityRestaurantIdentity";
import {
  buildSupplierOrderDeliveryEvidence,
  buildSupplierReliabilitySummary,
  type SupplierDeliveryItemRecord,
  type SupplierDeliveryRecord
} from "../services/domain/supplierReliability";
import type { SupplierOrder } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/supplierReliabilityRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/supplierReliability.ts", import.meta.url),
  "utf8"
);
const insightsSalesAnalyticsSource = readFileSync(
  new URL("../services/domain/insightsSalesAnalytics.ts", import.meta.url),
  "utf8"
);
const orderAutomationSource = readFileSync(
  new URL("../services/domain/orderAutomation.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant-a";
const supplierId = "00000000-0000-4000-8000-000000000401";

function order(restaurantId: string = workspace): SupplierOrder {
  return {
    id: "order-1",
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: "Pantry Co.",
    order_message: "Recorded order",
    operator_note: null,
    status: "completed",
    delivery_date: "2026-07-10",
    created_at: "2026-07-01T12:00:00.000Z"
  };
}

function delivery(restaurantId: string = workspace): SupplierDeliveryRecord {
  return {
    id: "delivery-1",
    restaurant_id: restaurantId,
    supplier_order_id: "order-1",
    status: "received",
    received_at: "2026-07-10T15:00:00.000Z",
    notes: null,
    created_at: "2026-07-10T15:00:00.000Z"
  };
}

function line(restaurantId: string = workspace): SupplierDeliveryItemRecord {
  return {
    id: "line-1",
    restaurant_id: restaurantId,
    delivery_id: "delivery-1",
    inventory_item_id: "item-1",
    ordered_quantity: 20,
    received_quantity: 20,
    damaged_quantity: 0,
    missing_quantity: 0,
    canonical_unit: "each",
    discrepancy_reason: null
  };
}

function summarize(restaurantId: string) {
  return buildSupplierReliabilitySummary({
    restaurantId,
    restaurantTimeZone: "America/New_York",
    orders: [order(workspace)],
    deliveries: [delivery(workspace)],
    items: [line(workspace)]
  });
}

function evidence(restaurantId: string) {
  return buildSupplierOrderDeliveryEvidence({
    restaurantId,
    restaurantTimeZone: "America/New_York",
    order: order(workspace),
    deliveries: [delivery(workspace)],
    items: [line(workspace)]
  });
}

test("MISE-005MX pins supplierReliability restaurantId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MX/);
  assert.match(domainSource, /MISE-005MX/);

  assert.match(
    identitySource,
    /export function asciiTrimSupplierReliabilityRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /requireCanonicalSupplierReliabilityWorkspaceId\(input\.restaurantId\)/
  );
  assert.match(
    domainSource,
    /requireCanonicalSupplierDeliveryEvidenceWorkspaceId\(input\.restaurantId\)/
  );
  assert.match(domainSource, /from "\.\/supplierReliabilityRestaurantIdentity"/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /const restaurantId = input\.restaurantId\.trim\(\)/);

  // Leave supplier presentation trims alone inside this module.
  assert.match(domainSource, /order\.supplier_id\.trim\(\)/);
  assert.match(domainSource, /order\.supplier_name\.trim\(\)/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /orderAutomationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesAnalyticsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /salesTrendsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSpendRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountAuthorityRestaurantIdentity/);

  // Sibling domain restaurant workspace Unicode trim remains for a later tip.
  assert.match(insightsSalesAnalyticsSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(insightsSalesAnalyticsSource, /requireCanonicalSupplierReliabilityWorkspaceId/);
  assert.doesNotMatch(insightsSalesAnalyticsSource, /MISE-005MX/);

  // Open tip #779 owns orderAutomation restaurantId; do not rewrite that module here.
  assert.doesNotMatch(orderAutomationSource, /requireCanonicalSupplierReliabilityWorkspaceId/);
  assert.doesNotMatch(orderAutomationSource, /MISE-005MX/);
});

test("ASCII trim keeps ordinary supplier-reliability workspace padding stable", () => {
  assert.equal(asciiTrimSupplierReliabilityRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeSupplierReliabilityRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalSupplierReliabilityWorkspaceId(` ${workspace} `), workspace);
  assert.equal(requireCanonicalSupplierDeliveryEvidenceWorkspaceId(` ${workspace} `), workspace);

  const summary = summarize(`  ${workspace}  `);
  assert.equal(summary.totalDeliveries, 1);
  assert.equal(summary.suppliers[0]?.supplierId, supplierId);
  // One clean receipt is still insufficient history; identity pinning must not
  // invent a stronger status merely because ASCII padding was stripped.
  assert.equal(summary.suppliers[0]?.status, "insufficient");

  const rows = evidence(`  ${workspace}  `);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.deliveryId, "delivery-1");
  assert.equal(rows[0]?.timing, "on_time");
});

test("ASCII supplier-reliability trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimSupplierReliabilityRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeSupplierReliabilityRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalSupplierReliabilityWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalSupplierDeliveryEvidenceWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier delivery evidence requires a restaurant workspace."
  );
  assert.throws(
    () => summarize(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a restaurant workspace."
  );
  assert.throws(
    () => evidence(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier delivery evidence requires a restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeSupplierReliabilityRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalSupplierReliabilityWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a restaurant workspace."
  );
  assert.throws(
    () => summarize(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a restaurant workspace."
  );
  assert.throws(
    () => evidence(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier delivery evidence requires a restaurant workspace."
  );
});

test("Supplier-reliability workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeSupplierReliabilityRestaurantId(""), null);
  assert.equal(canonicalizeSupplierReliabilityRestaurantId("   "), null);
  assert.equal(canonicalizeSupplierReliabilityRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeSupplierReliabilityRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalSupplierReliabilityWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalSupplierReliabilityWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalSupplierReliabilityWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalSupplierDeliveryEvidenceWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier delivery evidence requires a restaurant workspace."
  );
  assert.throws(
    () => summarize(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a restaurant workspace."
  );
  assert.throws(
    () => evidence(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier delivery evidence requires a restaurant workspace."
  );

  const uuidWorkspace = "11111111-1111-4111-8111-111111111111";
  assert.equal(canonicalizeSupplierReliabilityRestaurantId(uuidWorkspace), uuidWorkspace);
  assert.equal(
    requireCanonicalSupplierReliabilityWorkspaceId(` ${uuidWorkspace} `),
    uuidWorkspace
  );
});
