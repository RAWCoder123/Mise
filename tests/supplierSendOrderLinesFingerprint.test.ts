import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildCanonicalSupplierSendContent,
  buildSupplierOrderMessageFromOrderLines
} from "../services/domain/supplierSendContent";
import type {
  Restaurant,
  RestaurantEmailConnection,
  SupplierOrder,
  SupplierOrderLine,
  SupplierRecipient
} from "../types/mise";

const RESTAURANT_ID = "10000000-0000-4000-8000-000000000001";
const ORDER_ID = "20000000-0000-4000-8000-000000000001";
const SUPPLIER_ID = "50000000-0000-4000-8000-000000000001";
const REC_ID = "30000000-0000-4000-8000-000000000001";
const ITEM_ID = "40000000-0000-4000-8000-000000000001";

function restaurant(): Restaurant {
  return {
    id: RESTAURANT_ID,
    name: "Mise Cafe",
    address: null,
    cuisine_type: "Cafe",
    brand_color: "#000000",
    accent_color: "#E4572E",
    logo_url: null,
    service_style: "cafe",
    timezone: "America/Los_Angeles",
    currency: "USD",
    operational_profile: {
      serviceStyle: "cafe",
      orderCadence: [],
      prepWindows: [],
      primarySuppliers: [],
      inventoryReviewDays: [],
      notes: null
    },
    created_at: "2026-08-27T00:00:00.000Z"
  };
}

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  const lines = [orderLine(12)];
  const body = buildSupplierOrderMessageFromOrderLines(
    "Local Produce Co.",
    lines,
    null
  );
  return {
    id: ORDER_ID,
    restaurant_id: RESTAURANT_ID,
    supplier_id: SUPPLIER_ID,
    supplier_name: "Local Produce Co.",
    order_message: body,
    operator_note: null,
    status: "draft",
    delivery_date: "2026-08-28",
    created_at: "2026-08-27T00:00:00.000Z",
    ...overrides
  };
}

function orderLine(
  orderedQuantity: number,
  overrides: Partial<SupplierOrderLine> = {}
): SupplierOrderLine {
  return {
    id: "line-1",
    restaurant_id: RESTAURANT_ID,
    supplier_order_id: ORDER_ID,
    inventory_item_id: ITEM_ID,
    purchase_recommendation_id: REC_ID,
    item_name: "Tomatoes",
    ordered_quantity: orderedQuantity,
    unit: "each",
    canonical_unit: "each",
    estimated_unit_cost: 2,
    line_position: 0,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
    ...overrides
  };
}

function emailConnection(): RestaurantEmailConnection {
  return {
    id: "email-1",
    restaurant_id: RESTAURANT_ID,
    provider: "gmail",
    status: "connected",
    sender_email: "orders@example.com",
    last_verified_at: "2026-08-27T00:00:00.000Z",
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z"
  };
}

function recipient(): SupplierRecipient {
  return {
    id: "recipient-1",
    restaurant_id: RESTAURANT_ID,
    supplier_id: SUPPLIER_ID,
    supplier_name: "Local Produce Co.",
    email: "produce@example.com",
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z"
  };
}

test("send content fingerprints durable ordered quantity, not live recommendation edits", async () => {
  const frozen = orderLine(12);
  const draft = order();
  const built = await buildCanonicalSupplierSendContent({
    restaurant: restaurant(),
    order: draft,
    contentRevision: 3,
    emailConnection: emailConnection(),
    recipients: [recipient()],
    orderLines: [frozen]
  });

  assert.equal(built.ready, true);
  assert.equal(built.content.lines[0]?.quantity, 12);
  assert.match(built.contentFingerprint ?? "", /^[a-f0-9]{64}$/);

  const mutatedRecommendationBody = draft.order_message.replace("12 each", "99 each");
  const mismatched = await buildCanonicalSupplierSendContent({
    restaurant: restaurant(),
    order: { ...draft, order_message: mutatedRecommendationBody },
    contentRevision: 4,
    emailConnection: emailConnection(),
    recipients: [recipient()],
    orderLines: [frozen]
  });
  assert.equal(mismatched.ready, false);
  assert.ok(mismatched.blockerCodes.includes("send_content_invalid"));
});

test("send content fails closed when durable order lines are missing", async () => {
  const built = await buildCanonicalSupplierSendContent({
    restaurant: restaurant(),
    order: order({ order_message: "Order draft for Local Produce Co.\n\nTomatoes - 12 each\n\nDelivery requested: Tomorrow morning" }),
    contentRevision: 1,
    emailConnection: emailConnection(),
    recipients: [recipient()],
    orderLines: []
  });
  assert.equal(built.ready, false);
  assert.deepEqual(built.blockerCodes, ["order_lines_missing"]);
});

test("send content fails closed when a durable line lost its recommendation identity", async () => {
  const lines = [orderLine(12, { purchase_recommendation_id: null })];
  const draft = order({
    order_message: buildSupplierOrderMessageFromOrderLines(
      "Local Produce Co.",
      lines,
      null
    )
  });
  const built = await buildCanonicalSupplierSendContent({
    restaurant: restaurant(),
    order: draft,
    contentRevision: 1,
    emailConnection: emailConnection(),
    recipients: [recipient()],
    orderLines: lines
  });
  assert.equal(built.ready, false);
  assert.ok(built.blockerCodes.includes("send_content_invalid"));
});

test("migration and domain no longer rebuild send lines from live recommendations", () => {
  const migration = readFileSync(
    "supabase/migrations/20260827030000_supplier_send_order_lines_fingerprint.sql",
    "utf8"
  );
  const domain = readFileSync("services/domain/supplierSendContent.ts", "utf8");
  assert.match(migration, /from public\.supplier_order_lines line/);
  assert.match(migration, /Never rebuilds send quantities from live purchase_recommendations/);
  assert.doesNotMatch(
    migration,
    /from public\.purchase_recommendations recommendation[\s\S]*recommended_quantity/
  );
  assert.match(domain, /orderLines: readonly SupplierOrderLine\[\]/);
  assert.doesNotMatch(domain, /recommendations: readonly PurchaseRecommendation/);
});
