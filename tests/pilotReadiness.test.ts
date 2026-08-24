import assert from "node:assert/strict";
import test from "node:test";

import { buildPilotReadiness } from "../services/domain/pilotReadiness";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type {
  InventoryItem,
  MenuItemIngredient,
  PosIntegration,
  PosSale,
  RestaurantEmailConnection,
  SupplierRecipient
} from "../types/mise";

const restaurantId = "restaurant-pilot";
const supplierId = "00000000-0000-4000-8000-000000000201";
const now = "2026-08-14T12:00:00.000Z";
const integration: PosIntegration = {
  id: "pos-1", restaurant_id: restaurantId, provider: "square", status: "connected",
  external_location_id: "location-1", last_sync_at: "2026-08-14T11:00:00.000Z",
  sync_cursor: null, settings: {}, created_at: now, updated_at: now
};
const inventory: InventoryItem = {
  id: "inventory-1", restaurant_id: restaurantId, item_name: "Chicken", category: "Protein",
  unit: "lb", current_quantity: 20, par_level: 30, reorder_threshold: 10,
  estimated_unit_cost: 4, supplier_id: supplierId, supplier_name: "Fresh Foods", last_updated: now,
  canonical_unit: "g", canonical_quantity_per_unit: 453.592,
  canonical_unit_verification_status: "verified", canonical_unit_verified_at: now,
  canonical_unit_verified_by: "manager-1"
};
const count: InventoryEvent = {
  id: "count-1", sequence: 1, restaurantId, inventoryItemId: inventory.id, eventType: "count",
  quantity: 20, canonicalUnit: "g", effectiveAt: "2026-08-14T10:00:00.000Z", recordedAt: now,
  actorUserId: "manager-1", source: "count_session", sourceReference: null, reasonCode: null,
  clientEventId: "count-client-1", idempotencyKey: "count-key-1", supersedesEventId: null, metadata: {}
};
const mapping: MenuItemIngredient = {
  id: "mapping-1", restaurant_id: restaurantId, menu_item_name: "Chicken Bowl",
  inventory_item_id: inventory.id, quantity_used_per_sale: 200, unit: "g"
};
const recipient: SupplierRecipient = {
  id: "recipient-1", restaurant_id: restaurantId, supplier_id: supplierId,
  supplier_name: "Fresh Foods",
  email: "orders@fresh.example", created_at: now, updated_at: now
};
const email: RestaurantEmailConnection = {
  id: "gmail-1", restaurant_id: restaurantId, provider: "gmail", status: "connected",
  sender_email: "purchasing@restaurant.example", last_verified_at: now, created_at: now, updated_at: now
};

function sales(days = 7): PosSale[] {
  return Array.from({ length: days }, (_, index) => ({
    id: `sale-${index}`, restaurant_id: restaurantId, source_record_id: `square-${index}`,
    sale_date: `2026-08-${String(7 + index).padStart(2, "0")}`, item_name: "Chicken Bowl",
    category: "Entree", quantity_sold: 10, gross_sales: 120, net_sales: 120,
    source_pos: "Test POS", created_at: now
  }));
}

function readyInput() {
  return {
    restaurantId,
    generatedAt: now,
    posIntegrations: [integration],
    sales: sales(),
    inventoryItems: [inventory],
    countEvents: [count],
    recipeMappings: [mapping],
    supplierRecipients: [recipient],
    emailConnection: email
  };
}

test("pilot readiness opens the full operating loop only with complete, fresh evidence", () => {
  const readiness = buildPilotReadiness(readyInput());
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.canRecommend, true);
  assert.equal(readiness.canDraft, true);
  assert.equal(readiness.canSend, true);
  assert.ok(readiness.areas.every((area) => area.status === "ready"));
});

test("pilot readiness blocks recommendations without physical-count evidence", () => {
  const readiness = buildPilotReadiness({ ...readyInput(), countEvents: [] });
  assert.equal(readiness.canRecommend, false);
  assert.equal(readiness.canSend, false);
  assert.equal(readiness.areas.find((area) => area.id === "inventory_counts")?.status, "blocked");
  assert.match(readiness.areas.find((area) => area.id === "inventory_counts")?.blockers[0] ?? "", /no physical-count evidence/i);
});

test("pilot readiness reports sales-weighted recipe gaps with exact menu items", () => {
  const unmapped = { ...sales()[0]!, id: "sale-unmapped", item_name: "Wings", quantity_sold: 100 };
  const readiness = buildPilotReadiness({ ...readyInput(), sales: [...sales(), unmapped] });
  const recipes = readiness.areas.find((area) => area.id === "recipe_coverage");
  assert.equal(recipes?.status, "attention");
  assert.equal(readiness.canRecommend, false);
  assert.ok(recipes?.blockers.some((blocker) => blocker.includes("Wings")));
});

test("pilot readiness permits drafts but blocks external send without Gmail", () => {
  const readiness = buildPilotReadiness({ ...readyInput(), emailConnection: null });
  assert.equal(readiness.canRecommend, true);
  assert.equal(readiness.canDraft, true);
  assert.equal(readiness.canSend, false);
  assert.equal(readiness.areas.find((area) => area.id === "email_delivery")?.status, "external");
});

test("pilot readiness keeps internal drafts available when only the external recipient is missing", () => {
  const readiness = buildPilotReadiness({ ...readyInput(), supplierRecipients: [] });
  assert.equal(readiness.canRecommend, true);
  assert.equal(readiness.canDraft, true);
  assert.equal(readiness.canSend, false);
  assert.equal(readiness.areas.find((area) => area.id === "supplier_routing")?.status, "ready");
  assert.equal(readiness.areas.find((area) => area.id === "email_delivery")?.status, "blocked");
});

test("pilot readiness rejects cross-restaurant evidence", () => {
  assert.throws(
    () => buildPilotReadiness({
      ...readyInput(),
      supplierRecipients: [{ ...recipient, restaurant_id: "another-restaurant" }]
    }),
    /restaurant scope validation/i
  );
});
