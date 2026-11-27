import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateMiseActionsExecutedAtEvidence } from "../services/domain/miseActionsExecutedAtEvidence";

const migrationPath =
  "supabase/migrations/20261127080000_mise_actions_executed_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/mise_actions_executed_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/miseActionsExecutedAtEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateMiseActionsExecutedAtEvidence rejects executed status without executed_at", () => {
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "executed",
      executedAt: null,
    }),
    "missing_executed_at"
  );
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "executed",
      executedAt: "   ",
    }),
    "missing_executed_at"
  );
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "executed",
      executedAt: undefined,
    }),
    "missing_executed_at"
  );
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "executed",
      executedAt: "",
    }),
    "missing_executed_at"
  );
});

test("validateMiseActionsExecutedAtEvidence accepts pre-execution, failed, and stamped executed statuses", () => {
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "waiting_for_approval",
    }),
    null
  );
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "prepared",
    }),
    null
  );
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "failed",
    }),
    null
  );
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "unverified",
    }),
    null
  );
  assert.equal(
    validateMiseActionsExecutedAtEvidence({
      status: "executed",
      executedAt: "2026-11-27T08:00:00Z",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT executed_at guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_mise_actions_executed_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.mise_actions[\s\S]*enforce_mise_actions_executed_at_evidence/
  );
  assert.match(migration, /Mise action execution time is required/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — that would
  // block legitimate non-executed rows and failure UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+executed_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}executed_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.decide_mise_action/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_mise_actions_executed_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_executed_at/);
  // Hosted writers stamp executed_at when advancing to executed; column stays nullable.
  assert.match(
    foundationMigration,
    /executed_at = coalesce\(new\.sent_at, now\(\)\)/
  );
  assert.match(foundationMigration, /executed_at timestamptz,/);
});

test("pgTAP plan equals assertion call sites and covers null executed insert plus failure UPDATE escape", () => {
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
  assert.match(pgTap, /Mise action execution time is required/);
  assert.match(pgTap, /status = 'failed'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
