import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSupplierReliabilitySupplierToken,
  canonicalizeSupplierReliabilitySupplierId,
  requireCanonicalSupplierReliabilitySupplierId
} from "../services/domain/supplierReliabilitySupplierIdentity";
import {
  buildSupplierReliabilitySummary,
  type SupplierDeliveryItemRecord,
  type SupplierDeliveryRecord
} from "../services/domain/supplierReliability";
import type { SupplierOrder } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/supplierReliabilitySupplierIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/supplierReliability.ts", import.meta.url),
  "utf8"
);
const orderAutomationSource = readFileSync(
  new URL("../services/domain/orderAutomation.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant-a";
const supplierId = "00000000-0000-4000-8000-000000000401";
const demoSupplierId = "supplier_pantry_co";

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order-1",
    restaurant_id: workspace,
    supplier_id: supplierId,
    supplier_name: "Pantry Co.",
    order_message: "Recorded order",
    operator_note: null,
    status: "completed",
    delivery_date: "2026-07-10",
    created_at: "2026-07-01T12:00:00.000Z",
    ...overrides
  };
}

function delivery(): SupplierDeliveryRecord {
  return {
    id: "delivery-1",
    restaurant_id: workspace,
    supplier_order_id: "order-1",
    status: "received",
    received_at: "2026-07-10T15:00:00.000Z",
    notes: null,
    created_at: "2026-07-10T15:00:00.000Z"
  };
}

function line(): SupplierDeliveryItemRecord {
  return {
    id: "line-1",
    restaurant_id: workspace,
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

function summarize(orders: readonly SupplierOrder[]) {
  return buildSupplierReliabilitySummary({
    restaurantId: workspace,
    restaurantTimeZone: "America/New_York",
    orders,
    deliveries: [delivery()],
    items: [line()]
  });
}

test("MISE-005OQ pins supplierReliability supplier_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005OQ/);
  assert.match(domainSource, /MISE-005OQ/);

  assert.match(
    identitySource,
    /export function asciiTrimSupplierReliabilitySupplierToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /canonicalizeSupplierReliabilitySupplierId\(order\.supplier_id\)/
  );
  assert.match(domainSource, /from "\.\/supplierReliabilitySupplierIdentity"/);
  assert.doesNotMatch(domainSource, /order\.supplier_id\.trim\(\)/);

  // Leave restaurant workspace and supplier presentation name on Unicode trim
  // in this tip (#780 owns restaurant when landed; presentation name stays).
  assert.match(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.match(domainSource, /order\.supplier_name\.trim\(\)/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /supplierReliabilityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomationSupplierIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /requireSupplierAuthorityId/);
  assert.doesNotMatch(identitySource, /demoSupplierIdentity/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)SupplierReliabilityRestaurant/
  );

  // Open tip #773 owns orderAutomation supplierId; do not rewrite that module.
  assert.doesNotMatch(orderAutomationSource, /canonicalizeSupplierReliabilitySupplierId/);
  assert.doesNotMatch(orderAutomationSource, /MISE-005OQ/);
});

test("ASCII trim keeps ordinary supplier-reliability supplier padding stable", () => {
  assert.equal(asciiTrimSupplierReliabilitySupplierToken(`  ${supplierId}  `), supplierId);
  assert.equal(canonicalizeSupplierReliabilitySupplierId(`\t${supplierId}\n`), supplierId);
  assert.equal(requireCanonicalSupplierReliabilitySupplierId(` ${supplierId} `), supplierId);

  assert.equal(asciiTrimSupplierReliabilitySupplierToken(`  ${demoSupplierId}  `), demoSupplierId);
  assert.equal(canonicalizeSupplierReliabilitySupplierId(`\t${demoSupplierId}\n`), demoSupplierId);
  assert.equal(requireCanonicalSupplierReliabilitySupplierId(` ${demoSupplierId} `), demoSupplierId);

  const summary = summarize([order({ supplier_id: `  ${supplierId}  ` })]);
  assert.equal(summary.totalDeliveries, 1);
  assert.equal(summary.suppliers[0]?.supplierId, supplierId);
  assert.equal(summary.suppliers[0]?.status, "insufficient");
});

test("ASCII supplier-reliability supplier trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${supplierId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded supplier id.
  assert.equal(nbspPadded.trim(), supplierId);
  assert.notEqual(asciiTrimSupplierReliabilitySupplierToken(nbspPadded), supplierId);
  assert.equal(canonicalizeSupplierReliabilitySupplierId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalSupplierReliabilitySupplierId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a supplier id."
  );

  // Fail closed into the existing empty-key skip: padded supplier is omitted
  // rather than inventing a clean Map key / merging with an unpadded sibling.
  const inventedAlone = summarize([order({ supplier_id: nbspPadded })]);
  assert.equal(inventedAlone.totalDeliveries, 0);
  assert.equal(inventedAlone.supplierCount, 0);

  const emSpacePadded = `\u2003${demoSupplierId}\u2003`;
  assert.equal(emSpacePadded.trim(), demoSupplierId);
  assert.equal(canonicalizeSupplierReliabilitySupplierId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalSupplierReliabilitySupplierId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a supplier id."
  );

  const mixed = buildSupplierReliabilitySummary({
    restaurantId: workspace,
    restaurantTimeZone: "America/New_York",
    orders: [
      order({ id: "order-clean", supplier_id: supplierId }),
      order({ id: "order-padded", supplier_id: nbspPadded })
    ],
    deliveries: [
      { ...delivery(), id: "delivery-clean", supplier_order_id: "order-clean" },
      { ...delivery(), id: "delivery-padded", supplier_order_id: "order-padded" }
    ],
    items: [
      { ...line(), id: "line-clean", delivery_id: "delivery-clean" },
      { ...line(), id: "line-padded", delivery_id: "delivery-padded" }
    ]
  });
  // Only the clean supplier identity groups; padded does not invent a merge.
  assert.equal(mixed.totalDeliveries, 1);
  assert.equal(mixed.supplierCount, 1);
  assert.equal(mixed.suppliers[0]?.supplierId, supplierId);
});

test("Supplier-reliability supplier rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeSupplierReliabilitySupplierId(""), null);
  assert.equal(canonicalizeSupplierReliabilitySupplierId("   "), null);
  assert.equal(canonicalizeSupplierReliabilitySupplierId("a".repeat(129)), null);
  assert.equal(canonicalizeSupplierReliabilitySupplierId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalSupplierReliabilitySupplierId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a supplier id."
  );
  assert.throws(
    () => requireCanonicalSupplierReliabilitySupplierId(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a supplier id."
  );
  assert.throws(
    () => requireCanonicalSupplierReliabilitySupplierId(undefined),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a supplier id."
  );
  assert.throws(
    () => requireCanonicalSupplierReliabilitySupplierId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability requires a supplier id."
  );

  const emptySummary = summarize([order({ supplier_id: "" })]);
  assert.equal(emptySummary.totalDeliveries, 0);
  assert.equal(emptySummary.supplierCount, 0);

  const controlSummary = summarize([order({ supplier_id: "bad\u0000id" })]);
  assert.equal(controlSummary.totalDeliveries, 0);
  assert.equal(controlSummary.supplierCount, 0);
});
