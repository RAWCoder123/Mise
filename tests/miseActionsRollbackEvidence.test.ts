import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateMiseActionsRollbackEvidence } from "../services/domain/miseActionsRollbackEvidence";

const migrationPath =
  "supabase/migrations/20261127100000_mise_actions_rollback_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/mise_actions_rollback_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/miseActionsRollbackEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);
const domainActions = readFileSync("services/domain/miseActions.ts", "utf8");

test("validateMiseActionsRollbackEvidence rejects reversed without rollback evidence", () => {
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "reversed",
      rollbackReference: null,
    }),
    "missing_rollback_reference"
  );
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "reversed",
      rollbackReference: "   ",
    }),
    "missing_rollback_reference"
  );
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "reversed",
      rollbackReference: "",
    }),
    "missing_rollback_reference"
  );
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "reversed",
    }),
    "missing_rollback_reference"
  );
});

test("validateMiseActionsRollbackEvidence accepts non-reversed and stamped reversed statuses", () => {
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "waiting_for_approval",
    }),
    null
  );
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "prepared",
    }),
    null
  );
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "executed",
      rollbackReference: null,
    }),
    null
  );
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "failed",
      rollbackReference: null,
    }),
    null
  );
  assert.equal(
    validateMiseActionsRollbackEvidence({
      status: "reversed",
      rollbackReference: "rollback:supplier_order:a0000000-0000-4000-8000-0000000000aa",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT rollback-evidence guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_mise_actions_rollback_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.mise_actions[\s\S]*enforce_mise_actions_rollback_evidence/
  );
  assert.match(migration, /Mise action rollback evidence is required/);
  assert.match(migration, /new\.status = 'reversed'/);
  // No table-level NOT NULL / status-implies-reference CHECK — that would
  // block legitimate non-reversed rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+rollback_reference\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}rollback_reference\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.decide_mise_action/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_record_mise_action_failure/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_mise_actions_rollback_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_rollback_reference/);
  // Domain markReversed already requires a rollback reference; column stays
  // nullable for non-reversed rows.
  assert.match(domainActions, /function markReversed\(/);
  assert.match(domainActions, /rollbackReference: rollbackReference\.trim\(\)/);
  assert.match(foundationMigration, /rollback_reference text,/);
});

test("pgTAP plan equals assertion call sites and covers null reversed insert plus UPDATE escape", () => {
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
  assert.equal(planned, 7);
  assert.match(pgTap, /Mise action rollback evidence is required/);
  assert.match(pgTap, /status = 'reversed'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
