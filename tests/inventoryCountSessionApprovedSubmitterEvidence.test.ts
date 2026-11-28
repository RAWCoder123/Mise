import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateInventoryCountSessionApprovedSubmitterEvidence } from "../services/domain/inventoryCountSessionApprovedSubmitterEvidence";

const migrationPath =
  "supabase/migrations/20261128120000_inventory_count_session_approved_submitter_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_count_session_approved_submitter_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/inventoryCountSessionApprovedSubmitterEvidence.ts",
  "utf8"
);
const countSessionMigration = readFileSync(
  "supabase/migrations/20260810140000_inventory_count_sessions_ledger.sql",
  "utf8"
);

test("validateInventoryCountSessionApprovedSubmitterEvidence rejects approved rows without submitted_by", () => {
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({
      status: "approved",
      submittedBy: null,
    }),
    "missing_submitted_by"
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({
      status: "approved",
      submittedBy: "   ",
    }),
    "missing_submitted_by"
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({
      status: "approved",
      submittedBy: "",
    }),
    "missing_submitted_by"
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({
      status: "approved",
    }),
    "missing_submitted_by"
  );
});

test("validateInventoryCountSessionApprovedSubmitterEvidence accepts non-approved and attributed approved rows", () => {
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({
      status: "in_progress",
      submittedBy: null,
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({
      status: "submitted",
      submittedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({
      status: "cancelled",
      submittedBy: null,
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({}),
    null
  );
  assert.equal(
    validateInventoryCountSessionApprovedSubmitterEvidence({
      status: "approved",
      submittedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT approved submitter guard without a CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_count_session_approved_submitter_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_count_sessions[\s\S]*enforce_inventory_count_session_approved_submitter_evidence/
  );
  assert.match(
    migration,
    /Inventory count session submitter is required for approved inserts/
  );
  assert.match(migration, /new\.status = 'approved'/);
  assert.match(migration, /new\.submitted_by is null/);
  // No table-level NOT NULL / status-implies-submitted_by CHECK for approved —
  // tip stays INSERT-only and preserves approve UPDATEs / anonymization.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+submitted_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s*=\s*'approved'[\s\S]{0,120}submitted_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.\w*inventory_count_session/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_count_session_approved_submitter_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_submitted_by/);
  // Soft CHECK only pairs submitted_at with status = submitted.
  assert.match(
    countSessionMigration,
    /constraint inventory_count_sessions_submitted_consistency check \(\s*\(status = 'submitted' and submitted_at is not null\)/
  );
  assert.match(
    countSessionMigration,
    /constraint inventory_count_sessions_approved_consistency check \(\s*\(status = 'approved' and approved_at is not null\)/
  );
  assert.match(
    countSessionMigration,
    /submitted_by uuid references auth\.users\(id\) on delete set null/
  );
});

test("pgTAP plan equals assertion call sites and covers null submitted_by plus approve UPDATE", () => {
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
    /Inventory count session submitter is required for approved inserts/
  );
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(pgTap, /cannot mint approved status without submitted_by/);
  assert.match(pgTap, /approve UPDATE with inherited submitted_by/);
});
