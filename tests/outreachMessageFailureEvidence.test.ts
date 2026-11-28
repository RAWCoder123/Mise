import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOutreachMessageFailureEvidence } from "../services/domain/outreachMessageFailureEvidence";

const migrationPath =
  "supabase/migrations/20261128170000_outreach_message_failure_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/outreach_message_failure_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/outreachMessageFailureEvidence.ts",
  "utf8"
);
const outreachMigration = readFileSync(
  "supabase/migrations/20260718010000_outreach_agent.sql",
  "utf8"
);

test("validateOutreachMessageFailureEvidence rejects failed/send_unknown without last_error", () => {
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "failed",
      lastError: null,
    }),
    "missing_last_error"
  );
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "failed",
      lastError: "   ",
    }),
    "missing_last_error"
  );
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "send_unknown",
      lastError: "",
    }),
    "missing_last_error"
  );
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "send_unknown",
    }),
    "missing_last_error"
  );
});

test("validateOutreachMessageFailureEvidence accepts draft/sent and stamped failures", () => {
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "draft",
      lastError: null,
    }),
    null
  );
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "sent",
      lastError: null,
    }),
    null
  );
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "approved",
      lastError: null,
    }),
    null
  );
  assert.equal(validateOutreachMessageFailureEvidence({}), null);
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "failed",
      lastError: "resend_http_500",
    }),
    null
  );
  assert.equal(
    validateOutreachMessageFailureEvidence({
      status: "send_unknown",
      lastError: "provider_response_unknown",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT failure-evidence guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_outreach_message_failure_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.outreach_messages[\s\S]*enforce_outreach_message_failure_evidence/
  );
  assert.match(migration, /Outreach message failure evidence is required/);
  assert.match(migration, /new\.status in \('failed', 'send_unknown'\)/);
  assert.match(
    migration,
    /nullif\(btrim\(new\.last_error\), ''\) is null/
  );
  // No table-level NOT NULL / status-implies-error CHECK — tip stays
  // INSERT-only and preserves draft/sent rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+last_error\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s+in\s*\(\s*'failed'[\s\S]{0,120}last_error\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_claim_outreach/i
  );
  assert.doesNotMatch(
    migration,
    /from\("outreach_messages"\)[\s\S]{0,80}\.insert/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_outreach_message_failure_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_last_error/);
  // Column stays nullable; draft writers INSERT without failure evidence.
  assert.match(outreachMigration, /last_error text,/);
  assert.match(
    outreachMigration,
    /status in \('draft', 'approved', 'sending', 'sent', 'delivered', 'failed', 'send_unknown'/
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
  assert.equal(planned, 9);
  assert.match(pgTap, /Outreach message failure evidence is required/);
  assert.match(pgTap, /status = 'failed'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
