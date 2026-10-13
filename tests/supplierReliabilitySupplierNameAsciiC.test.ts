import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSupplierReliabilitySummary,
  type SupplierDeliveryItemRecord,
  type SupplierDeliveryRecord
} from "../services/domain/supplierReliability";
import {
  canonicalSupplierReliabilitySupplierName,
  canonicalizeSupplierReliabilitySupplierName,
  normalizeCanonicalSupplierReliabilitySupplierName,
  requireCanonicalSupplierReliabilitySupplierName
} from "../services/domain/supplierReliabilitySupplierNameIdentity";
import type { SupplierOrder } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/supplierReliabilitySupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/supplierReliability.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant-a";
const supplierId = "00000000-0000-4000-8000-000000000401";
const supplierName = "Pantry Co.";
const accentedSupplierName = "Café Produce Co.";

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order-1",
    restaurant_id: workspace,
    supplier_id: supplierId,
    supplier_name: supplierName,
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

test("MISE-005OZ pins supplierReliability supplierName to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005OZ/);
  assert.match(domainSource, /MISE-005OZ/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalSupplierReliabilitySupplierName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    domainSource,
    /canonicalizeSupplierReliabilitySupplierName\(order\.supplier_name\)/
  );
  assert.match(domainSource, /from "\.\/supplierReliabilitySupplierNameIdentity"/);
  assert.doesNotMatch(domainSource, /order\.supplier_name\.trim\(\)/);

  // Leave restaurant workspace and supplier identity on Unicode trim (open tips
  // #780 / #825 tip those separately).
  assert.match(domainSource, /const restaurantId = input\.restaurantId\.trim\(\);/);
  assert.match(domainSource, /const key = order\.supplier_id\.trim\(\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /supplierReliabilitySupplierIdentity/);
  assert.doesNotMatch(identitySource, /supplierReliabilityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomationSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierDisplayNameIdentity/);
  assert.doesNotMatch(domainSource, /supplierReliabilitySupplierIdentity/);
  assert.doesNotMatch(domainSource, /orderAutomationSupplierNameIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedSupplierNameIdentity/);
});

test("ASCII C display prep keeps ordinary supplier-reliability supplierName stable", () => {
  assert.equal(
    canonicalSupplierReliabilitySupplierName(`  ${supplierName}  `),
    supplierName
  );
  // Pure display prep still collapses C whitespace (TAB/NL); summary soft
  // canonicalize keeps those characters when they are the only padding.
  assert.equal(
    canonicalSupplierReliabilitySupplierName(`\t${supplierName}\n`),
    supplierName
  );
  assert.equal(
    canonicalizeSupplierReliabilitySupplierName(`  ${supplierName}  `),
    supplierName
  );
  assert.equal(
    normalizeCanonicalSupplierReliabilitySupplierName(`  ${supplierName}  `),
    supplierName
  );
  assert.equal(
    requireCanonicalSupplierReliabilitySupplierName(`  ${supplierName}  `),
    supplierName
  );

  assert.equal(
    canonicalSupplierReliabilitySupplierName(accentedSupplierName),
    accentedSupplierName
  );
  assert.equal(
    canonicalizeSupplierReliabilitySupplierName(accentedSupplierName),
    accentedSupplierName
  );

  const summary = summarize([order({ supplier_name: `  ${supplierName}  ` })]);
  assert.equal(summary.suppliers.length, 1);
  assert.equal(summary.suppliers[0]!.supplierName, supplierName);
  assert.equal(summary.suppliers[0]!.supplierId, supplierId);
});

test("NBSP folds and em-space padding cannot invent supplier-reliability supplierName", () => {
  const nbspName = `\u00a0${supplierName}\u00a0`;
  const emName = `\u2003${supplierName}\u2003`;
  const internalEm = `Pantry\u2003Co.`;

  // Pasted NBSP is folded like MISE-005B / private.normalize_supplier_display_name.
  assert.equal(nbspName.trim(), supplierName);
  assert.equal(canonicalSupplierReliabilitySupplierName(nbspName), supplierName);
  assert.equal(canonicalizeSupplierReliabilitySupplierName(nbspName), supplierName);
  assert.equal(normalizeCanonicalSupplierReliabilitySupplierName(nbspName), supplierName);
  assert.equal(summarize([order({ supplier_name: nbspName })]).suppliers[0]!.supplierName, supplierName);

  // Unicode em-space trim invents a clean display name; C display prep does not.
  assert.equal(emName.trim(), supplierName);
  assert.notEqual(canonicalSupplierReliabilitySupplierName(emName), supplierName);
  assert.equal(canonicalSupplierReliabilitySupplierName(emName), emName);
  assert.equal(canonicalizeSupplierReliabilitySupplierName(emName), emName);
  assert.equal(normalizeCanonicalSupplierReliabilitySupplierName(emName), emName);
  assert.equal(summarize([order({ supplier_name: emName })]).suppliers[0]!.supplierName, emName);

  assert.equal(canonicalSupplierReliabilitySupplierName(internalEm), internalEm);
  assert.notEqual(
    canonicalSupplierReliabilitySupplierName(internalEm),
    canonicalSupplierReliabilitySupplierName("Pantry Co.")
  );

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(canonicalSupplierReliabilitySupplierName("Kelvin Foods"), "Kelvin Foods");
  assert.notEqual(
    canonicalSupplierReliabilitySupplierName("Kelvin Foods"),
    canonicalSupplierReliabilitySupplierName("Kelvin Foods")
  );
});

test("supplier-reliability supplierName soft-empty stays empty and inventing/control/over-long fail closed", () => {
  assert.equal(canonicalizeSupplierReliabilitySupplierName(""), "");
  assert.equal(canonicalizeSupplierReliabilitySupplierName("   "), "");
  assert.equal(canonicalizeSupplierReliabilitySupplierName("\u00a0\u00a0"), "");
  assert.equal(canonicalizeSupplierReliabilitySupplierName("\u2003"), "");
  assert.equal(normalizeCanonicalSupplierReliabilitySupplierName(null), "");
  assert.equal(normalizeCanonicalSupplierReliabilitySupplierName(undefined), "");
  assert.equal(normalizeCanonicalSupplierReliabilitySupplierName(""), "");
  assert.equal(normalizeCanonicalSupplierReliabilitySupplierName("\u2003"), "");

  assert.equal(
    summarize([order({ supplier_name: "\u2003" })]).suppliers[0]!.supplierName,
    ""
  );

  assert.throws(
    () => normalizeCanonicalSupplierReliabilitySupplierName(123),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability supplier name is invalid."
  );
  assert.throws(
    () => normalizeCanonicalSupplierReliabilitySupplierName("Bad\u0000Name"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability supplier name is invalid."
  );
  // TAB is C whitespace for collapse, but remaining control chars in the raw
  // input still fail closed on the normalize helper (same control gate as #691 / #692).
  assert.throws(
    () => normalizeCanonicalSupplierReliabilitySupplierName("Pantry\tCo."),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability supplier name is invalid."
  );
  assert.throws(
    () => normalizeCanonicalSupplierReliabilitySupplierName("x".repeat(161)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability supplier name is invalid."
  );
  assert.throws(
    () => requireCanonicalSupplierReliabilitySupplierName(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability supplier name is invalid."
  );
  assert.throws(
    () => requireCanonicalSupplierReliabilitySupplierName(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability supplier name is invalid."
  );
});
