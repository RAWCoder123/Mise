import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSupplierSpendRestaurantToken,
  canonicalizeSupplierSpendRestaurantId,
  requireCanonicalSupplierSpendWorkspaceId
} from "../services/domain/supplierSpendRestaurantIdentity";
import { buildSupplierSpendTrend } from "../services/domain/supplierSpend";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/supplierSpendRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/supplierSpend.ts", import.meta.url),
  "utf8"
);
const ordersApplicationSource = readFileSync(
  new URL("../services/application/orders.ts", import.meta.url),
  "utf8"
);
const salesTrendsSource = readFileSync(
  new URL("../services/domain/salesTrends.ts", import.meta.url),
  "utf8"
);
const wasteAnalysisSource = readFileSync(
  new URL("../services/domain/wasteAnalysis.ts", import.meta.url),
  "utf8"
);
const inventoryCountAuthoritySource = readFileSync(
  new URL("../services/domain/inventoryCountAuthority.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";
const supplierId = "00000000-0000-4000-8000-000000000501";

function inventory(id: string, cost: number, restaurantId = workspace): InventoryItem {
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

function order(id: string, restaurantId = workspace): SupplierOrder {
  return {
    id,
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: "Metro",
    order_message: "hello",
    operator_note: null,
    status: "sent",
    delivery_date: "2026-07-21",
    created_at: "2026-07-20T22:30:00.000Z"
  };
}

function recommendation(orderId: string, itemId: string, quantity: number, restaurantId = workspace): PurchaseRecommendation {
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
    status: "ordered",
    supplier_order_id: orderId,
    created_at: "2026-07-20T12:00:00.000Z"
  };
}

test("MISE-005MT pins supplierSpend restaurantId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MT/);
  assert.match(domainSource, /MISE-005MT/);

  assert.match(
    identitySource,
    /export function asciiTrimSupplierSpendRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /requireCanonicalSupplierSpendWorkspaceId\(restaurantId\)/);
  assert.doesNotMatch(domainSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /const normalizedRestaurantId = restaurantId\.trim\(\)/);

  // Leave sales-trends (#775), waste application (#751), and sibling domain restaurant tips alone.
  assert.doesNotMatch(identitySource, /salesTrendsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountAuthorityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);

  // Orders application tip owns application/orders.ts restaurant paths separately.
  assert.doesNotMatch(ordersApplicationSource, /requireCanonicalSupplierSpendWorkspaceId/);
  assert.doesNotMatch(ordersApplicationSource, /MISE-005MT/);

  // Sibling domain restaurant workspace Unicode trims remain for later tips.
  assert.match(salesTrendsSource, /restaurantId\.trim\(\)/);
  assert.match(wasteAnalysisSource, /input\.restaurantId\.trim\(\)/);
  assert.match(inventoryCountAuthoritySource, /input\.restaurantId\.trim\(\)/);
});

test("ASCII trim keeps ordinary supplier-spend workspace padding stable", () => {
  assert.equal(asciiTrimSupplierSpendRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeSupplierSpendRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalSupplierSpendWorkspaceId(` ${workspace} `), workspace);

  const trend = buildSupplierSpendTrend(
    `  ${workspace}  `,
    [order("o1")],
    [recommendation("o1", "item_a", 2)],
    [inventory("item_a", 10)],
    { limit: 6 }
  );
  assert.deepEqual(trend, [{ date: "2026-07-20", spend: 20 }]);
});

test("ASCII supplier-spend trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimSupplierSpendRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeSupplierSpendRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalSupplierSpendWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );
  assert.throws(
    () =>
      buildSupplierSpendTrend(
        nbspPadded,
        [order("o1")],
        [recommendation("o1", "item_a", 2)],
        [inventory("item_a", 10)],
        { limit: 6 }
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeSupplierSpendRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalSupplierSpendWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );
  assert.throws(
    () =>
      buildSupplierSpendTrend(
        emSpacePadded,
        [order("o1")],
        [recommendation("o1", "item_a", 2)],
        [inventory("item_a", 10)],
        { limit: 6 }
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );
});

test("Supplier-spend workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeSupplierSpendRestaurantId(""), null);
  assert.equal(canonicalizeSupplierSpendRestaurantId("   "), null);
  assert.equal(canonicalizeSupplierSpendRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeSupplierSpendRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalSupplierSpendWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalSupplierSpendWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalSupplierSpendWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalSupplierSpendWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );
  assert.throws(
    () =>
      buildSupplierSpendTrend(
        "",
        [order("o1")],
        [recommendation("o1", "item_a", 2)],
        [inventory("item_a", 10)],
        { limit: 6 }
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier spend requires a restaurant."
  );
});
