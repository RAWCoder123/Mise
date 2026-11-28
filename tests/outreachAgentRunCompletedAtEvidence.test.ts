import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOutreachAgentRunCompletedAtEvidence } from "../services/domain/outreachAgentRunCompletedAtEvidence";

const migrationPath =
  "supabase/migrations/20261128200000_outreach_agent_run_completed_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/outreach_agent_run_completed_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/outreachAgentRunCompletedAtEvidence.ts",
  "utf8"
);
const outreachMigration = readFileSync(
  "supabase/migrations/20260718010000_outreach_agent.sql",
  "utf8"
);

test("validateOutreachAgentRunCompletedAtEvidence rejects completed/failed without completed_at", () => {
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "completed",
      completedAt: null,
    }),
    "missing_completed_at"
  );
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "failed",
      completedAt: null,
    }),
    "missing_completed_at"
  );
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "completed",
      completedAt: "   ",
    }),
    "missing_completed_at"
  );
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "failed",
      completedAt: "",
    }),
    "missing_completed_at"
  );
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "completed",
    }),
    "missing_completed_at"
  );
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "failed",
    }),
    "missing_completed_at"
  );
});

test("validateOutreachAgentRunCompletedAtEvidence accepts running and stamped terminal runs", () => {
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "running",
      completedAt: null,
    }),
    null
  );
  assert.equal(validateOutreachAgentRunCompletedAtEvidence({}), null);
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "completed",
      completedAt: "2026-11-28T08:00:00.000Z",
    }),
    null
  );
  assert.equal(
    validateOutreachAgentRunCompletedAtEvidence({
      status: "failed",
      completedAt: "2026-11-28T08:00:00.000Z",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT completed_at guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_outreach_agent_run_completed_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.outreach_agent_runs[\s\S]*enforce_outreach_agent_run_completed_at_evidence/
  );
  assert.match(
    migration,
    /Outreach agent run completion time evidence is required/
  );
  assert.match(migration, /new\.status in \('completed', 'failed'\)/);
  assert.match(migration, /new\.completed_at is null/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and preserves running rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+completed_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s+in\s*\(\s*'completed'[\s\S]{0,80}completed_at\s+is\s+not\s+null/i
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
    /revoke all on function private\.enforce_outreach_agent_run_completed_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_completed_at/);
  // Column stays nullable; agent writer INSERTs running without completed_at.
  assert.match(outreachMigration, /completed_at timestamptz,/);
  assert.match(
    outreachMigration,
    /status in \('running', 'completed', 'failed'\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null completion insert plus UPDATE escape", () => {
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
  assert.match(pgTap, /Outreach agent run completion time evidence is required/);
  assert.match(pgTap, /status = 'completed'/);
  assert.match(pgTap, /status = 'failed'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
