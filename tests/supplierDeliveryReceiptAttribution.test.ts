import assert from "node:assert/strict";
import test from "node:test";

import {
  applySupplierDeliveryReceiptAttribution,
  normalizeDurableSupplierId,
  SUPPLIER_DELIVERY_SOURCE,
  SUPPLIER_DELIVERY_SUPPLIER_INVALID_MESSAGE,
  SUPPLIER_DELIVERY_SUPPLIER_MISMATCH_MESSAGE,
  SUPPLIER_DELIVERY_SUPPLIER_MISSING_MESSAGE,
  supplierIdFromDeliveryMetadata
} from "../services/domain/supplierDeliveryReceiptAttribution";
import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";

const SUPPLIER_ID = "10000000-0000-4000-8000-000000000014";
const OTHER_SUPPLIER_ID = "10000000-0000-4000-8000-000000000099";

test("normalizeDurableSupplierId accepts UUID text and soft-nulls inventable values", () => {
  assert.equal(normalizeDurableSupplierId(SUPPLIER_ID), SUPPLIER_ID);
  assert.equal(normalizeDurableSupplierId(` ${SUPPLIER_ID.toUpperCase()} `), SUPPLIER_ID);
  assert.equal(normalizeDurableSupplierId("not-a-uuid"), null);
  assert.equal(normalizeDurableSupplierId(""), null);
  assert.equal(normalizeDurableSupplierId(null), null);
  assert.equal(normalizeDurableSupplierId(12), null);
});

test("supplierIdFromDeliveryMetadata reads only durable supplier_id keys", () => {
  assert.equal(supplierIdFromDeliveryMetadata({ supplier_id: SUPPLIER_ID }), SUPPLIER_ID);
  assert.equal(supplierIdFromDeliveryMetadata({ supplier_id: "nope" }), null);
  assert.equal(supplierIdFromDeliveryMetadata({ supplierName: "Fresh Farms" }), null);
  assert.equal(supplierIdFromDeliveryMetadata(undefined), null);
});

test("applySupplierDeliveryReceiptAttribution stamps supplier_delivery receipts only", () => {
  const stamped = applySupplierDeliveryReceiptAttribution({
    eventType: "receipt",
    source: SUPPLIER_DELIVERY_SOURCE,
    metadata: {
      supplierOrderId: "order-1",
      supplierName: "Fresh Farms",
      lineNumber: 1
    },
    orderSupplierId: SUPPLIER_ID
  });
  assert.equal(stamped.ok, true);
  if (!stamped.ok) return;
  assert.deepEqual(stamped.metadata, {
    supplierOrderId: "order-1",
    supplierName: "Fresh Farms",
    lineNumber: 1,
    supplier_id: SUPPLIER_ID
  });

  const waste = applySupplierDeliveryReceiptAttribution({
    eventType: "waste",
    source: "operator_waste",
    metadata: { note: "trim" },
    orderSupplierId: SUPPLIER_ID
  });
  assert.equal(waste.ok, true);
  if (!waste.ok) return;
  assert.deepEqual(waste.metadata, { note: "trim" });

  const adHoc = applySupplierDeliveryReceiptAttribution({
    eventType: "receipt",
    source: "operator_receipt",
    metadata: { note: "Dock A" },
    orderSupplierId: SUPPLIER_ID
  });
  assert.equal(adHoc.ok, true);
  if (!adHoc.ok) return;
  assert.deepEqual(adHoc.metadata, { note: "Dock A" });
});

