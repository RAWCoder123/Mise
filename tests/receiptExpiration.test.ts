import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  expiresOnFromMetadata,
  normalizeReceiptExpiresOn,
  requireOptionalReceiptExpiresOn
} from "../services/domain/receiptExpiration";
import { requireInventoryOperation } from "../services/miseValidation";
import { mergeDeliveryHistoryEntries } from "../services/application/deliveryHistoryMerge";
import type { InventoryEvent } from "../services/domain/inventoryLedger";

const root = join(process.cwd());

test("requireOptionalReceiptExpiresOn accepts blank and valid calendar keys", () => {
  assert.equal(requireOptionalReceiptExpiresOn(undefined), null);
  assert.equal(requireOptionalReceiptExpiresOn(null), null);
  assert.equal(requireOptionalReceiptExpiresOn(""), null);
  assert.equal(requireOptionalReceiptExpiresOn("   "), null);
  assert.equal(requireOptionalReceiptExpiresOn("2026-11-15"), "2026-11-15");
  assert.equal(requireOptionalReceiptExpiresOn(" 2026-11-15 "), "2026-11-15");
});

test("requireOptionalReceiptExpiresOn rejects inventable and invalid shapes", () => {
  assert.throws(() => requireOptionalReceiptExpiresOn("11/15/2026"), /YYYY-MM-DD/);
  assert.throws(() => requireOptionalReceiptExpiresOn("2026-02-30"), /YYYY-MM-DD/);
  assert.throws(() => requireOptionalReceiptExpiresOn("2026-11-15\u200b"), /YYYY-MM-DD/);
  assert.throws(() => requireOptionalReceiptExpiresOn(20261115), /YYYY-MM-DD/);
  assert.throws(() => requireOptionalReceiptExpiresOn("1999-12-31"), /YYYY-MM-DD/);
  assert.throws(() => requireOptionalReceiptExpiresOn("2101-01-01"), /YYYY-MM-DD/);
});

test("normalizeReceiptExpiresOn soft-nulls padded or invalid metadata", () => {
  assert.equal(normalizeReceiptExpiresOn("2026-11-15"), "2026-11-15");
  assert.equal(normalizeReceiptExpiresOn("2026-02-30"), null);
  assert.equal(normalizeReceiptExpiresOn(" use-by tomorrow "), null);
  assert.equal(expiresOnFromMetadata({ expires_on: "2026-11-15" }), "2026-11-15");
  assert.equal(expiresOnFromMetadata({ expires_on: "soon" }), null);
  assert.equal(expiresOnFromMetadata({ note: "chilled" }), null);
});

test("receipt operations persist expires_on in bounded metadata", () => {
  const result = requireInventoryOperation({
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: "1250",
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    note: "Chilled on arrival",
    expiresOn: "2026-08-02"
  });
  assert.deepEqual(result.metadata, {
    note: "Chilled on arrival",
    expires_on: "2026-08-02"
  });
});

test("non-receipt operations reject use-by dates", () => {
  assert.throws(
    () =>
      requireInventoryOperation({
        restaurantId: "restaurant-a",
        inventoryItemId: "chicken",
        eventType: "waste",
        quantity: "100",
        canonicalUnit: "g",
        effectiveAt: "2026-07-26T10:00:00.000Z",
        expiresOn: "2026-08-02"
      }),
    /only be recorded on receipts/
  );
});

test("delivery history surfaces validated expiresOn and omits invalid metadata", () => {
  const events: InventoryEvent[] = [
    {
      id: "evt-1",
      sequence: 1,
      restaurantId: "restaurant-a",
      inventoryItemId: "item-chicken",
      eventType: "receipt",
      quantity: 1000,
      canonicalUnit: "g",
      projectionApplied: true,
      effectiveAt: "2026-08-01T09:00:00.000Z",
      recordedAt: "2026-08-01T09:05:00.000Z",
      actorUserId: "manager-1",
      source: "operator_receipt",
      sourceReference: null,
      reasonCode: null,
      clientEventId: "client-1",
      idempotencyKey: "inventory:client-1",
      supersedesEventId: null,
      metadata: { note: "Morning drop", expires_on: "2026-08-10" }
    },
    {
      id: "evt-2",
      sequence: 2,
      restaurantId: "restaurant-a",
      inventoryItemId: "item-chicken",
      eventType: "receipt",
      quantity: 500,
      canonicalUnit: "g",
      projectionApplied: true,
      effectiveAt: "2026-08-01T10:00:00.000Z",
      recordedAt: "2026-08-01T10:05:00.000Z",
      actorUserId: "manager-1",
      source: "operator_receipt",
      sourceReference: null,
      reasonCode: null,
      clientEventId: "client-2",
      idempotencyKey: "inventory:client-2",
      supersedesEventId: null,
      metadata: { expires_on: "not-a-date" }
    }
  ];

  const history = mergeDeliveryHistoryEntries({
    events,
    itemNames: new Map([["item-chicken", "Chicken thighs"]]),
    queued: []
  });

  assert.equal(history[0]!.expiresOn, null);
  assert.equal(history[1]!.expiresOn, "2026-08-10");
  assert.equal(history[1]!.note, "Morning drop");
});

test("migration pins receipt expires_on validation without wrapping record_inventory_event", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/20261110171000_receipt_expiration_dating.sql"),
    "utf8"
  );
  assert.match(migration, /validate_inventory_event_receipt_expires_on/);
  assert.match(migration, /expires_on/);
  assert.match(migration, /event_type <> 'receipt'/);
  assert.match(migration, /2000-01-01/);
  assert.match(migration, /2100-12-31/);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.doesNotMatch(migration, /record_supplier_delivery/i);
});

test("Log Delivery and Inventory detail wire optional expiresOn only on receipts", () => {
  const logDelivery = readFileSync(join(root, "app/more/log-delivery.tsx"), "utf8");
  const inventoryDetail = readFileSync(join(root, "app/inventory/[id].tsx"), "utf8");
  assert.match(logDelivery, /expiresOn:\s*expiresOnText\.trim\(\)/);
  assert.match(logDelivery, /logDelivery\.history\.expiresOn/);
  assert.match(inventoryDetail, /operation === "receipt"/);
  assert.match(inventoryDetail, /expiresOn:\s*operation === "receipt"/);
  assert.match(inventoryDetail, /inventory\.ops\.expiresOn/);
});
