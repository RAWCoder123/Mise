import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupplierReliabilitySummary,
  buildSupplierOrderDeliveryEvidence,
  type SupplierDeliveryItemRecord,
  type SupplierDeliveryRecord
} from "../services/domain/supplierReliability";
import type { SupplierOrder } from "../types/mise";
import { createInitialDemoState, DEMO_DATASET } from "../services/demoData";
import {
  normalizeSupplierDeliveryItemRecord,
  normalizeSupplierDeliveryRecord
} from "../services/miseValidation";

const RESTAURANT_ID = "restaurant-a";
const SUPPLIER_IDS: Record<string, string> = {
  "Pantry Co.": "00000000-0000-4000-8000-000000000401",
  "Produce Co.": "00000000-0000-4000-8000-000000000402",
  Supplier: "00000000-0000-4000-8000-000000000403"
};

function order(id: string, supplierName: string, deliveryDate: string | null): SupplierOrder {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    supplier_id: SUPPLIER_IDS[supplierName] ?? "00000000-0000-4000-8000-000000000404",
    supplier_name: supplierName,
    message_locale: "en" as const,
    order_message: "Recorded order",
    operator_note: null,
    status: "completed",
    delivery_date: deliveryDate,
    created_at: "2026-07-01T12:00:00.000Z"
  };
}

function delivery(
  id: string,
  orderId: string,
  receivedAt: string,
  status: SupplierDeliveryRecord["status"] = "received"
): SupplierDeliveryRecord {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    supplier_order_id: orderId,
    status,
    received_at: receivedAt,
    notes: null,
    created_at: receivedAt
  };
}

function line(
  id: string,
  deliveryId: string,
  ordered: number,
  received: number,
  overrides: Partial<SupplierDeliveryItemRecord> = {}
): SupplierDeliveryItemRecord {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    delivery_id: deliveryId,
    inventory_item_id: `item-${id}`,
    ordered_quantity: ordered,
    received_quantity: received,
    damaged_quantity: 0,
    missing_quantity: 0,
    canonical_unit: "each",
    discrepancy_reason: null,
    ...overrides
  };
}

test("supplier reliability recognizes verified on-time matched history", () => {
  const summary = buildSupplierReliabilitySummary({
    restaurantId: RESTAURANT_ID,
    restaurantTimeZone: "America/New_York",
    orders: [order("order-1", "Pantry Co.", "2026-07-10"), order("order-2", "Pantry Co.", "2026-07-17")],
    deliveries: [
      delivery("delivery-1", "order-1", "2026-07-10T15:00:00.000Z"),
      delivery("delivery-2", "order-2", "2026-07-17T14:00:00.000Z")
    ],
    items: [line("line-1", "delivery-1", 20, 20), line("line-2", "delivery-2", 12, 12)]
  });

  assert.equal(summary.totalDeliveries, 2);
  assert.equal(summary.attentionSupplierCount, 0);
  assert.equal(summary.overallOnTimeRate, 1);
  assert.equal(summary.overallMatchedDeliveryRate, 1);
  assert.equal(summary.suppliers[0]?.status, "reliable");
  assert.equal(summary.suppliers[0]?.fulfillmentRate, 1);
  assert.deepEqual(summary.suppliers[0]?.reasons, ["matched_history"]);
});

test("supplier reliability flags repeated late and discrepant deliveries", () => {
  const summary = buildSupplierReliabilitySummary({
    restaurantId: RESTAURANT_ID,
    restaurantTimeZone: "America/New_York",
    orders: [order("order-1", "Produce Co.", "2026-07-10"), order("order-2", "Produce Co.", "2026-07-17")],
    deliveries: [
      delivery("delivery-1", "order-1", "2026-07-11T15:00:00.000Z", "discrepancy"),
      delivery("delivery-2", "order-2", "2026-07-18T15:00:00.000Z", "partially_received")
    ],
    items: [
      line("line-1", "delivery-1", 20, 15, { missing_quantity: 5 }),
      line("line-2", "delivery-2", 10, 8, { damaged_quantity: 1 })
    ]
  });

  const supplier = summary.suppliers[0]!;
  assert.equal(supplier.status, "at_risk");
  assert.equal(supplier.onTimeRate, 0);
  assert.equal(supplier.matchedDeliveryRate, 0);
  assert.equal(supplier.fulfillmentRate, 0.733);
  assert.equal(supplier.discrepancyLineCount, 2);
  assert.deepEqual(supplier.reasons, [
    "late_deliveries",
    "delivery_discrepancies",
    "underfilled_lines"
  ]);
});

