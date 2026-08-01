import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POS_SALES_EXPORT_DAYS,
  RESTAURANT_DATA_EXPORT_SCHEMA_VERSION,
  buildRestaurantDataExport,
  filterPosSalesForExport,
  redactInviteForExport,
  sanitizePosIntegrationForExport
} from "../services/domain/restaurantDataExport.ts";

test("redactInviteForExport strips token secrets and keeps roster metadata", () => {
  const redacted = redactInviteForExport({
    id: "inv-1",
    restaurant_id: "rest-1",
    email: "cook@example.com",
    role: "staff",
    status: "pending",
    token_hash: "secret-hash",
    claim_token: "live-token",
    created_by: "user-1",
    claimed_by: null,
    expires_at: "2026-08-10T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    claimed_at: null,
    revoked_at: null
  });

  assert.equal(redacted.email, "cook@example.com");
  assert.equal(redacted.role, "staff");
  assert.equal(redacted.status, "pending");
  assert.equal("token_hash" in redacted, false);
  assert.equal("claim_token" in redacted, false);
});

test("sanitizePosIntegrationForExport removes secret-like settings keys", () => {
  const sanitized = sanitizePosIntegrationForExport({
    id: "pos-1",
    restaurant_id: "rest-1",
    provider: "square",
    status: "connected",
    external_location_id: "loc-1",
    last_sync_at: "2026-08-01T12:00:00.000Z",
    sync_cursor: "cursor-1",
    settings: {
      locationLabel: "Front counter",
      access_token: "should-not-export",
      refreshToken: "also-secret",
      api_key: "nope"
    },
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z"
  });

  assert.deepEqual(sanitized.settings, { locationLabel: "Front counter" });
  assert.equal(sanitized.provider, "square");
  assert.equal(sanitized.sync_cursor, "cursor-1");
});

test("filterPosSalesForExport keeps recent sales within the default window", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");
  const kept = filterPosSalesForExport(
    [
      { id: "old", sale_date: "2026-04-01" },
      { id: "edge", sale_date: "2026-05-04" },
      { id: "recent", sale_date: "2026-07-20" }
    ],
    now,
    DEFAULT_POS_SALES_EXPORT_DAYS
  );

  assert.deepEqual(
    kept.map((sale) => sale.id).sort(),
    ["edge", "recent"]
  );
});

test("buildRestaurantDataExport packages tenant tables and redacts secrets", () => {
  const exportedAt = "2026-08-01T19:00:00.000Z";
  const document = buildRestaurantDataExport({
    restaurantId: "rest-1",
    exportedAt,
    source: "demo_export_restaurant_data",
    restaurants: [{ id: "rest-1", name: "Mise Demo" }],
    users: [{ id: "user-1", name: "Owner", email: "owner@demo.mise" }],
    memberships: [
      {
        id: "m-1",
        restaurant_id: "rest-1",
        user_id: "user-1",
        role: "owner",
        status: "active"
      }
    ],
    memberInvites: [
      {
        id: "inv-1",
        restaurant_id: "rest-1",
        email: "cook@example.com",
        role: "staff",
        status: "pending",
        token_hash: "secret-hash",
        created_by: "user-1",
        claimed_by: null,
        expires_at: "2026-08-10T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
        claimed_at: null,
        revoked_at: null
      }
    ],
    inventoryItems: [{ id: "inv-item-1", restaurant_id: "rest-1", item_name: "Chicken" }],
    inventoryMovements: [{ id: "mov-1", restaurant_id: "rest-1", quantity_delta: -1 }],
    inventoryCountSessions: [{ id: "count-1", restaurant_id: "rest-1", status: "approved" }],
    inventoryCountLines: [{ id: "line-1", session_id: "count-1", inventory_item_id: "inv-item-1" }],
    storageLocations: [{ id: "loc-1", restaurant_id: "rest-1", name: "Walk-in" }],
    inventoryLocationBalances: [{ id: "bal-1", restaurant_id: "rest-1", quantity: 4 }],
    menuItemIngredients: [{ id: "map-1", restaurant_id: "rest-1", menu_item_name: "Bowl" }],
    posSales: [
      { id: "sale-old", restaurant_id: "rest-1", sale_date: "2026-01-01" },
      { id: "sale-new", restaurant_id: "rest-1", sale_date: "2026-07-15" }
    ],
    posIntegrations: [
      {
        id: "pos-1",
        restaurant_id: "rest-1",
        provider: "demo",
        status: "connected",
        external_location_id: null,
        last_sync_at: null,
        sync_cursor: null,
        settings: { access_token: "secret", note: "ok" },
        created_at: exportedAt,
        updated_at: exportedAt
      }
    ],
    salesImports: [{ id: "imp-1", restaurant_id: "rest-1", status: "completed" }],
    purchaseRecommendations: [{ id: "rec-1", restaurant_id: "rest-1", status: "pending" }],
    supplierOrders: [{ id: "ord-1", restaurant_id: "rest-1", status: "draft" }],
    purchaseOrders: [{ id: "po-1", restaurant_id: "rest-1", status: "draft" }],
    supplierItems: [{ id: "si-1", restaurant_id: "rest-1", supplier_name: "Fresh" }],
    supplierRecipients: [{ id: "sr-1", restaurant_id: "rest-1", email: "orders@fresh.test" }],
    insights: [{ id: "ins-1", restaurant_id: "rest-1", title: "Low stock" }],
    aiInsights: [{ id: "ai-1", restaurant_id: "rest-1", status: "ready" }],
    setupAttachments: [{ id: "att-1", restaurant_id: "rest-1", file_name: "menu.csv" }],
    emailConnections: [
      {
        id: "email-1",
        restaurant_id: "rest-1",
        provider: "gmail",
        status: "connected",
        sender_email: "ops@demo.mise",
        last_verified_at: exportedAt,
        created_at: exportedAt,
        updated_at: exportedAt,
        refresh_token: "vault-secret"
      }
    ],
    auditLogs: [{ id: "audit-1", restaurant_id: "rest-1", action: "setup_saved" }]
  });

  assert.equal(document.schema_version, RESTAURANT_DATA_EXPORT_SCHEMA_VERSION);
  assert.equal(document.restaurant_id, "rest-1");
  assert.equal(document.source, "demo_export_restaurant_data");
  assert.equal(document.exported_at, exportedAt);
  assert.equal(document.tables.inventory_items.length, 1);
  assert.equal(document.tables.pos_sales.length, 1);
  const exportedSale = document.tables.pos_sales[0];
  const exportedInvite = document.tables.restaurant_member_invites[0];
  const exportedIntegration = document.tables.pos_integrations[0];
  const exportedEmail = document.tables.restaurant_email_connections[0];
  assert.ok(exportedSale);
  assert.ok(exportedInvite);
  assert.ok(exportedIntegration);
  assert.ok(exportedEmail);
  assert.equal(exportedSale.id, "sale-new");
  assert.equal("token_hash" in exportedInvite, false);
  assert.deepEqual(exportedIntegration.settings, { note: "ok" });
  assert.equal("refresh_token" in exportedEmail, false);
  assert.equal(exportedEmail.sender_email, "ops@demo.mise");
  assert.deepEqual(document.summary, {
    table_count: 24,
    pos_sales_exported: 1,
    pos_sales_window_days: DEFAULT_POS_SALES_EXPORT_DAYS
  });
});
