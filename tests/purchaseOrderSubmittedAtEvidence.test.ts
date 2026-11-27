import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePurchaseOrderSubmittedAtEvidence } from "../services/domain/purchaseOrderSubmittedAtEvidence";

const migrationPath =
  "supabase/migrations/20261127190000_purchase_order_submitted_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_order_submitted_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/purchaseOrderSubmittedAtEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/202606210002_restaurant_ops_backbone.sql",
  "utf8"
);

test("validatePurchaseOrderSubmittedAtEvidence rejects submitted/received rows without submitted_at", () => {
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "submitted",
      submittedAt: null,
    }),
    "missing_submitted_at"
  );
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "received",
      submittedAt: null,
    }),
    "missing_submitted_at"
  );
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "submitted",
      submittedAt: "   ",
    }),
    "missing_submitted_at"
  );
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "received",
      submittedAt: "",
    }),
    "missing_submitted_at"
  );
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "submitted",
    }),
    "missing_submitted_at"
  );
});

test("validatePurchaseOrderSubmittedAtEvidence accepts draft, cancelled, and time-stamped terminal rows", () => {
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "draft",
      submittedAt: null,
    }),
    null
  );
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "cancelled",
      submittedAt: null,
    }),
    null
  );
  assert.equal(validatePurchaseOrderSubmittedAtEvidence({}), null);
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "submitted",
      submittedAt: "2024-01-02T00:00:00Z",
    }),
    null
  );
  assert.equal(
    validatePurchaseOrderSubmittedAtEvidence({
      status: "received",
      submittedAt: "2024-01-03T00:00:00Z",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT submission-time guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_order_submitted_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.purchase_orders[\s\S]*enforce_purchase_order_submitted_at_evidence/
  );
  assert.match(migration, /Purchase order submission time is required/);
  assert.match(migration, /new\.status in \('submitted', 'received'\)/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and preserves draft/cancelled inserts plus submit UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+submitted_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}submitted_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.\w*purchase_order/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_purchase_order_submitted_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_submitted_at/);
  // Column is nullable; status vocabulary includes submitted/received.
  assert.match(
    foundationMigration,
    /create table if not exists public\.purchase_orders[\s\S]*submitted_at timestamptz,/
  );
  assert.match(
    foundationMigration,
    /status text not null default 'draft' check \(status in \('draft', 'submitted', 'received', 'cancelled'\)\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null submitted_at plus draft/UPDATE inserts", () => {
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
  assert.match(pgTap, /Purchase order submission time is required/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(pgTap, /cannot mint submitted status without submitted_at/);
  assert.match(pgTap, /cannot mint received status without submitted_at/);
  assert.match(pgTap, /open draft without submitted_at/);
  assert.match(pgTap, /open cancelled without submitted_at/);
});
