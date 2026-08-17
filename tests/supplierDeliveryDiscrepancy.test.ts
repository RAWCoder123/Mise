import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createInitialDemoState, DEMO_RESTAURANT_ID } from "../services/demoData";
import {
  applyDeliveryLineAdjustments,
  buildDeliveryLinesFromOrderRecommendations,
  buildSupplierDeliveryReceivePreview,
  deliveryLineHasDiscrepancy,
  normalizeDeliveryLineDiscrepancy
} from "../services/domain/supplierDelivery";
import { normalizeInventoryItem } from "../services/miseValidation";
import type { PurchaseRecommendation, SupplierOrder } from "../types/mise";

function sampleOrderContext() {
  const state = createInitialDemoState("Toast", undefined, new Date("2026-08-17T15:00:00.000Z"));
  const item = normalizeInventoryItem(state.inventoryItems[0]!);
  const order: SupplierOrder = {
    id: "order-sent-1",
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_name: item.supplier_name,
    order_message: `${item.item_name} - 10 ${item.unit}`,
    operator_note: null,
    status: "sent",
    delivery_date: "2026-08-17",
    created_at: "2026-08-16T12:00:00.000Z"
  };
  const recommendation: PurchaseRecommendation = {
    id: "rec-ordered-1",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_name: item.supplier_name,
    recommended_quantity: 10,
    unit: item.unit,
    reason: "Included in the sent order.",
    urgency: "medium",
    status: "ordered",
    supplier_order_id: order.id,
    created_at: order.created_at
  };
  return { item, order, recommendation };
}

test("as-ordered delivery lines stay discrepancy-free until adjusted", () => {
  const { item, order, recommendation } = sampleOrderContext();
  const built = buildDeliveryLinesFromOrderRecommendations({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    requireVerifiedCanonicalUnit: false
  });
  assert.equal(built.lines.length, 1);
  assert.equal(built.lines[0]!.receivedQuantity, 10);
  assert.equal(built.lines[0]!.damagedQuantity, 0);
  assert.equal(built.lines[0]!.missingQuantity, 0);
  assert.equal(deliveryLineHasDiscrepancy(built.lines[0]!), false);
});

test("short-ship adjustments derive missing quantity and mark discrepancy", () => {
  const { item, order, recommendation } = sampleOrderContext();
  const built = buildDeliveryLinesFromOrderRecommendations({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    requireVerifiedCanonicalUnit: false
  });

  const adjusted = applyDeliveryLineAdjustments(built.lines, [
    {
      inventoryItemId: item.id,
      receivedQuantity: 7,
      damagedQuantity: 1,
      discrepancyReason: "Two cases short; one damaged pack"
    }
  ]);

  assert.equal(adjusted.length, 1);
  assert.equal(adjusted[0]!.orderedQuantity, 10);
  assert.equal(adjusted[0]!.receivedQuantity, 7);
  assert.equal(adjusted[0]!.damagedQuantity, 1);
  assert.equal(adjusted[0]!.missingQuantity, 3);
  assert.equal(adjusted[0]!.discrepancyReason, "Two cases short; one damaged pack");
  assert.equal(deliveryLineHasDiscrepancy(adjusted[0]!), true);
});

test("explicit missing quantity wins over derived short-ship math", () => {
  const { item, order, recommendation } = sampleOrderContext();
  const [line] = buildDeliveryLinesFromOrderRecommendations({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    requireVerifiedCanonicalUnit: false
  }).lines;

  const normalized = normalizeDeliveryLineDiscrepancy(line!, {
    inventoryItemId: item.id,
    receivedQuantity: 8,
    missingQuantity: 1,
    discrepancyReason: "Partial backorder acknowledged"
  });

  assert.equal(normalized.receivedQuantity, 8);
  assert.equal(normalized.missingQuantity, 1);
  assert.equal(normalized.discrepancyReason, "Partial backorder acknowledged");
});

test("adjustments reject unknown inventory lines and invalid damage", () => {
  const { item, order, recommendation } = sampleOrderContext();
  const built = buildDeliveryLinesFromOrderRecommendations({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    requireVerifiedCanonicalUnit: false
  });

  assert.throws(
    () =>
      applyDeliveryLineAdjustments(built.lines, [
        { inventoryItemId: "missing-item", receivedQuantity: 1 }
      ]),
    /unknown receivable line/i
  );

  assert.throws(
    () =>
      normalizeDeliveryLineDiscrepancy(built.lines[0]!, {
        inventoryItemId: item.id,
        receivedQuantity: 4,
        damagedQuantity: 5
      }),
    /cannot exceed received/i
  );
});

test("receive preview exposes item labels for the operator checklist", () => {
  const { item, order, recommendation } = sampleOrderContext();
  const preview = buildSupplierDeliveryReceivePreview({
    order,
    recommendations: [recommendation],
    inventoryItems: [item]
  });

  assert.equal(preview.lines.length, 1);
  assert.equal(preview.lines[0]!.inventoryItemId, item.id);
  assert.equal(preview.lines[0]!.itemName, item.item_name);
  assert.equal(preview.lines[0]!.orderedQuantity, 10);
  assert.equal(preview.lines[0]!.receivedQuantity, 10);
});

test("order detail receive UI collects per-line discrepancy edits before submit", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const deliveries = readFileSync("services/application/deliveries.ts", "utf8");

  assert.match(detail, /previewSupplierOrderDelivery/);
  assert.match(detail, /lineAdjustments/);
  assert.match(detail, /receiveDrafts/);
  assert.match(detail, /t\("orders\.detail\.receive\.title"\)/);
  assert.match(detail, /t\("orders\.detail\.receive\.received"\)/);
  assert.match(detail, /t\("orders\.detail\.receive\.damaged"\)/);
  assert.match(detail, /t\("orders\.detail\.receive\.reason"\)/);
  assert.match(detail, /t\("orders\.detail\.receive\.resetAsOrdered"\)/);
  assert.match(detail, /receiveSupplierOrderDelivery\(restaurantId, order\.id, \{[\s\S]*lineAdjustments/);
  assert.doesNotMatch(detail, /receiveSupplierOrderDelivery\(restaurantId, order\.id\)\s*;/);

  assert.match(deliveries, /lineAdjustments\?:/);
  assert.match(deliveries, /applyDeliveryLineAdjustments/);
  assert.match(deliveries, /previewSupplierOrderDelivery/);

  assert.match(catalog, /"orders\.detail\.receive\.title":/);
  assert.match(catalog, /"orders\.detail\.receive\.validation\.received"/);
  assert.match(catalog, /"orders\.detail\.receive\.validation\.damaged"/);
});
