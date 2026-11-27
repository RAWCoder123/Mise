import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateMiseActionsFailureEvidence } from "../services/domain/miseActionsFailureEvidence";

const migrationPath =
  "supabase/migrations/20261127090000_mise_actions_failure_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/mise_actions_failure_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/miseActionsFailureEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateMiseActionsFailureEvidence rejects failed/unverified without error evidence", () => {
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "failed",
      errorCode: null,
      errorMessage: null,
    }),
    "missing_error_code"
  );
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "failed",
      errorCode: "   ",
      errorMessage: "Provider rejected the send.",
    }),
    "missing_error_code"
  );
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "unverified",
      errorCode: "provider_unknown",
      errorMessage: null,
    }),
    "missing_error_message"
  );
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "unverified",
      errorCode: "provider_unknown",
      errorMessage: "   ",
    }),
    "missing_error_message"
  );
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "failed",
      errorCode: "",
      errorMessage: "missing code",
    }),
    "missing_error_code"
  );
});

test("validateMiseActionsFailureEvidence accepts non-failure and stamped failure statuses", () => {
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "waiting_for_approval",
    }),
    null
  );
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "prepared",
    }),
    null
  );
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "executed",
      errorCode: null,
      errorMessage: null,
    }),
    null
  );
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "failed",
      errorCode: "provider_not_enabled",
      errorMessage: "Supplier delivery is disabled for this restaurant.",
    }),
    null
  );
  assert.equal(
    validateMiseActionsFailureEvidence({
      status: "unverified",
      errorCode: "provider_unknown",
      errorMessage: "Provider did not confirm acceptance.",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT failure-evidence guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_mise_actions_failure_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.mise_actions[\s\S]*enforce_mise_actions_failure_evidence/
  );
  assert.match(migration, /Mise action failure evidence is required/);
  assert.match(migration, /new\.status in \('failed', 'unverified'\)/);
  // No table-level NOT NULL / status-implies-error CHECK — that would block
  // legitimate non-failure rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+error_code\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+error_message\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}error_code\s+is\s+not\s+null/i
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
    /revoke all on function private\.enforce_mise_actions_failure_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_error_code/);
  assert.match(evidence, /missing_error_message/);
  // Hosted failure writer already requires both fields; columns stay nullable.
  assert.match(
    foundationMigration,
    /or p_error_code is null[\s\S]*or p_error_code !~ '\^\[a-z0-9_\]\{1,80\}\$'[\s\S]*or nullif\(trim\(p_error_message\), ''\) is null/
  );
  assert.match(foundationMigration, /error_code text,/);
  assert.match(foundationMigration, /error_message text,/);
});

test("pgTAP plan equals assertion call sites and covers null failure insert plus UPDATE escape", () => {
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
  assert.match(pgTap, /Mise action failure evidence is required/);
  assert.match(pgTap, /status = 'failed'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
