import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSupplierRecipientDirectory
} from "../services/domain/supplierRecipients";
import {
  requireSupplierRecipientInput,
  SUPPLIER_RECIPIENT_EMAIL_MAX_CHARACTERS
} from "../services/miseValidation";
import type { Supplier, SupplierRecipient } from "../types/mise";

const restaurantId = "restaurant_a";
const freshSupplierId = "10000000-0000-4000-8000-000000000001";
const bakerySupplierId = "10000000-0000-4000-8000-000000000002";
const pantrySupplierId = "10000000-0000-4000-8000-000000000003";

test("supplier recipient directory is tenant-scoped and binds recipients by durable supplier ID", () => {
  const suppliers: Supplier[] = [
    supplier({ id: freshSupplierId, display_name: "Fresh Foods", normalized_name: "fresh foods" }),
    supplier({ id: bakerySupplierId, display_name: "Legacy Bakery", normalized_name: "legacy bakery" }),
    supplier({ id: pantrySupplierId, display_name: "Pantry Wholesale", normalized_name: "pantry wholesale" }),
    supplier({
      id: "20000000-0000-4000-8000-000000000001",
      restaurant_id: "restaurant_b",
      display_name: "Other Tenant Supply",
      normalized_name: "other tenant supply"
    })
  ];
  const recipients: SupplierRecipient[] = [
    recipient({
      id: "fresh_old",
      supplier_id: freshSupplierId,
      supplier_name: "Old presentation snapshot",
      email: "old@fresh.test",
      updated_at: "2026-07-17T10:00:00.000Z"
    }),
    recipient({
      id: "fresh_new",
      supplier_id: freshSupplierId,
      supplier_name: "Another stale snapshot",
      email: "orders@fresh.test",
      updated_at: "2026-07-18T10:00:00.000Z"
    }),
    recipient({
      id: "saved_only",
      supplier_id: bakerySupplierId,
      supplier_name: "Legacy Bakery",
      email: "orders@legacy.test"
    }),
    recipient({
      id: "foreign",
      restaurant_id: "restaurant_b",
      supplier_id: "20000000-0000-4000-8000-000000000001",
      supplier_name: "Other Tenant Supply",
      email: "orders@other.test"
    })
  ];

  const directory = buildSupplierRecipientDirectory(
    restaurantId,
    suppliers,
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
  assert.equal(directory[1]?.source, "current_and_saved");
  assert.equal(directory[2]?.source, "current");
  assert.equal(directory.some((entry) => entry.recipientId === "foreign"), false);
  assert.equal(directory[0]?.supplierId, freshSupplierId);
});

test("supplier recipient input normalizes durable IDs and bounded emails", () => {
  assert.deepEqual(
    requireSupplierRecipientInput({
      restaurant_id: " restaurant_a ",
      supplier_id: ` ${freshSupplierId} `,
      email: " ORDERS@Fresh.Example "
    }),
    {
      restaurant_id: "restaurant_a",
      supplier_id: freshSupplierId,
      email: "orders@fresh.example"
    }
  );
});

test("supplier recipient validation rejects malformed or unbounded identity", () => {
  const valid = {
    restaurant_id: restaurantId,
    supplier_id: freshSupplierId,
    email: "orders@fresh.test"
  };
  assert.throws(() => requireSupplierRecipientInput({ ...valid, restaurant_id: "" }), /restaurant workspace/i);
  assert.throws(() => requireSupplierRecipientInput({ ...valid, supplier_id: "not-a-uuid" }), /supplier identity/i);
  assert.throws(() => requireSupplierRecipientInput({ ...valid, email: "not-an-email" }), /valid supplier email/i);
  assert.throws(
    () => requireSupplierRecipientInput({ ...valid, email: `${"a".repeat(SUPPLIER_RECIPIENT_EMAIL_MAX_CHARACTERS)}@x.test` }),
    /valid supplier email/i
  );
});

test("hosted supplier recipient writes use only the guarded RPC while demo writes audit locally", () => {
  const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const localStart = demoRepository.indexOf("async upsertSupplierRecipient(input)");
  const hostedStart = hostedRepository.indexOf("async upsertSupplierRecipient(input)");
  const localMethod = demoRepository.slice(localStart, demoRepository.indexOf("async createSetupAttachment", localStart));
  const hostedMethod = hostedRepository.slice(hostedStart, hostedRepository.indexOf("async createSetupAttachment", hostedStart));

  assert.match(localMethod, /requireActiveDemoRestaurant\(state, input\.restaurant_id\)/);
  assert.match(localMethod, /Supplier is not part of this restaurant catalog/);
  assert.match(localMethod, /state\.suppliers/);
  assert.match(localMethod, /state\.supplierRecipients/);
  assert.match(localMethod, /supplier_recipient_(?:created|updated)/);
  assert.match(localMethod, /appendDemoAuditLog/);

  assert.match(hostedMethod, /client\.rpc\("upsert_supplier_recipient"/);
  assert.match(hostedMethod, /throwRepositoryError\(error, input\.restaurant_id\)/);
  assert.doesNotMatch(hostedMethod, /\.from\("supplier_recipients"\)/);
  assert.doesNotMatch(hostedMethod, /\.(?:insert|update|upsert|delete)\(/);
});

test("supplier recipient migration preserves the tenant-role invariant and direct-DML revocation", () => {
  const migration = readFileSync(
    "supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    "utf8"
  );
  assert.match(migration, /create or replace function public\.upsert_supplier_recipient/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /private\.has_restaurant_role\(\s*p_restaurant_id,\s*array\['owner', 'admin', 'manager'\]/i);
  assert.match(migration, /from public\.suppliers supplier/i);
  assert.match(migration, /supplier\.id = p_supplier_id/i);
  assert.match(migration, /insert into public\.audit_logs/i);
  assert.match(migration, /supplier_recipient_(?:created|updated)/i);
  assert.match(migration, /create unique index[^;]+supplier_recipients[^;]+restaurant_id, supplier_id/is);
  const originalMigration = readFileSync(
    "supabase/migrations/20260719214822_supplier_recipient_management.sql",
    "utf8"
  );
  assert.match(originalMigration, /revoke insert, update, delete on table public\.supplier_recipients from authenticated/i);
  assert.match(migration, /revoke all on function public\.upsert_supplier_recipient[^;]+from public, anon, authenticated, service_role/is);
  assert.match(migration, /grant execute on function public\.upsert_supplier_recipient[^;]+to authenticated/is);
});

test("supplier recipient route is stale-response guarded and staff read-only", () => {
  const screen = readFileSync("app/settings/suppliers.tsx", "utf8");
  assert.match(screen, /canManageRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(screen, /activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(screen, /requestId !== requestIdRef\.current/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /presentRestaurantScopedHubActionsEditable/);
  assert.match(screen, /hasLoadedRef/);
  assert.match(screen, /Soft refresh must preserve operator-entered name\/email drafts/);
  assert.match(screen, /canManage \? \(/);
  assert.match(screen, /editable=\{actionsEditable && !saving\}/);
  assert.match(screen, /disabled=\{!actionsEditable \|\| saving \|\| nameUnchanged\}/);
  assert.match(screen, /disabled=\{!actionsEditable \|\| saving \|\| emailUnchanged\}/);
  assert.match(screen, /minHeight: 44/);
  assert.match(screen, /accessibilityLabel=\{copy\.saveAccessibility/);
  assert.match(screen, /Record<AppLocale, SupplierCopy>/);
});

function recipient(patch: Partial<SupplierRecipient> = {}): SupplierRecipient {
  return {
    id: "recipient_1",
    restaurant_id: restaurantId,
    supplier_id: freshSupplierId,
    supplier_name: "Fresh Foods",
    email: null,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-18T10:00:00.000Z",
    ...patch
  };
}

function supplier(patch: Partial<Supplier> = {}): Supplier {
  return {
    id: freshSupplierId,
    restaurant_id: restaurantId,
    display_name: "Fresh Foods",
    normalized_name: "fresh foods",
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-18T10:00:00.000Z",
    ...patch
  };
}
