import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateMiseActionsDecisionActorEvidence } from "../services/domain/miseActionsDecisionActorEvidence";

const migrationPath =
  "supabase/migrations/20261127020000_mise_actions_decision_actor_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/mise_actions_decision_actor_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/miseActionsDecisionActorEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateMiseActionsDecisionActorEvidence rejects decision status without approved_by", () => {
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "approved",
      approvedBy: null,
    }),
    "missing_approved_by"
  );
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "approved",
      approvedBy: "   ",
    }),
    "missing_approved_by"
  );
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "rejected",
      approvedBy: undefined,
    }),
    "missing_approved_by"
  );
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "rejected",
      approvedBy: "",
    }),
    "missing_approved_by"
  );
});

test("validateMiseActionsDecisionActorEvidence accepts pre-decision and attributed decision statuses", () => {
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "waiting_for_approval",
    }),
    null
  );
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "prepared",
    }),
    null
  );
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "executed",
    }),
    null
  );
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "approved",
      approvedBy: "user-manager-1",
    }),
    null
  );
  assert.equal(
    validateMiseActionsDecisionActorEvidence({
      status: "rejected",
      approvedBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT decision-actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_mise_actions_decision_actor_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.mise_actions[\s\S]*enforce_mise_actions_decision_actor_evidence/
  );
  assert.match(migration, /Mise action decision actor is required/);
  // No table-level NOT NULL / status-implies-actor CHECK — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+approved_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}approved_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.decide_mise_action/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_mise_actions_decision_actor_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_approved_by/);
  // Hosted writer stamps auth.uid() via UPDATE; anonymization escape already exists.
  assert.match(
    foundationMigration,
    /approved_by = auth\.uid\(\)/
  );
  assert.match(
    foundationMigration,
    /approved_by uuid references auth\.users\(id\) on delete set null/
  );
});

test("pgTAP plan equals assertion call sites and covers null decision actors plus anonymization", () => {
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
  assert.match(pgTap, /Mise action decision actor is required/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /decide_mise_action/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
