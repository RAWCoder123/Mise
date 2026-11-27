import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSupplierOrderSentByEvidence } from "../services/domain/supplierOrderSentByEvidence";

const migrationPath =
  "supabase/migrations/20261127220000_supplier_order_sent_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/supplier_order_sent_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/supplierOrderSentByEvidence.ts",
  "utf8"
);
const gmailMigration = readFileSync(
  "supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/202606210001_secure_multi_tenant_rls.sql",
  "utf8"
);

test("validateSupplierOrderSentByEvidence rejects sent/completed rows without sent_by_user_id", () => {
  assert.equal(
    validateSupplierOrderSentByEvidence({
      status: "sent",
      sentByUserId: null,
    }),
    "missing_sent_by_user_id"
  );
  assert.equal(
    validateSupplierOrderSentByEvidence({
      status: "completed",
      sentByUserId: null,
    }),
    "missing_sent_by_user_id"
  );
  assert.equal(
    validateSupplierOrderSentByEvidence({
      status: "sent",
      sentByUserId: "   ",
    }),
    "missing_sent_by_user_id"
  );
  assert.equal(
    validateSupplierOrderSentByEvidence({
      status: "completed",
      sentByUserId: "",
    }),
    "missing_sent_by_user_id"
  );
  assert.equal(
    validateSupplierOrderSentByEvidence({
      status: "sent",
    }),
    "missing_sent_by_user_id"
  );
});

test("validateSupplierOrderSentByEvidence accepts draft and actor-stamped terminal rows", () => {
  assert.equal(
    validateSupplierOrderSentByEvidence({
      status: "draft",
      sentByUserId: null,
    }),
    null
  );
  assert.equal(validateSupplierOrderSentByEvidence({}), null);
  assert.equal(
    validateSupplierOrderSentByEvidence({
      status: "sent",
      sentByUserId: "d3111111-1111-4111-8111-111111111111",
    }),
    null
  );
  assert.equal(
    validateSupplierOrderSentByEvidence({
      status: "completed",
      sentByUserId: "d3111111-1111-4111-8111-111111111111",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT send-actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_supplier_order_sent_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.supplier_orders[\s\S]*enforce_supplier_order_sent_by_evidence/
  );
  assert.match(migration, /Supplier order sender is required/);
  assert.match(migration, /new\.status in \('sent', 'completed'\)/);
  // No table-level NOT NULL / status-implies-actor CHECK — tip stays
  // INSERT-only and preserves draft inserts plus mark-sent UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+sent_by_user_id\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}sent_by_user_id\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.\w*supplier_order/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_supplier_order_sent_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_sent_by_user_id/);
  // Column is nullable; status vocabulary includes sent/completed.
  assert.match(
    gmailMigration,
    /alter table public\.supplier_orders[\s\S]*add column if not exists sent_by_user_id uuid;/
  );
  assert.match(
    foundationMigration,
    /status text not null default 'draft' check \(status in \('draft', 'sent', 'completed'\)\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null sent_by plus draft/UPDATE inserts", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch![1]);
  const assertionSites = [
    ...pgTap.matchAll(/^select (is|isnt|ok|matches|has_function)\(/gm),
  ].length;
  assert.equal(
    planned,
    assertionSites,
    "plan must be derived from assertion call sites, never from a passing run"
  );
  assert.equal(planned, 9);
  assert.match(pgTap, /Supplier order sender is required/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(pgTap, /cannot mint sent status without sent_by_user_id/);
  assert.match(pgTap, /cannot mint completed status without sent_by_user_id/);
  assert.match(pgTap, /open draft without sent_by_user_id/);
});
