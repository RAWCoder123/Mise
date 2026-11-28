import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOutreachEnrollmentProcessingClaimedAtEvidence } from "../services/domain/outreachEnrollmentProcessingClaimedAtEvidence";

const migrationPath =
  "supabase/migrations/20261128260000_outreach_enrollment_processing_claimed_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/outreach_enrollment_processing_claimed_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/outreachEnrollmentProcessingClaimedAtEvidence.ts",
  "utf8"
);
const outreachMigration = readFileSync(
  "supabase/migrations/20260718010000_outreach_agent.sql",
  "utf8"
);

test("validateOutreachEnrollmentProcessingClaimedAtEvidence rejects processing without claimed_at", () => {
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "processing",
      claimedAt: null,
    }),
    "missing_claimed_at"
  );
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "processing",
      claimedAt: "   ",
    }),
    "missing_claimed_at"
  );
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "processing",
      claimedAt: "",
    }),
    "missing_claimed_at"
  );
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "processing",
    }),
    "missing_claimed_at"
  );
});

test("validateOutreachEnrollmentProcessingClaimedAtEvidence accepts queued/ready/contacted and stamped processing", () => {
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "queued",
      claimedAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "ready",
      claimedAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "contacted",
      claimedAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "completed",
      claimedAt: null,
    }),
    null
  );
  assert.equal(validateOutreachEnrollmentProcessingClaimedAtEvidence({}), null);
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "processing",
      claimedAt: "2026-11-28T14:00:00.000Z",
    }),
    null
  );
  assert.equal(
    validateOutreachEnrollmentProcessingClaimedAtEvidence({
      status: "processing",
      claimedAt: new Date("2026-11-28T14:00:00.000Z"),
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT processing claimed_at guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_outreach_enrollment_processing_claimed_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.outreach_enrollments[\s\S]*enforce_outreach_enrollment_processing_claimed_at_evidence/
  );
  assert.match(migration, /Outreach enrollment claim time is required/);
  assert.match(migration, /new\.status = 'processing'/);
  assert.match(migration, /new\.claimed_at is null/);
  // Contacted/completed last_sent_at remain #1333/#1334 boundaries; this tip
  // must not absorb them in the trigger body.
  assert.doesNotMatch(migration, /new\.status = 'contacted'/);
  assert.doesNotMatch(migration, /new\.status = 'completed'/);
  assert.doesNotMatch(migration, /new\.last_sent_at/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and preserves queued/ready/contacted rows and UPDATE escapes.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+claimed_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s*=\s*'processing'[\s\S]{0,120}claimed_at\s+is\s+not\s+null/i
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
    /revoke all on function private\.enforce_outreach_enrollment_processing_claimed_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_claimed_at/);
  // Column stays nullable; enrollment writers INSERT queued without claim time.
  assert.match(outreachMigration, /claimed_at timestamptz,/);
  assert.match(
    outreachMigration,
    /'queued', 'awaiting_review', 'ready', 'processing', 'contacted'/
  );
});

test("pgTAP plan equals assertion call sites and covers null processing insert plus UPDATE escape", () => {
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
  assert.match(pgTap, /Outreach enrollment claim time is required/);
  assert.match(pgTap, /processing status without claimed_at/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
