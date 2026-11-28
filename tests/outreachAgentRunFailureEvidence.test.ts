import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOutreachAgentRunFailureEvidence } from "../services/domain/outreachAgentRunFailureEvidence";

const migrationPath =
  "supabase/migrations/20261128180000_outreach_agent_run_failure_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/outreach_agent_run_failure_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/outreachAgentRunFailureEvidence.ts",
  "utf8"
);
const outreachMigration = readFileSync(
  "supabase/migrations/20260718010000_outreach_agent.sql",
  "utf8"
);

test("validateOutreachAgentRunFailureEvidence rejects failed without error_summary", () => {
  assert.equal(
    validateOutreachAgentRunFailureEvidence({
      status: "failed",
      errorSummary: null,
    }),
    "missing_error_summary"
  );
  assert.equal(
    validateOutreachAgentRunFailureEvidence({
      status: "failed",
      errorSummary: "   ",
    }),
    "missing_error_summary"
  );
  assert.equal(
    validateOutreachAgentRunFailureEvidence({
      status: "failed",
      errorSummary: "",
    }),
    "missing_error_summary"
  );
  assert.equal(
    validateOutreachAgentRunFailureEvidence({
      status: "failed",
    }),
    "missing_error_summary"
  );
});

test("validateOutreachAgentRunFailureEvidence accepts running/completed and stamped failures", () => {
  assert.equal(
    validateOutreachAgentRunFailureEvidence({
      status: "running",
      errorSummary: null,
    }),
    null
  );
  assert.equal(
    validateOutreachAgentRunFailureEvidence({
      status: "completed",
      errorSummary: null,
    }),
    null
  );
  assert.equal(
    validateOutreachAgentRunFailureEvidence({
      status: "completed",
      errorSummary: "non_fatal_claim_attention",
    }),
    null
  );
  assert.equal(validateOutreachAgentRunFailureEvidence({}), null);
  assert.equal(
    validateOutreachAgentRunFailureEvidence({
      status: "failed",
      errorSummary: "campaign_claim_rpc_unavailable",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT failure-evidence guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_outreach_agent_run_failure_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.outreach_agent_runs[\s\S]*enforce_outreach_agent_run_failure_evidence/
  );
  assert.match(migration, /Outreach agent run failure evidence is required/);
  assert.match(migration, /new\.status = 'failed'/);
  assert.match(
    migration,
    /nullif\(btrim\(new\.error_summary\), ''\) is null/
  );
  // No table-level NOT NULL / status-implies-error CHECK — tip stays
  // INSERT-only and preserves running/completed rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+error_summary\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s*=\s*'failed'[\s\S]{0,120}error_summary\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_claim_outreach/i
  );
  assert.doesNotMatch(
    migration,
    /from\("outreach_agent_runs"\)[\s\S]{0,80}\.insert/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_outreach_agent_run_failure_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_error_summary/);
  // Column stays nullable; agent writer INSERTs running without failure evidence.
  assert.match(outreachMigration, /error_summary text,/);
  assert.match(
    outreachMigration,
    /status in \('running', 'completed', 'failed'\)/
  );
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
  assert.equal(planned, 8);
  assert.match(pgTap, /Outreach agent run failure evidence is required/);
  assert.match(pgTap, /status = 'failed'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
