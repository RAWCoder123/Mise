import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOutreachEnrollmentLastSentAtEvidence } from "../services/domain/outreachEnrollmentLastSentAtEvidence";

const migrationPath =
  "supabase/migrations/20261128240000_outreach_enrollment_last_sent_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/outreach_enrollment_last_sent_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/outreachEnrollmentLastSentAtEvidence.ts",
  "utf8"
);
const outreachMigration = readFileSync(
  "supabase/migrations/20260718010000_outreach_agent.sql",
  "utf8"
);

test("validateOutreachEnrollmentLastSentAtEvidence rejects contacted without last_sent_at", () => {
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "contacted",
      lastSentAt: null,
    }),
    "missing_last_sent_at"
  );
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "contacted",
      lastSentAt: "   ",
    }),
    "missing_last_sent_at"
  );
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "contacted",
      lastSentAt: "",
    }),
    "missing_last_sent_at"
  );
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "contacted",
    }),
    "missing_last_sent_at"
  );
});

test("validateOutreachEnrollmentLastSentAtEvidence accepts queued/ready/completed and stamped contacted", () => {
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "queued",
      lastSentAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "ready",
      lastSentAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "completed",
      lastSentAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "processing",
      lastSentAt: null,
    }),
    null
  );
  assert.equal(validateOutreachEnrollmentLastSentAtEvidence({}), null);
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "contacted",
      lastSentAt: "2026-11-28T12:00:00.000Z",
    }),
    null
  );
  assert.equal(
    validateOutreachEnrollmentLastSentAtEvidence({
      status: "contacted",
      lastSentAt: new Date("2026-11-28T12:00:00.000Z"),
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT last_sent_at guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_outreach_enrollment_last_sent_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.outreach_enrollments[\s\S]*enforce_outreach_enrollment_last_sent_at_evidence/
  );
  assert.match(migration, /Outreach enrollment send time is required/);
  assert.match(migration, /new\.status = 'contacted'/);
  assert.match(migration, /new\.last_sent_at is null/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and preserves queued/ready/completed rows and UPDATE escapes.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+last_sent_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s*=\s*'contacted'[\s\S]{0,120}last_sent_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_/i
  );
  assert.doesNotMatch(
    migration,
    /from\("outreach_enrollments"\)[\s\S]{0,80}\.(insert|update)/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_outreach_enrollment_last_sent_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_last_sent_at/);
  // Column stays nullable; enrollment writers INSERT queued without send time.
  assert.match(outreachMigration, /last_sent_at timestamptz,/);
  assert.match(
    outreachMigration,
    /'queued', 'awaiting_review', 'ready', 'processing', 'contacted'/
  );
});

test("pgTAP plan equals assertion call sites and covers null contacted insert plus UPDATE escape", () => {
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
  assert.match(pgTap, /Outreach enrollment send time is required/);
  assert.match(pgTap, /contacted status without last_sent_at/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
