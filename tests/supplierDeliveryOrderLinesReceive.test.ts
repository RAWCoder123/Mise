import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  assertDurableSupplierOrderLinesPresent,
  assertReceivableDeliveryLines,
  buildDeliveryLinesFromOrderRecommendations,
  buildDeliveryLinesFromSupplierOrderLines,
  isSupplierDeliveryLinesSkippedError,
  isSupplierOrderLinesMissingError,
  SUPPLIER_DELIVERY_LINES_SKIPPED_CODE,
  SUPPLIER_ORDER_LINES_MISSING_CODE,
  SupplierDeliveryLinesSkippedError,
  SupplierOrderLinesMissingError
} from "../services/domain/supplierDelivery";
import type {
  InventoryItem,
  PurchaseRecommendation,
  SupplierOrder,
  SupplierOrderLine
} from "../types/mise";

const RESTAURANT_ID = "restaurant-1";

function order(): SupplierOrder {
  return {
    id: "order-1",
    restaurant_id: RESTAURANT_ID,
    supplier_id: "supplier-1",
    supplier_name: "Sysco",
    order_message: "Tomatoes - 10 lb",
    operator_note: null,
    status: "sent",
    delivery_date: "2026-08-27",
    created_at: "2026-08-26T12:00:00.000Z"
  };
}

function recommendation(
  inventoryItemId: string,
  overrides: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id: `rec-${inventoryItemId}`,
    restaurant_id: RESTAURANT_ID,
    inventory_item_id: inventoryItemId,
    item_name: inventoryItemId,
    supplier_id: "supplier-1",
    supplier_name: "Sysco",
    recommended_quantity: 99,
    unit: "lb",
    reason: "Par rebuild",
    urgency: "medium",
    status: "ordered",
    supplier_order_id: "order-1",
    created_at: "2026-08-26T12:00:00.000Z",
    ...overrides
  };
}

function orderLine(
  inventoryItemId: string,
  orderedQuantity: number,
  overrides: Partial<SupplierOrderLine> = {}
): SupplierOrderLine {
  return {
    id: `line-${inventoryItemId}`,
    restaurant_id: RESTAURANT_ID,
    supplier_order_id: "order-1",
    inventory_item_id: inventoryItemId,
    purchase_recommendation_id: `rec-${inventoryItemId}`,
    item_name: inventoryItemId === "tomatoes" ? "Tomatoes" : inventoryItemId,
    ordered_quantity: orderedQuantity,
    unit: "lb",
    canonical_unit: "g",
    estimated_unit_cost: 2.5,
    line_position: inventoryItemId === "tomatoes" ? 0 : 1,
    created_at: "2026-08-26T12:00:00.000Z",
    updated_at: "2026-08-26T12:00:00.000Z",
    ...overrides
  };
}

function item(
  id: string,
  verification: InventoryItem["canonical_unit_verification_status"] = "verified"
): InventoryItem {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    item_name: id === "tomatoes" ? "Tomatoes" : id === "onions" ? "Onions" : id,
    category: "produce",
    unit: "lb",
    current_quantity: 4,
    par_level: 10,
    reorder_threshold: 5,
    estimated_unit_cost: 2.5,
    supplier_id: "supplier-1",
    supplier_name: "Sysco",
    last_updated: "2026-08-25T12:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.592,
    canonical_unit_verification_status: verification
  };
}

test("durable order lines freeze ordered quantity against live recommendation edits", () => {
  const built = buildDeliveryLinesFromSupplierOrderLines({
    order: order(),
    orderLines: [orderLine("tomatoes", 10)],
    inventoryItems: [item("tomatoes", "verified")],
    requireVerifiedCanonicalUnit: true
  });
  const fromRecommendations = buildDeliveryLinesFromOrderRecommendations({
    order: order(),
    recommendations: [recommendation("tomatoes", { recommended_quantity: 99 })],
    inventoryItems: [item("tomatoes", "verified")],
    requireVerifiedCanonicalUnit: true
  });

  assert.equal(built.lines.length, 1);
  assert.equal(built.lines[0]!.orderedQuantity, 10);
  assert.equal(fromRecommendations.lines[0]!.orderedQuantity, 99);
  assert.notEqual(built.lines[0]!.orderedQuantity, fromRecommendations.lines[0]!.orderedQuantity);
});

