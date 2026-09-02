import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertAuditLogsTenantScoped,
  auditLogHistoryCategory,
  canBrowseAuditLogs,
  filterAuditLogHistory,
  sanitizeAuditLogMetadata,
  sortAuditLogHistory
} from "../services/domain/auditLogHistory";
import { presentAuditLogHistoryRow } from "../services/presentation/auditLogPresentation";
import type { AuditLog } from "../types/mise";

const restaurantId = "rest_audit_history";

function log(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit_1",
    restaurant_id: restaurantId,
    actor_user_id: "user_1",
    action: "recommendation_approved",
    entity_table: "purchase_recommendations",
    entity_id: "rec_1",
    metadata: { quantity_overridden: true },
    created_at: "2026-09-02T12:00:00.000Z",
    ...overrides
  };
}

test("owner and admin can browse audit logs; managers and staff cannot", () => {
  assert.equal(canBrowseAuditLogs("owner"), true);
  assert.equal(canBrowseAuditLogs("admin"), true);
  assert.equal(canBrowseAuditLogs("manager"), false);
  assert.equal(canBrowseAuditLogs("staff"), false);
  assert.equal(canBrowseAuditLogs(null), false);
});

test("audit categories map purchasing, inventory, integrations, and setup", () => {
  assert.equal(auditLogHistoryCategory("recommendation_approved"), "purchasing");
  assert.equal(auditLogHistoryCategory("supplier_order_sent"), "purchasing");
  assert.equal(auditLogHistoryCategory("inventory_supplier_reassigned"), "inventory");
  assert.equal(auditLogHistoryCategory("waste_recorded"), "inventory");
  assert.equal(auditLogHistoryCategory("square_sync_completed"), "integrations");
  assert.equal(auditLogHistoryCategory("gmail_demo_connected"), "integrations");
  assert.equal(auditLogHistoryCategory("setup_completed"), "setup");
  assert.equal(auditLogHistoryCategory("demo_seeded"), "setup");
  assert.equal(auditLogHistoryCategory("tenant_isolation_probe"), "other");
});

test("history filter and sort prefer newest matching events", () => {
  const approved = log({
    id: "a1",
    created_at: "2026-09-02T15:00:00.000Z"
  });
  const setup = log({
    id: "a2",
    action: "setup_completed",
    entity_table: "restaurants",
    created_at: "2026-09-02T14:00:00.000Z"
  });
  const square = log({
    id: "a3",
    action: "square_sync_completed",
    entity_table: "pos_integrations",
    created_at: "2026-09-02T16:00:00.000Z"
  });

  assert.deepEqual(
    filterAuditLogHistory([approved, setup, square], "purchasing").map((entry) => entry.id),
    ["a1"]
  );
  assert.deepEqual(
    sortAuditLogHistory([approved, setup, square]).map((entry) => entry.id),
    ["a3", "a1", "a2"]
  );
});

test("metadata sanitization strips secrets, emails, and oversized values", () => {
  const sanitized = sanitizeAuditLogMetadata({
    quantity_overridden: true,
    count: 3,
    provider: "Demo POS",
    access_token: "secret",
    refresh_token: "also-secret",
    email: "chef@example.com",
    note: "chef@example.com",
    too_long: "x".repeat(200),
    nested: { nope: true },
    "bad key": 1
  });

  assert.deepEqual(sanitized, {
    quantity_overridden: true,
    count: 3,
    provider: "Demo POS"
  });
});

test("presentation uses known action keys and sanitized metadata", () => {
  const row = presentAuditLogHistoryRow(log());
  assert.equal(row.actionKey, "auditLogs.action.recommendation_approved");
  assert.equal(row.categoryKey, "auditLogs.filter.purchasing");
  assert.deepEqual(row.metadataEntries, [{ key: "quantity_overridden", value: "true" }]);

  const unknown = presentAuditLogHistoryRow(
    log({ action: "custom_ops_event", metadata: { access_token: "nope", ok: 1 } })
  );
  assert.equal(unknown.actionKey, null);
  assert.equal(unknown.actionFallback, "custom ops event");
  assert.equal(unknown.categoryKey, "auditLogs.filter.other");
  assert.deepEqual(unknown.metadataEntries, [{ key: "ok", value: "1" }]);
});

test("tenant assert fails closed on cross-restaurant rows", () => {
  assertAuditLogsTenantScoped([log()], restaurantId);
  assert.throws(() => assertAuditLogsTenantScoped([log()], "other"));
  assert.throws(() =>
    assertAuditLogsTenantScoped([log({ restaurant_id: "other" })], restaurantId)
  );
});

test("audit log browse is wired for owner/admin More hub access", () => {
  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const smoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const screen = readFileSync("app/more/audit-logs.tsx", "utf8");
  const service = readFileSync("services/miseService.ts", "utf8");
  const contracts = readFileSync("services/repositories/repositoryContracts.ts", "utf8");
  const hosted = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const tenantAccess = readFileSync("services/tenantAccess.ts", "utf8");

  assert.match(more, /canBrowseAuditLogs/);
  assert.match(more, /\/more\/audit-logs/);
  assert.match(layout, /more\/audit-logs/);
  assert.match(smoke, /"\/more\/audit-logs"/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /hubReady\s*\?\s*filterAuditLogHistory/);
  assert.match(screen, /canBrowseAuditLogs/);
  assert.match(service, /application\/auditLogHistory/);
  assert.match(contracts, /listAuditLogs\(/);
  assert.match(hosted, /\.from\("audit_logs"\)/);
  assert.match(hosted, /async listAuditLogs\(/);
  assert.doesNotMatch(hosted, /\.from\("audit_logs"\)\.insert/);
  assert.match(demo, /async listAuditLogs\(/);
  assert.match(tenantAccess, /export function canBrowseAuditLogs/);
});
