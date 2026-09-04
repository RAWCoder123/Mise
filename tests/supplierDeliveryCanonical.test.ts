import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { purchaseUnitsToCanonicalQuantity } from "../services/domain/supplierDeliveryCanonical";
import {
  buildDeliveryLinesFromOrderRecommendations,
  deliveryClientIdForOrder
} from "../services/domain/supplierDelivery";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";

test("purchaseUnitsToCanonicalQuantity multiplies purchase units by conversion factor", () => {
  assert.equal(
    purchaseUnitsToCanonicalQuantity({
      purchaseQuantity: 24,
      canonicalQuantityPerUnit: 453.592
    }),
    24 * 453.592
  );
  assert.equal(
    purchaseUnitsToCanonicalQuantity({
      purchaseQuantity: 1,
      canonicalQuantityPerUnit: 1000
    }),
    1000
  );
});

test("purchaseUnitsToCanonicalQuantity rejects invalid purchase or conversion values", () => {
  assert.throws(() =>
    purchaseUnitsToCanonicalQuantity({ purchaseQuantity: -1, canonicalQuantityPerUnit: 10 })
  );
  assert.throws(() =>
    purchaseUnitsToCanonicalQuantity({ purchaseQuantity: 1, canonicalQuantityPerUnit: 0 })
  );
  assert.throws(() =>
    purchaseUnitsToCanonicalQuantity({ purchaseQuantity: Number.NaN, canonicalQuantityPerUnit: 10 })
  );
});

test("delivery line builder keeps purchase-unit quantities while labeling ledger unit", () => {
  const order = {
    id: "order-1",
    restaurant_id: "rest-1",
    supplier_id: "sup-1",
    supplier_name: "Sysco",
    status: "sent",
    created_at: "2026-09-04T00:00:00.000Z"
  } as SupplierOrder;
  const item = {
    id: "item-1",
    restaurant_id: "rest-1",
    item_name: "Chicken",
    unit: "lb",
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.592,
    canonical_unit_verification_status: "verified",
    supplier_id: "sup-1",
    supplier_name: "Sysco"
  } as InventoryItem;
  const recommendation = {
    id: "rec-1",
    restaurant_id: "rest-1",
    inventory_item_id: "item-1",
    item_name: "Chicken",
    supplier_id: "sup-1",
    supplier_name: "Sysco",
    recommended_quantity: 24,
    unit: "lb",
    reason: "Par rebuild",
    urgency: "medium",
    status: "ordered",
    supplier_order_id: "order-1",
    created_at: "2026-09-04T00:00:00.000Z"
  } as PurchaseRecommendation;

  const built = buildDeliveryLinesFromOrderRecommendations({
    order,
    recommendations: [recommendation],
    inventoryItems: [item]
  });
  assert.equal(built.lines.length, 1);
  assert.equal(built.lines[0]!.receivedQuantity, 24);
  assert.equal(built.lines[0]!.orderedQuantity, 24);
  assert.equal(built.lines[0]!.canonicalUnit, "g");
  assert.equal(
    purchaseUnitsToCanonicalQuantity({
      purchaseQuantity: built.lines[0]!.receivedQuantity,
      canonicalQuantityPerUnit: item.canonical_quantity_per_unit!
    }),
    24 * 453.592
  );
});

test("additive migration converts purchase-unit delivery receipts before ledger write", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260904090000_supplier_delivery_canonical_receipt_quantity.sql"
    ),
    "utf8"
  );
  assert.match(migration, /record_supplier_delivery_mise_003b_name_base/i);
  assert.match(
    migration,
    /purchase_net_quantity\s*\*\s*target_item_row\.canonical_quantity_per_unit/i
  );
  assert.match(migration, /purchaseUnitQuantity/i);
  assert.match(migration, /canonicalQuantityPerUnit/i);
  // Delivery item rows remain purchase-unit evidence.
  assert.match(
    migration,
    /insert into public\.supplier_delivery_items[\s\S]*received_quantity, damaged_quantity, missing_quantity, line_canonical_unit/i
  );
});