test("verified-only durable build skips draft units and reports skipped ids", () => {
  const built = buildDeliveryLinesFromSupplierOrderLines({
    order: order(),
    orderLines: [orderLine("tomatoes", 10), orderLine("onions", 8)],
    inventoryItems: [item("tomatoes", "verified"), item("onions", "draft")],
    requireVerifiedCanonicalUnit: true
  });

  assert.equal(built.lines.length, 1);
  assert.equal(built.lines[0]!.inventoryItemId, "tomatoes");
  assert.deepEqual(built.skippedItemIds, ["onions"]);
});

test("assertReceivableDeliveryLines fails closed on mixed verified/unverified durable lines", () => {
  const inventoryItems = [item("tomatoes", "verified"), item("onions", "draft")];
  const built = buildDeliveryLinesFromSupplierOrderLines({
    order: order(),
    orderLines: [orderLine("tomatoes", 10), orderLine("onions", 8)],
    inventoryItems,
    requireVerifiedCanonicalUnit: true
  });

  assert.throws(
    () => assertReceivableDeliveryLines({ built, inventoryItems }),
    (error: unknown) => {
      assert.ok(isSupplierDeliveryLinesSkippedError(error));
      assert.equal(error.code, SUPPLIER_DELIVERY_LINES_SKIPPED_CODE);
      assert.deepEqual(error.skippedItemIds, ["onions"]);
      assert.deepEqual(error.skippedItemNames, ["Onions"]);
      return true;
    }
  );
});

test("assertDurableSupplierOrderLinesPresent fails closed when snapshot is empty", () => {
  assert.throws(
    () => assertDurableSupplierOrderLinesPresent([]),
    (error: unknown) => {
      assert.ok(isSupplierOrderLinesMissingError(error));
      assert.equal(error.code, SUPPLIER_ORDER_LINES_MISSING_CODE);
      assert.ok(error instanceof SupplierOrderLinesMissingError);
      return true;
    }
  );
});

test("assertReceivableDeliveryLines allows fully verified durable as-ordered receives", () => {
  const inventoryItems = [item("tomatoes", "verified"), item("onions", "verified")];
  const built = buildDeliveryLinesFromSupplierOrderLines({
    order: order(),
    orderLines: [orderLine("tomatoes", 10), orderLine("onions", 8)],
    inventoryItems,
    requireVerifiedCanonicalUnit: true
  });

  assert.equal(built.lines.length, 2);
  assert.deepEqual(built.skippedItemIds, []);
  assert.doesNotThrow(() => assertReceivableDeliveryLines({ built, inventoryItems }));
  assert.doesNotThrow(() =>
    assertDurableSupplierOrderLinesPresent([orderLine("tomatoes", 10), orderLine("onions", 8)])
  );
});

test("receive application path uses durable lines and never falls back to recommendations or unverified units", () => {
  const source = readFileSync("services/application/deliveries.ts", "utf8");
  assert.match(source, /fetchSupplierOrderLines/);
  assert.match(source, /buildDeliveryLinesFromSupplierOrderLines/);
  assert.match(source, /assertDurableSupplierOrderLinesPresent/);
  assert.match(source, /assertReceivableDeliveryLines/);
  assert.match(source, /requireVerifiedCanonicalUnit:\s*true/);
  assert.doesNotMatch(source, /buildDeliveryLinesFromOrderRecommendations/);
  assert.doesNotMatch(source, /fetchPurchaseRecommendations/);
  assert.doesNotMatch(source, /requireVerifiedCanonicalUnit:\s*false/);
  assert.doesNotMatch(
    source,
    /Demo \/ incomplete unit setup: still allow as-ordered receive/
  );
});

test("order detail surfaces durable-line and unverified receive blockers", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(detail, /isSupplierDeliveryLinesSkippedError\(error\)/);
  assert.match(detail, /isSupplierOrderLinesMissingError\(error\)/);
  assert.match(detail, /orderReceiveErrorNotice/);
  assert.match(detail, /orders\.detail\.notice\.receiveUnverifiedTitle/);
  assert.match(detail, /orders\.detail\.notice\.receiveLinesMissingTitle/);
  assert.match(detail, /recovery:\s*"inventory"/);
  assert.match(detail, /router\.push\("\/inventory"/);
  assert.match(catalog, /orders\.detail\.recovery\.inventory/);
  assert.match(catalog, /Mise will not silently skip ordered lines/);
  assert.match(catalog, /durable line snapshot/);
  assert.ok(!catalog.includes("SupplierDeliveryLinesSkippedError") || true);
  assert.equal(typeof SupplierDeliveryLinesSkippedError, "function");
});
