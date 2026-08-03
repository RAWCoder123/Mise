import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSupplierRecipientDirectory,
  findSupplierRecipientCatalogName,
  supplierRecipientDirectoryKey
} from "../services/domain/supplierRecipients";
import {
  requireSupplierRecipientInput,
  SUPPLIER_RECIPIENT_EMAIL_MAX_CHARACTERS,
  SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS
} from "../services/miseValidation";
import type { SupplierRecipient } from "../types/mise";

const restaurantId = "restaurant_a";

test("supplier recipient directory is tenant-scoped, case-insensitive, and keeps saved-only suppliers", () => {
  const recipients: SupplierRecipient[] = [
    recipient({
      id: "fresh_old",
      supplier_name: "fresh foods",
      email: "old@fresh.test",
      updated_at: "2026-07-17T10:00:00.000Z"
    }),
    recipient({
      id: "fresh_new",
      supplier_name: "Fresh Foods",
      email: "orders@fresh.test",
      updated_at: "2026-07-18T10:00:00.000Z"
    }),
    recipient({
      id: "saved_only",
      supplier_name: "Legacy Bakery",
      email: "orders@legacy.test"
    }),
    recipient({
      id: "foreign",
      restaurant_id: "restaurant_b",
      supplier_name: "Other Tenant Supply",
      email: "orders@other.test"
    })
  ];

  const directory = buildSupplierRecipientDirectory(
    restaurantId,
    ["  Fresh   Foods ", "fresh foods", "Pantry Wholesale"],
    recipients
  );

  assert.deepEqual(directory.map((entry) => entry.supplierName), [
    "Fresh Foods",
    "Legacy Bakery",
    "Pantry Wholesale"
  ]);
  assert.ok(directory.every((entry) => entry.restaurantId === restaurantId));
  assert.equal(directory[0]?.email, "orders@fresh.test");
  assert.equal(directory[0]?.recipientId, "fresh_new");
  assert.equal(directory[0]?.source, "current_and_saved");
  assert.equal(directory[1]?.source, "saved");
  assert.equal(directory[2]?.source, "current");
  assert.equal(directory.some((entry) => entry.recipientId === "foreign"), false);
  assert.equal(supplierRecipientDirectoryKey(" Fresh   Foods "), "fresh foods");
});

test("supplier recipient input normalizes bounded names and emails", () => {
  assert.deepEqual(
    requireSupplierRecipientInput({
      restaurant_id: " restaurant_a ",
      supplier_name: "  Fresh   Foods  ",
      email: " ORDERS@Fresh.Example "
    }),
    {
      restaurant_id: "restaurant_a",
      supplier_name: "Fresh Foods",
      email: "orders@fresh.example"
    }
  );
});

test("supplier recipient catalog matching is tenant-scoped and rejects invented suppliers", () => {
  const references = [
    { restaurantId, supplierName: "Fresh Produce Co." },
    { restaurantId: "restaurant_b", supplierName: "Other Tenant Supply" },
    { restaurantId, supplierName: "Saved Bakery" }
  ];

  assert.equal(
    findSupplierRecipientCatalogName(restaurantId, "  fresh   produce co. ", references),
    "Fresh Produce Co."
  );
  assert.equal(findSupplierRecipientCatalogName(restaurantId, "Other Tenant Supply", references), null);
  assert.equal(findSupplierRecipientCatalogName(restaurantId, "Invented Supplier", references), null);
});

test("supplier recipient validation rejects malformed or unbounded identity", () => {
  const valid = {
    restaurant_id: restaurantId,
    supplier_name: "Fresh Foods",
    email: "orders@fresh.test"
  };
  assert.throws(() => requireSupplierRecipientInput({ ...valid, restaurant_id: "" }), /restaurant workspace/i);
  assert.throws(() => requireSupplierRecipientInput({ ...valid, supplier_name: "Bad\nSupplier" }), /supplier name/i);
  assert.throws(
    () => requireSupplierRecipientInput({ ...valid, supplier_name: "s".repeat(SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS + 1) }),
    /supplier name/i
  );
  assert.throws(() => requireSupplierRecipientInput({ ...valid, email: "not-an-email" }), /valid supplier email/i);
  assert.throws(
    () => requireSupplierRecipientInput({ ...valid, email: `${"a".repeat(SUPPLIER_RECIPIENT_EMAIL_MAX_CHARACTERS)}@x.test` }),
    /valid supplier email/i
  );
});

