import assert from "node:assert/strict";
import test from "node:test";

import {
  applyOperatorReceiptSupplierAttribution,
  normalizeDurableSupplierId,
  OPERATOR_RECEIPT_SOURCE,
  RECEIPT_SUPPLIER_INVALID_MESSAGE,
  RECEIPT_SUPPLIER_MISMATCH_MESSAGE,
  RECEIPT_SUPPLIER_MISSING_MESSAGE,
  supplierIdFromMetadata
} from "../services/domain/receiptSupplierAttribution";
import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
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

test("supplierIdFromMetadata reads only durable supplier_id keys", () => {
  assert.equal(supplierIdFromMetadata({ supplier_id: SUPPLIER_ID }), SUPPLIER_ID);
  assert.equal(supplierIdFromMetadata({ supplier_id: "nope" }), null);
  assert.equal(supplierIdFromMetadata({ note: "Fresh Farms" }), null);
  assert.equal(supplierIdFromMetadata(undefined), null);
});

test("applyOperatorReceiptSupplierAttribution stamps operator receipts only", () => {
  const stamped = applyOperatorReceiptSupplierAttribution({
    eventType: "receipt",
    source: OPERATOR_RECEIPT_SOURCE,
    metadata: { note: "Dock A" },
    inventoryItemSupplierId: SUPPLIER_ID
  });
  assert.equal(stamped.ok, true);
  if (!stamped.ok) return;
  assert.deepEqual(stamped.metadata, {
    note: "Dock A",
    supplier_id: SUPPLIER_ID
  });

  const waste = applyOperatorReceiptSupplierAttribution({
    eventType: "waste",
    source: "operator_waste",
    metadata: { note: "trim" },
    inventoryItemSupplierId: SUPPLIER_ID
  });
  assert.equal(waste.ok, true);
  if (!waste.ok) return;
  assert.deepEqual(waste.metadata, { note: "trim" });

  const orderPath = applyOperatorReceiptSupplierAttribution({
    eventType: "receipt",
    source: "supplier_delivery",
    metadata: { supplierOrderId: "order-1" },
    inventoryItemSupplierId: SUPPLIER_ID
  });
  assert.equal(orderPath.ok, true);
  if (!orderPath.ok) return;
  assert.deepEqual(orderPath.metadata, { supplierOrderId: "order-1" });
});

test("applyOperatorReceiptSupplierAttribution rejects missing, invalid, and mismatched ids", () => {
  const missing = applyOperatorReceiptSupplierAttribution({
    eventType: "receipt",
    source: OPERATOR_RECEIPT_SOURCE,
    metadata: {},
    inventoryItemSupplierId: null
  });
  assert.deepEqual(missing, {
    ok: false,
    reason: "missing_supplier",
    message: RECEIPT_SUPPLIER_MISSING_MESSAGE
  });

  const invalid = applyOperatorReceiptSupplierAttribution({
    eventType: "receipt",
    source: OPERATOR_RECEIPT_SOURCE,
    metadata: { supplier_id: "Fresh Farms" },
    inventoryItemSupplierId: SUPPLIER_ID
  });
  assert.deepEqual(invalid, {
    ok: false,
    reason: "invalid_supplier",
    message: RECEIPT_SUPPLIER_INVALID_MESSAGE
  });

  const mismatch = applyOperatorReceiptSupplierAttribution({
    eventType: "receipt",
    source: OPERATOR_RECEIPT_SOURCE,
    metadata: { supplier_id: OTHER_SUPPLIER_ID },
    inventoryItemSupplierId: SUPPLIER_ID
  });
  assert.deepEqual(mismatch, {
    ok: false,
    reason: "supplier_mismatch",
    message: RECEIPT_SUPPLIER_MISMATCH_MESSAGE
  });
});

test("hosted supplier-attribution messages map to terminal rejection reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: RECEIPT_SUPPLIER_MISSING_MESSAGE
    }),
    { status: "rejected", reason: "missing_supplier" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: RECEIPT_SUPPLIER_MISMATCH_MESSAGE
    }),
    { status: "rejected", reason: "supplier_mismatch" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: RECEIPT_SUPPLIER_INVALID_MESSAGE
    }),
    { status: "rejected", reason: "invalid_supplier" }
  );
});

async function demoRepository() {
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
  return repository;
}

test("demo stamps durable supplier_id on operator_receipt and keeps retries idempotent", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const item = items.find(
    (entry) =>
      entry.canonical_unit_verification_status === "verified" &&
      entry.canonical_unit &&
      entry.canonical_quantity_per_unit != null &&
      entry.canonical_quantity_per_unit > 0 &&
      Boolean(entry.supplier_id)
  );
  assert.ok(item, "demo seed must include a verified item with durable supplier_id");

  const first = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: item.id,
    eventType: "receipt",
    quantity: item.canonical_quantity_per_unit!,
    canonicalUnit: item.canonical_unit!,
    effectiveAt: "2026-11-10T19:00:00.000Z",
    source: OPERATOR_RECEIPT_SOURCE,
    sourceReference: null,
    reasonCode: null,
    clientEventId: "operator-receipt-supplier-1",
    idempotencyKey: "operator-receipt-supplier-1",
    supersedesEventId: null,
    metadata: { note: "Log Delivery" }
  });
  assert.equal(first.status, "accepted");
  if (first.status !== "accepted") return;
  assert.equal(first.event.metadata.supplier_id, item.supplier_id.toLowerCase());
  assert.equal(first.event.metadata.note, "Log Delivery");

  const retry = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: item.id,
    eventType: "receipt",
    quantity: item.canonical_quantity_per_unit!,
    canonicalUnit: item.canonical_unit!,
    effectiveAt: "2026-11-10T19:00:00.000Z",
    source: OPERATOR_RECEIPT_SOURCE,
    sourceReference: null,
    reasonCode: null,
    clientEventId: "operator-receipt-supplier-1",
    idempotencyKey: "operator-receipt-supplier-1",
    supersedesEventId: null,
    metadata: { note: "Log Delivery" }
  });
  assert.equal(retry.status, "duplicate");

  const forged = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: item.id,
    eventType: "receipt",
    quantity: item.canonical_quantity_per_unit!,
    canonicalUnit: item.canonical_unit!,
    effectiveAt: "2026-11-10T19:05:00.000Z",
    source: OPERATOR_RECEIPT_SOURCE,
    sourceReference: null,
    reasonCode: null,
    clientEventId: "operator-receipt-supplier-forged",
    idempotencyKey: "operator-receipt-supplier-forged",
    supersedesEventId: null,
    metadata: { supplier_id: OTHER_SUPPLIER_ID }
  });
  assert.equal(forged.status, "rejected");
  if (forged.status === "rejected") {
    assert.equal(forged.reason, "supplier_mismatch");
  }
});
