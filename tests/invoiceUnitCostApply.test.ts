import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeInvoiceUnitPrice,
  proposeInvoiceUnitCostApply,
  selectInvoiceUnitCostApplyCandidate,
  unitCostsMatch
} from "../services/domain/invoiceUnitCostApply";
import type { SupplierDeliveryItemRecord, SupplierDeliveryRecord } from "../services/domain/supplierReliability";

const item = {
  id: "item-1",
  restaurant_id: "rest-a",
  estimated_unit_cost: 0.9,
  unit: "lbs"
};

const delivery = (
  overrides: Partial<SupplierDeliveryRecord> = {}
): SupplierDeliveryRecord => ({
  id: "del-1",
  restaurant_id: "rest-a",
  supplier_order_id: "order-1",
  status: "received",
  received_at: "2026-09-01T12:00:00.000Z",
  notes: null,
  created_at: "2026-09-01T12:00:00.000Z",
  ...overrides
});

const deliveryItem = (
  overrides: Partial<SupplierDeliveryItemRecord> = {}
): SupplierDeliveryItemRecord => ({
  id: "line-1",
  restaurant_id: "rest-a",
  delivery_id: "del-1",
  inventory_item_id: "item-1",
  ordered_quantity: 10,
  received_quantity: 10,
  damaged_quantity: 0,
  missing_quantity: 0,
  canonical_unit: "g",
  unit_price: 1.05,
  ...overrides
});

test("normalizeInvoiceUnitPrice bounds and rounds invoice prices", () => {
  assert.equal(normalizeInvoiceUnitPrice(1.05555), 1.0556);
  assert.equal(normalizeInvoiceUnitPrice(-1), null);
  assert.equal(normalizeInvoiceUnitPrice(1_000_001), null);
  assert.equal(normalizeInvoiceUnitPrice(null), null);
  assert.equal(unitCostsMatch(1.05, 1.0500001), true);
});

test("apply proposal accepts priced received lines that differ from estimated cost", () => {
  const proposal = proposeInvoiceUnitCostApply({
    restaurantId: "rest-a",
    inventoryItem: item,
    delivery: delivery(),
    deliveryItem: deliveryItem()
  });
  assert.equal(proposal.ok, true);
  if (proposal.ok) {
    assert.equal(proposal.unitPrice, 1.05);
    assert.equal(proposal.previousUnitCost, 0.9);
    assert.equal(proposal.deliveryItemId, "line-1");
  }
});

test("apply proposal refuses cross-tenant, zero-received, missing, and already-applied cases", () => {
  assert.equal(
    (
      proposeInvoiceUnitCostApply({
        restaurantId: "rest-b",
        inventoryItem: item,
        delivery: delivery(),
        deliveryItem: deliveryItem()
      }) as { reason: string }
    ).reason,
    "cross_tenant"
  );
  assert.equal(
    (
      proposeInvoiceUnitCostApply({
        restaurantId: "rest-a",
        inventoryItem: item,
        delivery: delivery(),
        deliveryItem: deliveryItem({ received_quantity: 0 })
      }) as { reason: string }
    ).reason,
    "zero_received"
  );
  assert.equal(
    (
      proposeInvoiceUnitCostApply({
        restaurantId: "rest-a",
        inventoryItem: item,
        delivery: delivery(),
        deliveryItem: deliveryItem({ unit_price: null })
      }) as { reason: string }
    ).reason,
    "missing_unit_price"
  );
  assert.equal(
    (
      proposeInvoiceUnitCostApply({
        restaurantId: "rest-a",
        inventoryItem: { ...item, estimated_unit_cost: 1.05 },
        delivery: delivery(),
        deliveryItem: deliveryItem()
      }) as { reason: string }
    ).reason,
    "already_applied"
  );
});

test("candidate selection prefers the latest priced delivery line", () => {
  const candidate = selectInvoiceUnitCostApplyCandidate({
    restaurantId: "rest-a",
    inventoryItem: item,
    deliveries: [
      delivery({ id: "older", received_at: "2026-08-01T12:00:00.000Z" }),
      delivery({ id: "newer", received_at: "2026-09-01T12:00:00.000Z" })
    ],
    deliveryItems: [
      deliveryItem({
        id: "old-line",
        delivery_id: "older",
        unit_price: 1.2
      }),
      deliveryItem({
        id: "new-line",
        delivery_id: "newer",
        unit_price: 1.05
      }),
      deliveryItem({
        id: "unpriced",
        delivery_id: "newer",
        unit_price: null
      })
    ]
  });
  assert.ok(candidate);
  assert.equal(candidate?.deliveryItemId, "new-line");
  assert.equal(candidate?.unitPrice, 1.05);
  assert.equal(candidate?.displayUnit, "lbs");
});