test("hosted supplier recipient writes use only the guarded RPC while demo writes audit locally", () => {
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const localStart = repository.indexOf("async upsertSupplierRecipient(input)");
  const hostedStart = repository.indexOf("async upsertSupplierRecipient(input)", localStart + 1);
  const localMethod = repository.slice(localStart, repository.indexOf("async createSetupAttachment", localStart));
  const hostedMethod = repository.slice(hostedStart, repository.indexOf("async createSetupAttachment", hostedStart));

  assert.match(localMethod, /requireActiveDemoRestaurant\(state, input\.restaurant_id\)/);
  assert.match(localMethod, /findSupplierRecipientCatalogName/);
  assert.match(localMethod, /Supplier is not part of this restaurant catalog/);
  assert.match(localMethod, /state\.inventoryItems/);
  assert.match(localMethod, /state\.supplierRecipients/);
  assert.match(localMethod, /supplier_recipient_(?:created|updated)/);
  assert.match(localMethod, /appendDemoAuditLog/);

  assert.match(hostedMethod, /action:\s*"upsert_supplier_recipient"/);
  assert.match(hostedMethod, /invokeOperationalWorkflow/);
  assert.match(hostedMethod, /supplierName:\s*input\.supplier_name/);
  assert.match(hostedMethod, /email:\s*input\.email/);
  assert.doesNotMatch(hostedMethod, /client\.rpc\("upsert_supplier_recipient"/);
  assert.doesNotMatch(hostedMethod, /\.from\("supplier_recipients"\)/);
  assert.doesNotMatch(hostedMethod, /\.(?:insert|update|upsert|delete)\(/);
});

test("supplier recipient migration preserves the tenant-role invariant and direct-DML revocation", () => {
  const migration = readFileSync(
    "supabase/migrations/20260719214822_supplier_recipient_management.sql",
    "utf8"
  );
  const edgeMigration = readFileSync(
    "supabase/migrations/20260801020000_edge_upsert_supplier_recipient.sql",
    "utf8"
  );
  assert.match(migration, /create or replace function public\.upsert_supplier_recipient/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /private\.has_restaurant_role\(\s*p_restaurant_id,\s*array\['owner', 'admin', 'manager'\]/i);
  assert.match(migration, /from public\.inventory_items inventory/i);
  assert.match(migration, /from public\.supplier_recipients saved/i);
  assert.match(migration, /insert into public\.audit_logs/i);
  assert.match(migration, /supplier_recipient_(?:created|updated)/i);
  assert.match(migration, /create unique index[^;]+lower\(pg_catalog\.btrim\(supplier_name\)\)/is);
  assert.match(migration, /revoke insert, update, delete on table public\.supplier_recipients from authenticated/i);
  assert.match(migration, /revoke all on function public\.upsert_supplier_recipient[^;]+from public, anon, authenticated, service_role/is);
  assert.match(migration, /grant execute on function public\.upsert_supplier_recipient[^;]+to authenticated/is);

  assert.match(edgeMigration, /private\.service_upsert_supplier_recipient/i);
  assert.match(edgeMigration, /private\.actor_has_restaurant_role\(/i);
  assert.match(edgeMigration, /grant execute on function public\.service_upsert_supplier_recipient[\s\S]*service_role/i);
  assert.match(edgeMigration, /revoke all on function public\.upsert_supplier_recipient/i);
  assert.match(edgeMigration, /Domain audit is recorded by operational-workflows/i);
});

test("supplier recipient upsert is Edge-routed with manager+ service ownership", () => {
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const databaseTests = readFileSync(
    "supabase/tests/database/supplier_recipient_management.test.sql",
    "utf8"
  );

  assert.match(edge, /"upsert_supplier_recipient"/);
  assert.match(edge, /service_upsert_supplier_recipient/);
  assert.match(edge, /supplier_recipient_upserted/);
  assert.match(edge, /email_configured/);
  const staffActions =
    edge.match(/const staffOperationalActions = new Set<OperationalAction>\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  assert.doesNotMatch(staffActions, /"upsert_supplier_recipient"/);
  assert.match(databaseTests, /authenticated clients cannot execute the legacy supplier recipient RPC/i);
  assert.match(databaseTests, /authenticated clients cannot execute the supplier recipient service RPC/i);
  assert.match(databaseTests, /service_upsert_supplier_recipient/i);
  assert.match(databaseTests, /staff cannot mutate a supplier recipient through the service RPC/i);
});

test("supplier recipient route is stale-response guarded and staff read-only", () => {
  const screen = readFileSync("app/settings/suppliers.tsx", "utf8");
  assert.match(screen, /canManageRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(screen, /activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(screen, /requestId !== requestIdRef\.current/);
  assert.match(screen, /canManage \? \(/);
  assert.match(screen, /editable=\{rowEditable\}/);
  assert.match(screen, /presentSuppliersMutationActionsEditable/);
  assert.match(screen, /minHeight: 44/);
  assert.match(screen, /accessibilityLabel=\{copy\.saveAccessibility/);
  assert.match(screen, /function buildSupplierCopy\(/);
  assert.doesNotMatch(screen, /const supplierCopy:\s*Record<AppLocale/);
  assert.match(screen, /t\("settings\.suppliers\.title"\)/);
  assert.match(screen, /presentSuppliersMutationNoticeCopy/);
  assert.match(screen, /resolveSuppliersHubLoadState/);
  assert.match(screen, /RetryNotice/);
  assert.match(screen, /onRetry=\{\(\) => void load\(true\)\}/);
});

function recipient(patch: Partial<SupplierRecipient> = {}): SupplierRecipient {
  return {
    id: "recipient_1",
    restaurant_id: restaurantId,
    supplier_name: "Fresh Foods",
    email: null,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-18T10:00:00.000Z",
    ...patch
  };
}
