import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";

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

test("demo restaurant export surfaces projection_applied on inventory_events", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const item = items.find(
    (entry) =>
      entry.canonical_unit_verification_status === "verified" &&
      entry.canonical_unit != null &&
      entry.canonical_quantity_per_unit != null &&
      entry.canonical_quantity_per_unit > 0 &&
      entry.current_quantity > 0
  );
  assert.ok(item, "demo seed must expose a verified inventory item");

  const countedAt = new Date(Date.now() - 60_000).toISOString();
  const delayedReceiptAt = new Date(Date.now() - 3_600_000).toISOString();
  const conversion = item.canonical_quantity_per_unit!;
  const countCanonical = item.current_quantity * conversion;

  const count = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: item.id,
    eventType: "count",
    quantity: countCanonical,
    canonicalUnit: item.canonical_unit!,
    effectiveAt: countedAt,
    source: "approve_count_session",
    sourceReference: "export-projection-count",
    reasonCode: null,
    clientEventId: "export-projection-count-1",
    idempotencyKey: "export-projection-count-1",
    supersedesEventId: null,
    metadata: { test: "export_projection_applied" }
  });
  assert.equal(count.status, "accepted");
  assert.equal(count.status === "accepted" ? count.event.projectionApplied : null, true);

  const delayedReceipt = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: item.id,
    eventType: "receipt",
    quantity: conversion,
    canonicalUnit: item.canonical_unit!,
    effectiveAt: delayedReceiptAt,
    source: "supplier_delivery",
    sourceReference: "export-projection-delayed-receipt",
    reasonCode: null,
    clientEventId: "export-projection-receipt-1",
    idempotencyKey: "export-projection-receipt-1",
    supersedesEventId: null,
    metadata: { test: "export_projection_applied" }
  });
  assert.equal(delayedReceipt.status, "accepted");
  assert.equal(
    delayedReceipt.status === "accepted" ? delayedReceipt.event.projectionApplied : null,
    false
  );

  const exported = await repository.exportRestaurantData(DEMO_RESTAURANT_ID);
  const rows = exported.datasets.inventory_events.filter(
    (row) =>
      row.inventory_item_id === item.id &&
      (row.client_event_id === "export-projection-count-1" ||
        row.client_event_id === "export-projection-receipt-1")
  );
  assert.equal(rows.length, 2);

  const countRow = rows.find((row) => row.client_event_id === "export-projection-count-1");
  const receiptRow = rows.find((row) => row.client_event_id === "export-projection-receipt-1");
  assert.equal(countRow?.projection_applied, true);
  assert.equal(receiptRow?.projection_applied, false);

  // Legacy rows without the flag must export as applied (fail-closed), matching
  // hosted NOT NULL DEFAULT true and domain planning reads.
  const legacyAbsent = exported.datasets.inventory_events.find(
    (row) => !Object.prototype.hasOwnProperty.call(row, "projection_applied")
  );
  assert.equal(legacyAbsent, undefined);
  assert.ok(
    exported.datasets.inventory_events.every(
      (row) => typeof row.projection_applied === "boolean"
    )
  );
});