test("applySupplierDeliveryReceiptAttribution rejects missing, invalid, and mismatched ids", () => {
  const missing = applySupplierDeliveryReceiptAttribution({
    eventType: "receipt",
    source: SUPPLIER_DELIVERY_SOURCE,
    metadata: { supplierOrderId: "order-1" },
    orderSupplierId: null
  });
  assert.deepEqual(missing, {
    ok: false,
    reason: "missing_supplier",
    message: SUPPLIER_DELIVERY_SUPPLIER_MISSING_MESSAGE
  });

  const invalid = applySupplierDeliveryReceiptAttribution({
    eventType: "receipt",
    source: SUPPLIER_DELIVERY_SOURCE,
    metadata: { supplier_id: "Fresh Farms" },
    orderSupplierId: SUPPLIER_ID
  });
  assert.deepEqual(invalid, {
    ok: false,
    reason: "invalid_supplier",
    message: SUPPLIER_DELIVERY_SUPPLIER_INVALID_MESSAGE
  });

  const mismatch = applySupplierDeliveryReceiptAttribution({
    eventType: "receipt",
    source: SUPPLIER_DELIVERY_SOURCE,
    metadata: { supplier_id: OTHER_SUPPLIER_ID },
    orderSupplierId: SUPPLIER_ID
  });
  assert.deepEqual(mismatch, {
    ok: false,
    reason: "supplier_mismatch",
    message: SUPPLIER_DELIVERY_SUPPLIER_MISMATCH_MESSAGE
  });
});

test("demo stamps durable supplier_id on supplier delivery audits and rejects missing identity", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };
  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const orders = await repository.fetchSupplierOrders(DEMO_RESTAURANT_ID);
  const draft = orders.find((order) => order.status === "draft" && Boolean(order.supplier_id));
  assert.ok(draft, "demo reset must include a draft supplier order with durable supplier_id");

  const storeKey = [...values.keys()].find((key) => key.includes("demo-store"));
  assert.ok(storeKey, "demo store key must exist after reset");
  const stored = JSON.parse(values.get(storeKey)!) as {
    supplierOrders: Array<{ id: string; status: string }>;
  };
  const storedOrder = stored.supplierOrders.find((order) => order.id === draft.id);
  assert.ok(storedOrder, "draft order must exist in demo store");
  storedOrder.status = "sent";
  values.set(storeKey, JSON.stringify(stored));

  const inventoryItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const item = inventoryItems.find(
    (entry) =>
      entry.supplier_id === draft.supplier_id &&
      (entry.canonical_unit === "g" ||
        entry.canonical_unit === "ml" ||
        entry.canonical_unit === "each")
  );
  assert.ok(item, "demo seed must include an inventory item for the draft order supplier");

  const { deliveryClientIdForOrder } = await import("../services/domain/supplierDelivery");
  const receivedAt = "2026-11-10T21:00:00.000Z";
  const recorded = await repository.recordSupplierOrderDelivery(DEMO_RESTAURANT_ID, {
    supplierOrderId: draft.id,
    clientDeliveryId: deliveryClientIdForOrder(draft.id, receivedAt),
    receivedAt,
    lines: [
      {
        inventoryItemId: item.id,
        orderedQuantity: 1,
        receivedQuantity: 1,
        damagedQuantity: 0,
        missingQuantity: 0,
        canonicalUnit: item.canonical_unit as "g" | "ml" | "each",
        substitutionInventoryItemId: null,
        unitPrice: null,
        discrepancyReason: null
      }
    ],
    notes: null,
    invoiceTotal: null
  });
  assert.equal(recorded.outcome, "applied");

  const exportPayload = await repository.exportRestaurantData(DEMO_RESTAURANT_ID);
  const audits = (exportPayload.datasets.audit_logs ?? []) as Array<{
    action?: string;
    entity_id?: string;
    metadata?: Record<string, unknown>;
  }>;
  const deliveryAudit = audits.find(
    (entry) =>
      entry.action === "supplier_delivery_recorded" && entry.entity_id === recorded.deliveryId
  );
  assert.ok(deliveryAudit, "demo delivery must append an audit row");
  assert.equal(deliveryAudit?.metadata?.supplier_id, draft.supplier_id);
  assert.equal(deliveryAudit?.metadata?.supplier_order_id, draft.id);
});
