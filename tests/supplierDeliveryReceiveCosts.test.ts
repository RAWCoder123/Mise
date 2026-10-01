import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyDeliveryLineUnitPrices,
  buildDeliveryLinesFromOrderRecommendations,
  buildDeliveryReceiveCostPreview,
  normalizeDeliveryInvoiceTotal
} from "../services/domain/supplierDelivery";
import { operatingLimits } from "../services/miseValidation";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";

const RESTAURANT_ID = "restaurant-a";
const ORDER_ID = "order-1";
const ITEM_A = "item-a";
const ITEM_B = "item-b";

function inventoryItem(
  id: string,
  name: string,
  overrides: Partial<InventoryItem> = {}
): InventoryItem {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    item_name: name,
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 2.5,
    supplier_id: "supplier-1",
    supplier_name: "Produce Co.",
    last_updated: "2026-08-31T00:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.59237,
    canonical_unit_verification_status: "verified",
    ...overrides
  };
}

function recommendation(
  id: string,
  inventoryItemId: string,
  quantity: number
): PurchaseRecommendation {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    inventory_item_id: inventoryItemId,
    item_name: inventoryItemId,
    recommended_quantity: quantity,
    unit: "lb",
    reason: "low stock",
    urgency: "medium",
    status: "ordered",
    supplier_id: "supplier-1",
    supplier_name: "Produce Co.",
    supplier_order_id: ORDER_ID,
    created_at: "2026-08-31T00:00:00.000Z"
  };
}

function order(): SupplierOrder {
  return {
    id: ORDER_ID,
    restaurant_id: RESTAURANT_ID,
    supplier_id: "supplier-1",
    supplier_name: "Produce Co.",
    order_message: "Please deliver",
    operator_note: null,
    status: "sent",
    delivery_date: "2026-08-31",
    created_at: "2026-08-30T12:00:00.000Z"
  };
}

test("receive cost preview lists verified as-ordered lines with display units", () => {
  const preview = buildDeliveryReceiveCostPreview({
    order: order(),
    recommendations: [
      recommendation("rec-1", ITEM_A, 12),
      recommendation("rec-2", ITEM_B, 4)
    ],
    inventoryItems: [
      inventoryItem(ITEM_A, "Romaine"),
      inventoryItem(ITEM_B, "Lemons", { unit: "case", canonical_unit: "each" })
    ]
  });

  assert.equal(preview.skippedItemIds.length, 0);
  assert.equal(preview.lines.length, 2);
  assert.equal(preview.lines[0]?.itemName, "Romaine");
  assert.equal(preview.lines[0]?.orderedQuantity, 12);
  assert.equal(preview.lines[0]?.displayUnit, "lb");
  assert.equal(preview.lines[1]?.itemName, "Lemons");
  assert.equal(preview.lines[1]?.displayUnit, "case");
});

test("unit prices apply to known lines and reject unknown inventory ids", () => {
  const built = buildDeliveryLinesFromOrderRecommendations({
    order: order(),
    recommendations: [recommendation("rec-1", ITEM_A, 12)],
    inventoryItems: [inventoryItem(ITEM_A, "Romaine")]
  });

  const priced = applyDeliveryLineUnitPrices(built.lines, {
    [ITEM_A]: 3.25
  });
  assert.equal(priced[0]?.unitPrice, 3.25);

  const cleared = applyDeliveryLineUnitPrices(built.lines, {
    [ITEM_A]: null
  });
  assert.equal(cleared[0]?.unitPrice, null);

  assert.throws(
    () =>
      applyDeliveryLineUnitPrices(built.lines, {
        "missing-item": 1
      }),
    /unknown ordered line/
  );

  assert.throws(
    () =>
      applyDeliveryLineUnitPrices(built.lines, {
        [ITEM_A]: operatingLimits.unitPrice + 1
      }),
    /Unit price must be between/
  );
});

test("invoice total normalization matches hosted RPC bounds", () => {
  assert.equal(normalizeDeliveryInvoiceTotal(null), null);
  assert.equal(normalizeDeliveryInvoiceTotal(""), null);
  assert.equal(normalizeDeliveryInvoiceTotal(125.5), 125.5);
  assert.throws(
    () => normalizeDeliveryInvoiceTotal(operatingLimits.invoiceTotal + 1),
    /Invoice total must be between/
  );
  assert.throws(() => normalizeDeliveryInvoiceTotal(-1), /Invoice total must be between/);
});

test("order detail wires optional invoice total and per-line unit price capture", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const deliveries = readFileSync("services/application/deliveries.ts", "utf8");
  const supabase = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");

  assert.match(detail, /previewSupplierOrderDeliveryCosts/);
  assert.match(detail, /orders\.detail\.receiveCosts\.title/);
  assert.match(detail, /invoiceTotal:/);
  assert.match(detail, /unitPricesByOrderedItemId:/);
  assert.match(detail, /orders\.detail\.deliveryEvidence\.invoiceTotal/);
  assert.match(deliveries, /invoiceTotal/);
  assert.match(deliveries, /applyDeliveryLineUnitPrices/);
  assert.match(supabase, /invoice_total/);
  assert.match(supabase, /unit_price/);
  assert.match(demo, /invoice_total: input\.invoiceTotal/);
  assert.match(demo, /unit_price: line\.unitPrice/);
});
