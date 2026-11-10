import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  queueInventoryPurchaseUnitOperation,
  setDeviceInventoryOutboxRepositoryForTesting
} from "../services/application/deviceInventoryOutbox";
import {
  isOperatorPurchaseUnitReady,
  purchaseUnitsToCanonicalOperatorQuantity,
  resolveOperatorPurchaseUnitQuantity
} from "../services/domain/inventoryOperatorQuantity";
import { requireInventoryOperation } from "../services/miseValidation";
import {
  createInventoryOutboxRepository,
  type InventoryOutboxStorage
} from "../services/repositories/inventoryOutboxRepository";

function memoryStorage(): InventoryOutboxStorage {
  const values = new Map<string, string>();
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    }
  };
}

const identitySource = readFileSync(
  new URL("../services/domain/inventoryOperatorQuantity.ts", import.meta.url),
  "utf8"
);
const inventorySource = readFileSync(new URL("../app/inventory/[id].tsx", import.meta.url), "utf8");
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const verifiedItem = {
  unit: "lb",
  canonical_unit: "g" as const,
  canonical_quantity_per_unit: 453.592,
  canonical_unit_verification_status: "verified" as const
};

test("purchase-unit operator conversion multiplies by the verified factor", () => {
  assert.equal(
    purchaseUnitsToCanonicalOperatorQuantity({
      purchaseQuantity: 2,
      canonicalQuantityPerUnit: 453.592
    }),
    907.184
  );
  assert.equal(
    purchaseUnitsToCanonicalOperatorQuantity({
      purchaseQuantity: 0,
      canonicalQuantityPerUnit: 1000
    }),
    0
  );
});

test("purchase-unit conversion fails closed on missing or absurd factors", () => {
  assert.throws(
    () =>
      purchaseUnitsToCanonicalOperatorQuantity({
        purchaseQuantity: 2,
        canonicalQuantityPerUnit: 0
      }),
    /not verified/
  );
  assert.throws(
    () =>
      purchaseUnitsToCanonicalOperatorQuantity({
        purchaseQuantity: -1,
        canonicalQuantityPerUnit: 10
      }),
    /outside supported limits/
  );
  assert.equal(isOperatorPurchaseUnitReady({ ...verifiedItem, canonical_quantity_per_unit: null }), false);
  assert.equal(
    isOperatorPurchaseUnitReady({
      ...verifiedItem,
      canonical_unit_verification_status: "draft"
    }),
    false
  );
});

test("resolveOperatorPurchaseUnitQuantity stamps purchase-unit evidence metadata", () => {
  const resolved = resolveOperatorPurchaseUnitQuantity({
    purchaseQuantity: 1.5,
    item: verifiedItem
  });
  assert.equal(Number(resolved.canonicalQuantity.toFixed(6)), 680.388);
  assert.equal(resolved.canonicalUnit, "g");
  assert.deepEqual(resolved.metadata, {
    purchase_unit_quantity: 1.5,
    purchase_unit: "lb",
    canonical_quantity_per_unit: 453.592
  });
});

test("requireInventoryOperation keeps canonical quantity and stamps purchase-unit evidence", () => {
  const event = requireInventoryOperation({
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: 907.184,
    canonicalUnit: "g",
    effectiveAt: "2026-11-10T18:00:00.000Z",
    note: "Walk-in delivery",
    purchaseUnitQuantity: 2,
    purchaseUnit: "lb",
    canonicalQuantityPerUnit: 453.592
  });
  assert.equal(event.quantity, 907.184);
  assert.deepEqual(event.metadata, {
    note: "Walk-in delivery",
    purchase_unit_quantity: 2,
    purchase_unit: "lb",
    canonical_quantity_per_unit: 453.592
  });
});

test("queueInventoryPurchaseUnitOperation converts lb to grams before outbox write", async () => {
  const restore = setDeviceInventoryOutboxRepositoryForTesting(
    createInventoryOutboxRepository(memoryStorage())
  );
  try {
    const queued = await queueInventoryPurchaseUnitOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "waste",
      purchaseQuantity: 2,
      item: verifiedItem,
      effectiveAt: "2026-11-10T18:00:00.000Z",
      note: "Trim waste"
    });
    assert.equal(queued.event.quantity, 907.184);
    assert.equal(queued.event.canonicalUnit, "g");
    assert.deepEqual(queued.event.metadata, {
      note: "Trim waste",
      purchase_unit_quantity: 2,
      purchase_unit: "lb",
      canonical_quantity_per_unit: 453.592
    });
  } finally {
    restore();
  }
});

test("count purchase zero converts to canonical zero and stockout skips purchase metadata", async () => {
  const restore = setDeviceInventoryOutboxRepositoryForTesting(
    createInventoryOutboxRepository(memoryStorage())
  );
  try {
    const counted = await queueInventoryPurchaseUnitOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "count",
      purchaseQuantity: 0,
      item: verifiedItem,
      effectiveAt: "2026-11-10T18:00:00.000Z"
    });
    assert.equal(counted.event.quantity, 0);
    assert.equal(counted.event.metadata.purchase_unit_quantity, 0);
    assert.equal(counted.event.metadata.purchase_unit, "lb");

    const stockout = await queueInventoryPurchaseUnitOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "stockout",
      purchaseQuantity: 99,
      item: {
        unit: "lb",
        canonical_unit: "g",
        canonical_quantity_per_unit: null,
        canonical_unit_verification_status: "verified"
      },
      effectiveAt: "2026-11-10T18:00:00.000Z",
      note: "Empty case"
    });
    assert.equal(stockout.event.quantity, 0);
    assert.deepEqual(stockout.event.metadata, { note: "Empty case" });
  } finally {
    restore();
  }
});

test("purchase-unit evidence is all-or-nothing and overflow fails closed", () => {
  assert.throws(
    () =>
      requireInventoryOperation({
        restaurantId: "restaurant-a",
        inventoryItemId: "chicken",
        eventType: "receipt",
        quantity: 907.184,
        canonicalUnit: "g",
        effectiveAt: "2026-11-10T18:00:00.000Z",
        purchaseUnitQuantity: 2,
        purchaseUnit: "lb"
      }),
    /must include quantity, unit, and conversion/
  );
  assert.throws(
    () =>
      resolveOperatorPurchaseUnitQuantity({
        purchaseQuantity: 2,
        item: {
          ...verifiedItem,
          canonical_unit_verification_status: "draft"
        }
      }),
    /not verified/
  );
  assert.throws(
    () =>
      purchaseUnitsToCanonicalOperatorQuantity({
        purchaseQuantity: 1_000_000,
        canonicalQuantityPerUnit: 1_000_000_000
      }),
    /outside supported limits/
  );
});

test("inventory detail and Log Delivery collect purchase-unit quantities", () => {
  assert.match(identitySource, /purchaseUnitsToCanonicalOperatorQuantity/);
  assert.match(inventorySource, /queueInventoryPurchaseUnitOperation/);
  assert.match(inventorySource, /inventory\.ops\.purchaseUnitHint/);
  assert.match(inventorySource, /unit: item\.unit/);
  assert.match(logDeliverySource, /queueInventoryPurchaseUnitOperation/);
  assert.match(logDeliverySource, /unit: selected\.unit/);
  assert.match(catalogSource, /"inventory\.ops\.purchaseUnitHint"/);
  assert.match(
    catalogSource,
    /"logDelivery\.form\.helper": "On hand \{qty\} \{displayUnit\}\. Enter the receipt in \{displayUnit\}/
  );
});
