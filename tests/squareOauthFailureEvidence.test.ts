import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSquareOauthFailureEvidence } from "../services/domain/squareOauthFailureEvidence";

const migrationPath =
  "supabase/migrations/20261128150000_square_oauth_failure_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/square_oauth_failure_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/squareOauthFailureEvidence.ts",
  "utf8"
);
const oauthMigration = readFileSync(
  "supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
  "utf8"
);

test("validateSquareOauthFailureEvidence rejects failed_at without failure_code", () => {
  assert.equal(
    validateSquareOauthFailureEvidence({
      failedAt: "2026-11-28T03:00:00.000Z",
      failureCode: null,
    }),
    "missing_failure_code"
  );
  assert.equal(
    validateSquareOauthFailureEvidence({
      failedAt: new Date("2026-11-28T03:00:00.000Z"),
      failureCode: "   ",
    }),
    "missing_failure_code"
  );
  assert.equal(
    validateSquareOauthFailureEvidence({
      failedAt: "2026-11-28T03:00:00.000Z",
      failureCode: "",
    }),
    "missing_failure_code"
  );
  assert.equal(
    validateSquareOauthFailureEvidence({
      failedAt: "2026-11-28T03:00:00.000Z",
    }),
    "missing_failure_code"
  );
});

test("validateSquareOauthFailureEvidence accepts open/completed and stamped failures", () => {
  assert.equal(
    validateSquareOauthFailureEvidence({
      failedAt: null,
      failureCode: null,
    }),
    null
  );
  assert.equal(
    validateSquareOauthFailureEvidence({
      failedAt: "   ",
      failureCode: null,
    }),
    null
  );
  assert.equal(
    validateSquareOauthFailureEvidence({}),
    null
  );
  assert.equal(
    validateSquareOauthFailureEvidence({
      failedAt: "2026-11-28T03:00:00.000Z",
      failureCode: "provider_denied",
    }),
    null
  );
  assert.equal(
    validateSquareOauthFailureEvidence({
      failedAt: new Date("2026-11-28T03:00:00.000Z"),
      failureCode: "superseded",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT failure-evidence guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_square_oauth_failure_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on private\.square_oauth_flows[\s\S]*enforce_square_oauth_failure_evidence/
  );
  assert.match(migration, /Square OAuth failure evidence is required/);
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
    /create or replace function private\.service_fail_square_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_fail_square_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_begin_square_oauth/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_square_oauth_failure_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_failure_code/);
  // Column stays nullable; begin writers INSERT open flows without evidence.
  assert.match(oauthMigration, /failure_code text check/);
  assert.match(
    oauthMigration,
    /insert into private\.square_oauth_flows \([\s\S]*expires_at/
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
  assert.match(pgTap, /Square OAuth failure evidence is required/);
  assert.match(pgTap, /failed_at/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
