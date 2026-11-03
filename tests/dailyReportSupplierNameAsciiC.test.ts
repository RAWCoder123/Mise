import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportSupplierName,
  canonicalizeDailyReportSupplierName,
  normalizeDailyReportSupplierName
} from "../services/domain/presentationDailyReportSupplierNameIdentity";
import {
  buildSupplierReliabilitySummary,
  type SupplierDeliveryItemRecord,
  type SupplierDeliveryRecord
} from "../services/domain/supplierReliability";
import type { SupplierOrder } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/presentationDailyReportSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const reliabilitySource = readFileSync(
  new URL("../services/domain/supplierReliability.ts", import.meta.url),
  "utf8"
);
const reportSource = readFileSync(new URL("../app/more/daily-report.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const supplierName = "Sysco";
const em = "\u2003";
const nbsp = "\u00a0";
const restaurantId = "restaurant-a";
const supplierId = "00000000-0000-4000-8000-000000000401";

function order(id: string, name: string): SupplierOrder {
  return {
    id,
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: name,
    order_message: "Recorded order",
    operator_note: null,
    status: "completed",
    delivery_date: "2026-07-01",
    created_at: "2026-07-01T12:00:00.000Z"
  };
}

function delivery(id: string, orderId: string): SupplierDeliveryRecord {
  return {
    id,
    restaurant_id: restaurantId,
    supplier_order_id: orderId,
    status: "received",
    received_at: "2026-07-01T15:00:00.000Z",
    notes: null,
    created_at: "2026-07-01T15:00:00.000Z"
  };
}

function line(id: string, deliveryId: string): SupplierDeliveryItemRecord {
  return {
    id,
    restaurant_id: restaurantId,
    delivery_id: deliveryId,
    inventory_item_id: `item-${id}`,
    ordered_quantity: 1,
    received_quantity: 1,
    damaged_quantity: 0,
    missing_quantity: 0,
    canonical_unit: "each",
    discrepancy_reason: null
  };
}

test("MISE-005WS pins daily-report supplier.supplierName to ASCII C", () => {
  assert.match(identitySource, /MISE-005WS/);
  assert.match(reliabilitySource, /MISE-005WS/);
  assert.match(reportSource, /MISE-005WS/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    reliabilitySource,
    /normalizeDailyReportSupplierName\(order\.supplier_name\)\s*\?\?\s*""/
  );
  assert.doesNotMatch(
    reliabilitySource,
    /supplierName:\s*order\.supplier_name\.trim\(\)/
  );

  assert.match(
    reportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportSupplierNameIdentity"/
  );
  assert.match(reportSource, /normalizeDailyReportSupplierName\(/);
  assert.match(
    reportSource,
    /normalizeDailyReportSupplierName\(\s*supplier\.supplierName\s*\)\s*\|\|\s*t\("dailyReport\.supplierReliability\.supplierName\.none"\)/
  );
  assert.doesNotMatch(
    reportSource,
    /<Text style=\{styles\.signalType\}>\{supplier\.supplierName\}<\/Text>/
  );

  assert.match(
    catalogSource,
    /"dailyReport\.supplierReliability\.supplierName\.none": "Supplier"/
  );
  assert.match(
    catalogSource,
    /"dailyReport\.supplierReliability\.supplierName\.none": "Proveedor"/
  );
  assert.match(
    catalogSource,
    /"dailyReport\.supplierReliability\.supplierName\.none": "供应商"/
  );

  // Leave sibling supplier_name tips alone on this tip.
  assert.doesNotMatch(reportSource, /normalizeInventoryDetailSupplierName/);
  assert.doesNotMatch(reportSource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(reportSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyReportSupplierName(supplierName), supplierName);
  assert.equal(normalizeDailyReportSupplierName(` ${supplierName} `), supplierName);
  assert.equal(
    normalizeDailyReportSupplierName(`Proveedor ${supplierName}`),
    `Proveedor ${supplierName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for daily-report supplier names", () => {
  const padded = `${em}${supplierName}${em}`;
  const nbspName = `${nbsp}${supplierName}${nbsp}`;
  const internalEm = `Sys${em}co`;
  const internalNbsp = `Sys${nbsp}co`;

  // Inventing proof: Unicode trim would invent the clean supplier name.
  assert.equal(padded.trim(), supplierName);
  assert.equal(nbspName.trim(), supplierName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportSupplierName(padded), padded);
  assert.equal(canonicalizeDailyReportSupplierName(padded), null);
  assert.equal(canonicalizeDailyReportSupplierName(nbspName), null);
  assert.equal(normalizeDailyReportSupplierName(padded), null);
  assert.equal(normalizeDailyReportSupplierName(nbspName), null);
  assert.equal(normalizeDailyReportSupplierName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportSupplierName(internalEm), internalEm);
  assert.equal(normalizeDailyReportSupplierName(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportSupplierName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for daily-report supplier names", () => {
  assert.equal(normalizeDailyReportSupplierName(undefined), null);
  assert.equal(normalizeDailyReportSupplierName(null), null);
  assert.equal(normalizeDailyReportSupplierName(""), null);
  assert.equal(normalizeDailyReportSupplierName("   "), null);
  assert.equal(normalizeDailyReportSupplierName(123 as unknown as string), null);
  assert.equal(normalizeDailyReportSupplierName(`\u0001${supplierName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportSupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeDailyReportSupplierName(`${supplierName}\u0007`), null);
  assert.equal(normalizeDailyReportSupplierName(em), null);
});

test("daily-report bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking supplier identity
  // on the reliability row signalType Text.
  assert.equal(normalizeDailyReportSupplierName(""), null);
  assert.equal(normalizeDailyReportSupplierName(em), null);
  assert.equal(normalizeDailyReportSupplierName(nbsp), null);
  assert.match(
    reportSource,
    /normalizeDailyReportSupplierName\(\s*supplier\.supplierName\s*\)\s*\|\|\s*t\("dailyReport\.supplierReliability\.supplierName\.none"\)/
  );
});

test("daily-report supplier-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${supplierName}${em}`;
  assert.notEqual(asciiTrimDailyReportSupplierName(padded), padded.trim());
  assert.equal(normalizeDailyReportSupplierName(padded), null);
  assert.equal(normalizeDailyReportSupplierName(`\t${supplierName}\n`), supplierName);
});

test("reliability summary no longer invents clean supplierName via Unicode trim", () => {
  const padded = `${em}${supplierName}${em}`;
  const summary = buildSupplierReliabilitySummary({
    restaurantId,
    restaurantTimeZone: "America/New_York",
    orders: [order("order-1", padded)],
    deliveries: [delivery("delivery-1", "order-1")],
    items: [line("line-1", "delivery-1")]
  });

  assert.equal(summary.suppliers.length, 1);
  // Soft-null refuses inventing equality with the unpadded supplier name.
  assert.equal(summary.suppliers[0]?.supplierName, "");
  assert.notEqual(summary.suppliers[0]?.supplierName, supplierName);
  assert.equal(
    normalizeDailyReportSupplierName(summary.suppliers[0]?.supplierName) || "Supplier",
    "Supplier"
  );

  const clean = buildSupplierReliabilitySummary({
    restaurantId,
    restaurantTimeZone: "America/New_York",
    orders: [order("order-2", supplierName)],
    deliveries: [delivery("delivery-2", "order-2")],
    items: [line("line-2", "delivery-2")]
  });
  assert.equal(clean.suppliers[0]?.supplierName, supplierName);
});
