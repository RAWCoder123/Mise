import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOutreachMessageSentAtEvidence } from "../services/domain/outreachMessageSentAtEvidence";

const migrationPath =
  "supabase/migrations/20261128190000_outreach_message_sent_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/outreach_message_sent_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/outreachMessageSentAtEvidence.ts",
  "utf8"
);
const outreachMigration = readFileSync(
  "supabase/migrations/20260718010000_outreach_agent.sql",
  "utf8"
);

test("validateOutreachMessageSentAtEvidence rejects sent/delivered without sent_at", () => {
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "sent",
      sentAt: null,
    }),
    "missing_sent_at"
  );
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "sent",
      sentAt: "   ",
    }),
    "missing_sent_at"
  );
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "delivered",
      sentAt: "",
    }),
    "missing_sent_at"
  );
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "delivered",
    }),
    "missing_sent_at"
  );
});

test("validateOutreachMessageSentAtEvidence accepts draft/failed and stamped sends", () => {
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "draft",
      sentAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "failed",
      sentAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "approved",
      sentAt: null,
    }),
    null
  );
  assert.equal(validateOutreachMessageSentAtEvidence({}), null);
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "sent",
      sentAt: "2026-11-28T07:00:00.000Z",
    }),
    null
  );
  assert.equal(
    validateOutreachMessageSentAtEvidence({
      status: "delivered",
      sentAt: "2026-11-28T07:05:00.000Z",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT sent_at guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_outreach_message_sent_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.outreach_messages[\s\S]*enforce_outreach_message_sent_at_evidence/
  );
  assert.match(migration, /Outreach message send time is required/);
  assert.match(migration, /new\.status in \('sent', 'delivered'\)/);
  assert.match(migration, /new\.sent_at is null/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and preserves draft/failure rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+sent_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s+in\s*\(\s*'sent'[\s\S]{0,120}sent_at\s+is\s+not\s+null/i
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
    /revoke all on function private\.enforce_outreach_message_sent_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_sent_at/);
  // Column stays nullable; draft writers INSERT without send time.
  assert.match(outreachMigration, /sent_at timestamptz,/);
  assert.match(
    outreachMigration,
    /status in \('draft', 'approved', 'sending', 'sent', 'delivered', 'failed', 'send_unknown'/
  );
});

test("pgTAP plan equals assertion call sites and covers null sent insert plus UPDATE escape", () => {
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
  assert.match(pgTap, /Outreach message send time is required/);
  assert.match(pgTap, /status = 'sent'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
