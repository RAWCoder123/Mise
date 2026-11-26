import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateInventoryCountSessionWorkflowActorEvidence } from "../services/domain/inventoryCountSessionWorkflowActorEvidence";

const migrationPath =
  "supabase/migrations/20261127000000_inventory_count_session_workflow_actor_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_count_session_workflow_actor_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/inventoryCountSessionWorkflowActorEvidence.ts",
  "utf8"
);
const countSessionMigration = readFileSync(
  "supabase/migrations/20260810140000_inventory_count_sessions_ledger.sql",
  "utf8"
);

test("validateInventoryCountSessionWorkflowActorEvidence rejects terminal status without the matching actor", () => {
  assert.equal(
    validateInventoryCountSessionWorkflowActorEvidence({
      status: "submitted",
      submittedBy: null,
    }),
    "missing_submitted_by"
  );
  assert.equal(
    validateInventoryCountSessionWorkflowActorEvidence({
      status: "submitted",
      submittedBy: "   ",
    }),
    "missing_submitted_by"
  );
  assert.equal(
    validateInventoryCountSessionWorkflowActorEvidence({
      status: "approved",
      approvedBy: undefined,
    }),
    "missing_approved_by"
  );
  assert.equal(
    validateInventoryCountSessionWorkflowActorEvidence({
      status: "cancelled",
      cancelledBy: null,
    }),
    "missing_cancelled_by"
  );
});

test("validateInventoryCountSessionWorkflowActorEvidence accepts in_progress and attributed terminal statuses", () => {
  assert.equal(
    validateInventoryCountSessionWorkflowActorEvidence({
      status: "in_progress",
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionWorkflowActorEvidence({
      status: "submitted",
      submittedBy: "user-manager-1",
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionWorkflowActorEvidence({
      status: "approved",
      approvedBy: "user-manager-1",
    }),
    null
  );
  assert.equal(
    validateInventoryCountSessionWorkflowActorEvidence({
      status: "cancelled",
      cancelledBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT workflow-actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_count_session_workflow_actor_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_count_sessions[\s\S]*enforce_inventory_count_session_workflow_actor_evidence/
  );
  assert.match(migration, /Inventory count session submitter is required/);
  assert.match(migration, /Inventory count session approver is required/);
  assert.match(migration, /Inventory count session canceller is required/);
  // No table-level NOT NULL / status-implies-actor CHECK — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+(submitted_by|approved_by|cancelled_by)\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}(submitted_by|approved_by|cancelled_by)\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_begin_inventory_count_session/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_submit_inventory_count_session/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_approve_inventory_count_session/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_cancel_inventory_count_session/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_count_session_workflow_actor_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_submitted_by/);
  assert.match(evidence, /missing_approved_by/);
  assert.match(evidence, /missing_cancelled_by/);
  // Soft CHECKs already require matching timestamps; actors stay nullable for anonymization.
  assert.match(
    countSessionMigration,
    /submitted_by uuid references auth\.users\(id\) on delete set null/
  );
  assert.match(
    countSessionMigration,
    /approved_by uuid references auth\.users\(id\) on delete set null/
  );
  assert.match(
    countSessionMigration,
    /cancelled_by uuid references auth\.users\(id\) on delete set null/
  );
  assert.match(
    countSessionMigration,
    /inventory_count_sessions_submitted_consistency/
  );
});

test("pgTAP plan equals assertion call sites and covers null workflow actors plus anonymization", () => {
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
  assert.equal(planned, 11);
  assert.match(pgTap, /Inventory count session submitter is required/);
  assert.match(pgTap, /Inventory count session approver is required/);
  assert.match(pgTap, /Inventory count session canceller is required/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /service_begin_inventory_count_session/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
