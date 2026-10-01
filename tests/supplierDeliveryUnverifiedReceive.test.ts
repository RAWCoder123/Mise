import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  assertReceivableDeliveryLines,
  buildDeliveryLinesFromOrderRecommendations,
  isSupplierDeliveryLinesSkippedError,
  SUPPLIER_DELIVERY_LINES_SKIPPED_CODE,
  SupplierDeliveryLinesSkippedError
} from "../services/domain/supplierDelivery";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";

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
    delivery_date: "2026-08-26",
    created_at: "2026-08-25T12:00:00.000Z"
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
    recommended_quantity: 10,
    unit: "lb",
    reason: "Par rebuild",
    urgency: "medium",
    status: "ordered",
    supplier_order_id: "order-1",
    created_at: "2026-08-25T12:00:00.000Z",
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
    last_updated: "2026-08-24T12:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.592,
    canonical_unit_verification_status: verification
  };
}

test("verified-only build skips draft units and reports skipped ids", () => {
  const built = buildDeliveryLinesFromOrderRecommendations({
    order: order(),
    recommendations: [recommendation("tomatoes"), recommendation("onions")],
    inventoryItems: [item("tomatoes", "verified"), item("onions", "draft")],
    requireVerifiedCanonicalUnit: true
  });

  assert.equal(built.lines.length, 1);
  assert.equal(built.lines[0]!.inventoryItemId, "tomatoes");
  assert.deepEqual(built.skippedItemIds, ["onions"]);
});

test("assertReceivableDeliveryLines fails closed on mixed verified/unverified orders", () => {
  const built = buildDeliveryLinesFromOrderRecommendations({
    order: order(),
    recommendations: [recommendation("tomatoes"), recommendation("onions")],
    inventoryItems: [item("tomatoes", "verified"), item("onions", "draft")],
    requireVerifiedCanonicalUnit: true
  });

  assert.throws(
    () => assertReceivableDeliveryLines({ built, inventoryItems: [item("tomatoes"), item("onions", "draft")] }),
    (error: unknown) => {
      assert.ok(isSupplierDeliveryLinesSkippedError(error));
      assert.equal(error.code, SUPPLIER_DELIVERY_LINES_SKIPPED_CODE);
      assert.deepEqual(error.skippedItemIds, ["onions"]);
      assert.deepEqual(error.skippedItemNames, ["Onions"]);
      return true;
    }
  );
});

test("assertReceivableDeliveryLines fails closed when every line is unverified", () => {
  const built = buildDeliveryLinesFromOrderRecommendations({
    order: order(),
    recommendations: [recommendation("onions")],
    inventoryItems: [item("onions", "draft")],
    requireVerifiedCanonicalUnit: true
  });

  assert.equal(built.lines.length, 0);
  assert.throws(
    () => assertReceivableDeliveryLines({ built, inventoryItems: [item("onions", "draft")] }),
    SupplierDeliveryLinesSkippedError
  );
});

test("assertReceivableDeliveryLines allows fully verified as-ordered receives", () => {
  const inventoryItems = [item("tomatoes", "verified"), item("onions", "verified")];
  const built = buildDeliveryLinesFromOrderRecommendations({
    order: order(),
    recommendations: [recommendation("tomatoes"), recommendation("onions")],
    inventoryItems,
    requireVerifiedCanonicalUnit: true
  });

  assert.equal(built.lines.length, 2);
  assert.deepEqual(built.skippedItemIds, []);
  assert.doesNotThrow(() => assertReceivableDeliveryLines({ built, inventoryItems }));
});

test("receive application path never falls back to unverified units", () => {
  const source = readFileSync("services/application/deliveries.ts", "utf8");
  assert.match(source, /assertReceivableDeliveryLines/);
  assert.match(source, /requireVerifiedCanonicalUnit:\s*true/);
  assert.doesNotMatch(source, /requireVerifiedCanonicalUnit:\s*false/);
  assert.doesNotMatch(
    source,
    /Demo \/ incomplete unit setup: still allow as-ordered receive/
  );
});

test("order detail surfaces skipped-unit receive blockers with inventory recovery", () => {
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(detail, /isSupplierDeliveryLinesSkippedError\(error\)/);
  assert.match(detail, /orderReceiveErrorNotice/);
  assert.match(detail, /orders\.detail\.notice\.receiveUnverifiedTitle/);
  assert.match(detail, /orders\.detail\.notice\.receiveUnverifiedBodyNamed/);
  assert.match(detail, /recovery:\s*"inventory"/);
  assert.match(detail, /router\.push\("\/inventory"/);
  assert.match(catalog, /orders\.detail\.recovery\.inventory/);
  assert.match(catalog, /Mise will not silently skip ordered lines/);
});
