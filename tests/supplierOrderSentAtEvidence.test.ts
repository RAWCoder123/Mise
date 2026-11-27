import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSupplierOrderSentAtEvidence } from "../services/domain/supplierOrderSentAtEvidence";

const migrationPath =
  "supabase/migrations/20261127230000_supplier_order_sent_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/supplier_order_sent_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/supplierOrderSentAtEvidence.ts",
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

test("validateSupplierOrderSentAtEvidence rejects sent/completed rows without sent_at", () => {
  assert.equal(
    validateSupplierOrderSentAtEvidence({
      status: "sent",
      sentAt: null,
    }),
    "missing_sent_at"
  );
  assert.equal(
    validateSupplierOrderSentAtEvidence({
      status: "completed",
      sentAt: null,
    }),
    "missing_sent_at"
  );
  assert.equal(
    validateSupplierOrderSentAtEvidence({
      status: "sent",
      sentAt: "   ",
    }),
    "missing_sent_at"
  );
  assert.equal(
    validateSupplierOrderSentAtEvidence({
      status: "completed",
      sentAt: "",
    }),
    "missing_sent_at"
  );
  assert.equal(
    validateSupplierOrderSentAtEvidence({
      status: "sent",
    }),
    "missing_sent_at"
  );
});

test("validateSupplierOrderSentAtEvidence accepts draft and time-stamped terminal rows", () => {
  assert.equal(
    validateSupplierOrderSentAtEvidence({
      status: "draft",
      sentAt: null,
    }),
    null
  );
  assert.equal(validateSupplierOrderSentAtEvidence({}), null);
  assert.equal(
    validateSupplierOrderSentAtEvidence({
      status: "sent",
      sentAt: "2024-01-02T00:00:00Z",
    }),
    null
  );
  assert.equal(
    validateSupplierOrderSentAtEvidence({
      status: "completed",
      sentAt: "2024-01-03T00:00:00Z",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT send-time guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_supplier_order_sent_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.supplier_orders[\s\S]*enforce_supplier_order_sent_at_evidence/
  );
  assert.match(migration, /Supplier order send time is required/);
  assert.match(migration, /new\.status in \('sent', 'completed'\)/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and preserves draft inserts plus mark-sent UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+sent_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}sent_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.\w*supplier_order/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_supplier_order_sent_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_sent_at/);
  // Column is nullable; status vocabulary includes sent/completed.
  assert.match(
    gmailMigration,
    /alter table public\.supplier_orders[\s\S]*add column if not exists sent_at timestamptz,/
  );
  assert.match(
    foundationMigration,
    /status text not null default 'draft' check \(status in \('draft', 'sent', 'completed'\)\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null sent_at plus draft/UPDATE inserts", () => {
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
  assert.match(pgTap, /Supplier order send time is required/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(pgTap, /cannot mint sent status without sent_at/);
  assert.match(pgTap, /cannot mint completed status without sent_at/);
  assert.match(pgTap, /open draft without sent_at/);
});