test("one clean receipt remains insufficient while one issue is visible as watch", () => {
  const clean = buildSupplierReliabilitySummary({
    restaurantId: RESTAURANT_ID,
    restaurantTimeZone: "UTC",
    orders: [order("order-1", "Supplier", "2026-07-10")],
    deliveries: [delivery("delivery-1", "order-1", "2026-07-10T09:00:00.000Z")],
    items: []
  });
  const issue = buildSupplierReliabilitySummary({
    restaurantId: RESTAURANT_ID,
    restaurantTimeZone: "UTC",
    orders: [order("order-1", "Supplier", "2026-07-10")],
    deliveries: [delivery("delivery-1", "order-1", "2026-07-10T09:00:00.000Z", "unverified")],
    items: []
  });

  assert.equal(clean.suppliers[0]?.status, "insufficient");
  assert.equal(issue.suppliers[0]?.status, "watch");
  assert.deepEqual(issue.suppliers[0]?.reasons, ["limited_history", "unverified_deliveries"]);
});

test("supplier reliability rejects cross-tenant evidence and invalid timezone identity", () => {
  assert.throws(
    () =>
      buildSupplierReliabilitySummary({
        restaurantId: RESTAURANT_ID,
        restaurantTimeZone: "UTC",
        orders: [{ ...order("order-1", "Supplier", null), restaurant_id: "restaurant-b" }],
        deliveries: [],
        items: []
      }),
    /cross-restaurant/
  );
  assert.throws(
    () =>
      buildSupplierReliabilitySummary({
        restaurantId: RESTAURANT_ID,
        restaurantTimeZone: "Mars\/Olympus",
        orders: [],
        deliveries: [],
        items: []
      }),
    /valid restaurant timezone/
  );
});

test("orphan delivery rows are ignored without inventing a supplier", () => {
  const summary = buildSupplierReliabilitySummary({
    restaurantId: RESTAURANT_ID,
    restaurantTimeZone: "UTC",
    orders: [],
    deliveries: [delivery("delivery-1", "missing-order", "2026-07-10T09:00:00.000Z")],
    items: [line("line-1", "delivery-1", 10, 10)]
  });

  assert.equal(summary.totalDeliveries, 0);
  assert.equal(summary.supplierCount, 0);
  assert.deepEqual(summary.suppliers, []);
});

test("same display names with different durable IDs remain separate suppliers", () => {
  const first = order("order-1", "Shared Display", "2026-07-10");
  const second = {
    ...order("order-2", "Shared Display", "2026-07-10"),
    supplier_id: "00000000-0000-4000-8000-000000000405"
  };
  const summary = buildSupplierReliabilitySummary({
    restaurantId: RESTAURANT_ID,
    restaurantTimeZone: "UTC",
    orders: [first, second],
    deliveries: [
      delivery("delivery-1", first.id, "2026-07-10T09:00:00.000Z"),
      delivery("delivery-2", second.id, "2026-07-10T10:00:00.000Z")
    ],
    items: []
  });

  assert.equal(summary.supplierCount, 2);
  assert.deepEqual(
    new Set(summary.suppliers.map((supplier) => supplier.supplierId)),
    new Set([first.supplier_id, second.supplier_id])
  );
});

test("replaceable demo data provides reviewable reliable and at-risk supplier history", () => {
  const state = createInitialDemoState(
    "Toast",
    { preset: DEMO_DATASET.id },
    new Date("2026-08-03T16:00:00.000Z")
  );
  const restaurant = state.restaurants[0]!;
  const summary = buildSupplierReliabilitySummary({
    restaurantId: restaurant.id,
    restaurantTimeZone: restaurant.timezone,
    orders: state.supplierOrders,
    deliveries: state.supplierDeliveries.map(normalizeSupplierDeliveryRecord),
    items: state.supplierDeliveryItems.map(normalizeSupplierDeliveryItemRecord)
  });

  assert.equal(summary.totalDeliveries, 4);
  assert.equal(summary.supplierCount, 2);
  assert.equal(summary.attentionSupplierCount, 1);
  assert.equal(
    summary.suppliers.find((supplier) => supplier.supplierName === "Metro Produce Supply")?.status,
    "at_risk"
  );
  assert.equal(
    summary.suppliers.find((supplier) => supplier.supplierName === "Pantry Wholesale")?.status,
    "reliable"
  );
});

test("order delivery evidence exposes the exact late shortage behind a reliability warning", () => {
  const targetOrder = order("order-1", "Produce Co.", "2026-07-10");
  const evidence = buildSupplierOrderDeliveryEvidence({
    restaurantId: RESTAURANT_ID,
    restaurantTimeZone: "America/New_York",
    order: targetOrder,
    deliveries: [
      delivery("delivery-1", targetOrder.id, "2026-07-11T15:00:00.000Z", "discrepancy")
    ],
    items: [
      line("line-1", "delivery-1", 20, 15, { missing_quantity: 5 }),
      line("line-2", "delivery-1", 10, 10)
    ]
  });

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.timing, "late");
  assert.equal(evidence[0]?.status, "discrepancy");
  assert.equal(evidence[0]?.lineCount, 2);
  assert.equal(evidence[0]?.discrepancyLineCount, 1);
  assert.equal(evidence[0]?.missingLineCount, 1);
});
