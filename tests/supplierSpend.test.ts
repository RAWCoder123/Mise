import assert from "node:assert/strict";
import test from "node:test";

import type { PurchaseLine } from "../services/domain/purchaseLines";
import {
  buildInvoiceSupplierSpendTrend,
  buildSupplierSpendTrend,
  resolveSupplierSpendTrend
} from "../services/domain/supplierSpend";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";

const restaurantId = "rest_1";
const supplierId = "00000000-0000-4000-8000-000000000501";

function inventory(id: string, cost: number): InventoryItem {
  return {
    id,
    restaurant_id: restaurantId,
    item_name: id,
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 5,
    supplier_id: supplierId,
    supplier_name: "Metro",
    estimated_unit_cost: cost,
    last_updated: "2026-07-20T12:00:00.000Z"
  };
}

function order(id: string, status: SupplierOrder["status"], createdAt: string): SupplierOrder {
  return {
    id,
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: "Metro",
    order_message: "hello",
    operator_note: null,
    status,
    delivery_date: "2026-07-21",
    created_at: createdAt
  };
}

function recommendation(
  orderId: string,
  itemId: string,
  quantity: number,
  status: PurchaseRecommendation["status"] = "ordered"
): PurchaseRecommendation {
  return {
    id: `rec_${orderId}_${itemId}`,
    restaurant_id: restaurantId,
    inventory_item_id: itemId,
    item_name: itemId,
    supplier_id: supplierId,
    supplier_name: "Metro",
    recommended_quantity: quantity,
    unit: "lb",
    reason: "low",
    urgency: "medium",
    status,
    supplier_order_id: orderId,
    created_at: "2026-07-20T12:00:00.000Z"
  };
}

function purchaseLine(input: {
  id: string;
  transactionDate: string;
  signedExtendedPrice: number | null;
  currency?: string | null;
  supersedesLineId?: string | null;
  restaurantId?: string;
}): PurchaseLine {
  return {
    id: input.id,
    restaurantId: input.restaurantId ?? restaurantId,
    supplierId,
    lineIndex: 0,
    revision: 1,
    lineType: input.signedExtendedPrice !== null && input.signedExtendedPrice < 0 ? "credit" : "purchase",
    rawItemDescription: "Tomatoes",
    normalizedItemKey: "tomatoes",
    normalizationVersion: "mise.purchase_line_normalization.v1",
    quantity: 1,
    unitOfMeasure: "case",
    packSize: null,
    unitPrice: null,
    extendedPrice:
      input.signedExtendedPrice === null ? null : Math.abs(input.signedExtendedPrice),
    currency: input.currency === undefined ? "USD" : input.currency,
    transactionDate: input.transactionDate,
    receivedDate: null,
    source: "invoice",
    sourceDocumentReference: "INV-1",
    correlationId: "corr_1",
    parseConfidence: "confirmed",
    consistencyFlags: [],
    signedQuantity: 1,
    signedExtendedPrice: input.signedExtendedPrice,
    creditsLineId: null,
    supersedesLineId: input.supersedesLineId ?? null,
    evidenceVersion: "mise.purchase_line.v1",
    recordedBy: null,
    recordedAt: "2026-07-20T12:00:00.000Z"
  };
}

test("supplier spend trend prices ordered lines by inventory unit cost and buckets by restaurant timezone", () => {
  const points = buildSupplierSpendTrend(
    restaurantId,
    [
      order("o1", "sent", "2026-07-20T22:30:00.000Z"),
      order("o2", "completed", "2026-07-21T18:00:00.000Z"),
      order("o3", "draft", "2026-07-21T19:00:00.000Z")
    ],
    [
      recommendation("o1", "item_a", 2),
      recommendation("o2", "item_a", 3),
      recommendation("o2", "item_b", 1),
      recommendation("o3", "item_a", 99)
    ],
    [inventory("item_a", 10), inventory("item_b", 4)],
    { timeZone: "America/New_York", limit: 6 }
  );

  assert.deepEqual(points, [
    { date: "2026-07-20", spend: 20 },
    { date: "2026-07-21", spend: 34 }
  ]);
});

test("supplier spend trend ignores unpriced lines and foreign restaurants", () => {
  const points = buildSupplierSpendTrend(
    restaurantId,
    [order("o1", "sent", "2026-07-21T12:00:00.000Z")],
    [
      recommendation("o1", "missing_item", 5),
      { ...recommendation("o1", "item_a", 2), restaurant_id: "other" }
    ],
    [inventory("item_a", 10)]
  );

  assert.deepEqual(points, []);
});

