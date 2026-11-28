import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateGmailOauthFailureEvidence } from "../services/domain/gmailOauthFailureEvidence";

const migrationPath =
  "supabase/migrations/20261128160000_gmail_oauth_failure_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/gmail_oauth_failure_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/gmailOauthFailureEvidence.ts",
  "utf8"
);
const oauthMigration = readFileSync(
  "supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
  "utf8"
);

test("validateGmailOauthFailureEvidence rejects failed_at without failure_code", () => {
  assert.equal(
    validateGmailOauthFailureEvidence({
      failedAt: "2026-11-28T04:00:00.000Z",
      failureCode: null,
    }),
    "missing_failure_code"
  );
  assert.equal(
    validateGmailOauthFailureEvidence({
      failedAt: new Date("2026-11-28T04:00:00.000Z"),
      failureCode: "   ",
    }),
    "missing_failure_code"
  );
  assert.equal(
    validateGmailOauthFailureEvidence({
      failedAt: "2026-11-28T04:00:00.000Z",
      failureCode: "",
    }),
    "missing_failure_code"
  );
  assert.equal(
    validateGmailOauthFailureEvidence({
      failedAt: "2026-11-28T04:00:00.000Z",
    }),
    "missing_failure_code"
  );
});

test("validateGmailOauthFailureEvidence accepts open/completed and stamped failures", () => {
  assert.equal(
    validateGmailOauthFailureEvidence({
      failedAt: null,
      failureCode: null,
    }),
    null
  );
  assert.equal(
    validateGmailOauthFailureEvidence({
      failedAt: "   ",
      failureCode: null,
    }),
    null
  );
  assert.equal(
    validateGmailOauthFailureEvidence({}),
    null
  );
  assert.equal(
    validateGmailOauthFailureEvidence({
      failedAt: "2026-11-28T04:00:00.000Z",
      failureCode: "provider_denied",
    }),
    null
  );
  assert.equal(
    validateGmailOauthFailureEvidence({
      failedAt: new Date("2026-11-28T04:00:00.000Z"),
      failureCode: "superseded",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT failure-evidence guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_gmail_oauth_failure_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on private\.gmail_oauth_flows[\s\S]*enforce_gmail_oauth_failure_evidence/
  );
  assert.match(migration, /Gmail OAuth failure evidence is required/);
  assert.match(migration, /new\.failed_at is not null/);
  assert.match(
    migration,
    /nullif\(btrim\(new\.failure_code\), ''\) is null/
  );
  // No table-level NOT NULL / failed_at-implies-code CHECK — tip stays
  // INSERT-only and preserves open/completed rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+failure_code\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}failed_at\s+is\s+not\s+null[\s\S]{0,120}failure_code\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_fail_gmail_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_fail_gmail_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_begin_gmail_oauth/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_gmail_oauth_failure_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_failure_code/);
  // Column stays nullable; begin writers INSERT open flows without evidence.
  assert.match(oauthMigration, /failure_code text check/);
  assert.match(
    oauthMigration,
    /insert into private\.gmail_oauth_flows \([\s\S]*expires_at/
  );
  assert.match(
    oauthMigration,
    /set failed_at = now\(\), failure_code = safe_code/
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
  assert.match(pgTap, /Gmail OAuth failure evidence is required/);
  assert.match(pgTap, /failed_at/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
