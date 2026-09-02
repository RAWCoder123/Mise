import assert from "node:assert/strict";
import test from "node:test";

import { createInitialDemoState, DEMO_DATASET, DEMO_RESTAURANT_ID } from "../services/demoData";
import { selectInvoiceUnitCostApplyCandidate } from "../services/domain/invoiceUnitCostApply";
import { normalizeSupplierDeliveryItemRecord } from "../services/miseValidation";

test("demo seed exposes a rice invoice unit-cost apply candidate", () => {
  const state = createInitialDemoState("Toast", { preset: DEMO_DATASET.id });
  const riceId = "00000000-0000-4000-8000-000000000103";
  const rice = state.inventoryItems.find((item) => item.id === riceId);
  assert.ok(rice, "reference demo should retain the rice inventory item");

  const deliveries = (state.supplierDeliveries ?? []).filter(
    (delivery) => delivery.restaurant_id === DEMO_RESTAURANT_ID
  );
  const items = (state.supplierDeliveryItems ?? [])
    .filter((item) => item.restaurant_id === DEMO_RESTAURANT_ID)
    .map((item) => normalizeSupplierDeliveryItemRecord(item as never));

  const pricedRice = items.find(
    (item) => item.inventory_item_id === riceId && item.unit_price != null
  );
  assert.ok(pricedRice, "rice delivery line should carry a seeded invoice unit price");
  assert.equal(pricedRice?.unit_price, 1.05);
  assert.notEqual(rice!.estimated_unit_cost, 1.05);

  const candidate = selectInvoiceUnitCostApplyCandidate({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItem: rice!,
    deliveries: deliveries.map((delivery) => ({
      id: delivery.id,
      restaurant_id: delivery.restaurant_id,
      supplier_order_id: delivery.supplier_order_id,
      status: delivery.status as "received",
      received_at: delivery.received_at,
      notes: delivery.notes ?? null,
      created_at: delivery.created_at
    })),
    deliveryItems: items
  });

  assert.ok(candidate);
  assert.equal(candidate?.unitPrice, 1.05);
  assert.equal(candidate?.previousUnitCost, rice!.estimated_unit_cost);
  assert.equal(candidate?.deliveryItemId, pricedRice?.id);
});