test("invoice supplier spend nets credits against purchases by transaction date", () => {
  const points = buildInvoiceSupplierSpendTrend(
    restaurantId,
    [
      purchaseLine({ id: "pl1", transactionDate: "2026-07-20", signedExtendedPrice: 40 }),
      purchaseLine({ id: "pl2", transactionDate: "2026-07-20", signedExtendedPrice: -5 }),
      purchaseLine({ id: "pl3", transactionDate: "2026-07-21", signedExtendedPrice: 12.345 }),
      purchaseLine({
        id: "pl_foreign",
        transactionDate: "2026-07-21",
        signedExtendedPrice: 999,
        restaurantId: "other"
      }),
      purchaseLine({
        id: "pl_null",
        transactionDate: "2026-07-22",
        signedExtendedPrice: null
      })
    ],
    { currency: "USD", limit: 6 }
  );

  assert.deepEqual(points, [
    { date: "2026-07-20", spend: 35 },
    { date: "2026-07-21", spend: 12.35 }
  ]);
});

test("invoice supplier spend ignores superseded history and mismatched currencies", () => {
  const points = buildInvoiceSupplierSpendTrend(
    restaurantId,
    [
      purchaseLine({ id: "old", transactionDate: "2026-07-19", signedExtendedPrice: 100 }),
      purchaseLine({
        id: "new",
        transactionDate: "2026-07-19",
        signedExtendedPrice: 80,
        supersedesLineId: "old"
      }),
      purchaseLine({
        id: "eur",
        transactionDate: "2026-07-20",
        signedExtendedPrice: 50,
        currency: "EUR"
      }),
      purchaseLine({ id: "usd", transactionDate: "2026-07-21", signedExtendedPrice: 10 })
    ],
    { currency: "USD" }
  );

  assert.deepEqual(points, [
    { date: "2026-07-19", spend: 80 },
    { date: "2026-07-21", spend: 10 }
  ]);
});

test("resolveSupplierSpendTrend prefers invoice evidence once two dated buckets exist", () => {
  const estimatedOrders = [
    order("o1", "sent", "2026-07-20T22:30:00.000Z"),
    order("o2", "completed", "2026-07-21T18:00:00.000Z")
  ];
  const estimatedRecommendations = [
    recommendation("o1", "item_a", 2),
    recommendation("o2", "item_a", 3)
  ];
  const items = [inventory("item_a", 10)];

  const invoiceBacked = resolveSupplierSpendTrend({
    restaurantId,
    purchaseLines: [
      purchaseLine({ id: "pl1", transactionDate: "2026-07-18", signedExtendedPrice: 11 }),
      purchaseLine({ id: "pl2", transactionDate: "2026-07-19", signedExtendedPrice: 22 })
    ],
    orders: estimatedOrders,
    recommendations: estimatedRecommendations,
    inventoryItems: items,
    options: { currency: "USD", timeZone: "America/New_York" }
  });

  assert.equal(invoiceBacked.basis, "invoice_lines");
  assert.deepEqual(invoiceBacked.points, [
    { date: "2026-07-18", spend: 11 },
    { date: "2026-07-19", spend: 22 }
  ]);

  const estimatedFallback = resolveSupplierSpendTrend({
    restaurantId,
    purchaseLines: [
      purchaseLine({ id: "pl1", transactionDate: "2026-07-18", signedExtendedPrice: 11 })
    ],
    orders: estimatedOrders,
    recommendations: estimatedRecommendations,
    inventoryItems: items,
    options: { currency: "USD", timeZone: "America/New_York" }
  });

  assert.equal(estimatedFallback.basis, "estimated_orders");
  assert.deepEqual(estimatedFallback.points, [
    { date: "2026-07-20", spend: 20 },
    { date: "2026-07-21", spend: 30 }
  ]);
});

test("invoice supplier spend refuses mixed explicit currencies without a restaurant currency", () => {
  const points = buildInvoiceSupplierSpendTrend(restaurantId, [
    purchaseLine({ id: "usd", transactionDate: "2026-07-18", signedExtendedPrice: 10, currency: "USD" }),
    purchaseLine({ id: "eur", transactionDate: "2026-07-19", signedExtendedPrice: 10, currency: "EUR" })
  ]);

  assert.deepEqual(points, []);
});