test("demo supplier receive writes converted canonical ledger receipts and native on-hand", async () => {
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
  const { DEMO_RESTAURANT_ID } = await import("../services/demo/replaceableDemoData");
  const { setMiseRepositoryForTesting } = await import("../services/application/repository");
  const repository = createLocalDemoRepository();
  const restoreRepository = setMiseRepositoryForTesting(repository);
  try {
    await repository.resetDemoData(null);

    const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
    const item = items[0]!;
    const factor = 453.592;
    await repository.verifyInventoryItemCanonicalUnit(DEMO_RESTAURANT_ID, item.id, "g", factor);

    const storageKey = [...values.keys()].find((key) => key.includes("demo-store"));
    assert.ok(storageKey);
    const seeded = JSON.parse(values.get(storageKey)!) as {
      supplierOrders: Array<Record<string, unknown>>;
    };
    const orderRow = seeded.supplierOrders[0];
    assert.ok(orderRow);
    orderRow.status = "sent";
    values.set(storageKey, JSON.stringify(seeded));

    const order = (await repository.fetchSupplierOrders(DEMO_RESTAURANT_ID)).find(
      (entry) => entry.id === orderRow.id
    );
    assert.ok(order);
    assert.equal(order.status, "sent");

    const purchaseQty = 24;
    const verifiedItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
    const verifiedItem = verifiedItems.find((entry) => entry.id === item.id)!;
    assert.equal(verifiedItem.canonical_unit_verification_status, "verified");

    const built = buildDeliveryLinesFromOrderRecommendations({
      order,
      recommendations: [
        {
          id: "rec-delivery-canonical-1",
          restaurant_id: DEMO_RESTAURANT_ID,
          inventory_item_id: item.id,
          item_name: item.item_name,
          supplier_id: order.supplier_id,
          supplier_name: order.supplier_name,
          recommended_quantity: purchaseQty,
          unit: item.unit,
          reason: "Canonical receive conversion fixture.",
          urgency: "medium",
          status: "ordered",
          supplier_order_id: order.id,
          created_at: order.created_at
        } as PurchaseRecommendation
      ],
      inventoryItems: verifiedItems
    });
    assert.equal(built.lines.length, 1);
    assert.equal(built.lines[0]!.receivedQuantity, purchaseQty);
    assert.equal(built.lines[0]!.canonicalUnit, "g");

    const before = verifiedItem.current_quantity;
    const receivedAt = "2026-09-04T16:00:00.000Z";
    const result = await repository.recordSupplierOrderDelivery(DEMO_RESTAURANT_ID, {
      supplierOrderId: order.id,
      clientDeliveryId: deliveryClientIdForOrder(order.id, receivedAt),
      receivedAt,
      lines: built.lines,
      notes: null
    });
    assert.equal(result.outcome, "applied");

    const after = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).find(
      (entry) => entry.id === item.id
    )!;
    assert.ok(Math.abs(after.current_quantity - (before + purchaseQty)) < 0.001);

    const stored = JSON.parse(values.get(storageKey)!) as {
      inventoryEvents: Array<{
        eventType: string;
        source: string;
        inventoryItemId: string;
        quantity: number;
        canonicalUnit: string;
        metadata?: Record<string, unknown>;
      }>;
    };
    const receipt = stored.inventoryEvents.find(
      (event) =>
        event.eventType === "receipt" &&
        event.source === "supplier_delivery" &&
        event.inventoryItemId === item.id
    );
    assert.ok(receipt);
    assert.equal(receipt.canonicalUnit, "g");
    assert.equal(receipt.quantity, purchaseQty * factor);
    assert.equal(receipt.metadata?.purchaseUnitQuantity, purchaseQty);
    assert.equal(receipt.metadata?.canonicalQuantityPerUnit, factor);
  } finally {
    restoreRepository();
  }
});
