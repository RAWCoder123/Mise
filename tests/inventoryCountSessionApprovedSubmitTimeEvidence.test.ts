import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateInventoryCountSessionApprovedSubmitTimeEvidence } from "../services/domain/inventoryCountSessionApprovedSubmitTimeEvidence";

const migrationPath =
  "supabase/migrations/20261128000000_inventory_count_session_approved_submit_time_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_count_session_approved_submit_time_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/inventoryCountSessionApprovedSubmitTimeEvidence.ts",
  "utf8"
);
const countSessionMigration = readFileSync(
  "supabase/migrations/20260810140000_inventory_count_sessions_ledger.sql",
  "utf8"
);

test("validateInventoryCountSessionApprovedSubmitTimeEvidence rejects approved rows without submitted_at", () => {
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({
      status: "approved",
      submittedAt: null,
    }),
    "missing_submitted_at"
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({
      status: "approved",
      submittedAt: "   ",
    }),
    "missing_submitted_at"
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({
      status: "approved",
      submittedAt: "",
    }),
    "missing_submitted_at"
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({
      status: "approved",
    }),
    "missing_submitted_at"
  );
});

test("validateInventoryCountSessionApprovedSubmitTimeEvidence accepts non-approved and stamped approved rows", () => {
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({
      status: "in_progress",
      submittedAt: null,
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({
      status: "submitted",
      submittedAt: "2024-01-02T00:00:00Z",
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({
      status: "cancelled",
      submittedAt: null,
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({}),
    null
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitTimeEvidence({
      status: "approved",
      submittedAt: "2024-01-02T00:00:00Z",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT approved submit-time guard without a CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_count_session_approved_submit_time_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_count_sessions[\s\S]*enforce_inventory_count_session_approved_submit_time_evidence/
  );
  assert.match(
    migration,
    /Inventory count session submit time is required for approved inserts/
  );
  assert.match(migration, /new\.status = 'approved'/);
  assert.match(migration, /new\.submitted_at is null/);
  // No table-level NOT NULL / status-implies-submitted_at CHECK for approved —
  // tip stays INSERT-only and preserves approve UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+submitted_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s*=\s*'approved'[\s\S]{0,120}submitted_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.\w*inventory_count_session/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_count_session_approved_submit_time_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_submitted_at/);
  // Soft CHECK only pairs submitted_at with status = submitted.
  assert.match(
    countSessionMigration,
    /constraint inventory_count_sessions_submitted_consistency check \(\s*\(status = 'submitted' and submitted_at is not null\)/
  );
  assert.match(
    countSessionMigration,
    /constraint inventory_count_sessions_approved_consistency check \(\s*\(status = 'approved' and approved_at is not null\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null submitted_at plus approve UPDATE", () => {
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
  assert.match(
    pgTap,
    /Inventory count session submit time is required for approved inserts/
  );
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(pgTap, /cannot mint approved status without submitted_at/);
  assert.match(pgTap, /approve UPDATE with inherited submitted_at/);
});
