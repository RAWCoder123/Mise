import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSquareOauthClaimedAtEvidence } from "../services/domain/squareOauthClaimedAtEvidence";

const migrationPath =
  "supabase/migrations/20261128220000_square_oauth_claimed_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/square_oauth_claimed_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/squareOauthClaimedAtEvidence.ts",
  "utf8"
);
const oauthMigration = readFileSync(
  "supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
  "utf8"
);

test("validateSquareOauthClaimedAtEvidence rejects completed_at without claimed_at", () => {
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: "2026-11-28T10:00:00.000Z",
      claimedAt: null,
    }),
    "missing_claimed_at"
  );
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: new Date("2026-11-28T10:00:00.000Z"),
      claimedAt: "   ",
    }),
    "missing_claimed_at"
  );
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: "2026-11-28T10:00:00.000Z",
      claimedAt: "",
    }),
    "missing_claimed_at"
  );
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: "2026-11-28T10:00:00.000Z",
    }),
    "missing_claimed_at"
  );
});

test("validateSquareOauthClaimedAtEvidence accepts open/failed and stamped completions", () => {
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: null,
      claimedAt: null,
    }),
    null
  );
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: "   ",
      claimedAt: null,
    }),
    null
  );
  assert.equal(validateSquareOauthClaimedAtEvidence({}), null);
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: null,
      claimedAt: "2026-11-28T10:00:00.000Z",
    }),
    null
  );
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: "2026-11-28T10:01:00.000Z",
      claimedAt: "2026-11-28T10:00:00.000Z",
    }),
    null
  );
  assert.equal(
    validateSquareOauthClaimedAtEvidence({
      completedAt: new Date("2026-11-28T10:01:00.000Z"),
      claimedAt: new Date("2026-11-28T10:00:00.000Z"),
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT claimed_at guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_square_oauth_claimed_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on private\.square_oauth_flows[\s\S]*enforce_square_oauth_claimed_at_evidence/
  );
  assert.match(migration, /Square OAuth claim time evidence is required/);
  assert.match(migration, /new\.completed_at is not null/);
  assert.match(migration, /new\.claimed_at is null/);
  // No table-level NOT NULL / completed-implies-claimed CHECK — tip stays
  // INSERT-only and preserves open/failed rows and UPDATE escapes.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+claimed_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}completed_at\s+is\s+not\s+null[\s\S]{0,120}claimed_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_complete_square_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_begin_square_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_claim_square_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_fail_square_oauth/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_square_oauth_claimed_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_claimed_at/);
  // Column stays nullable; begin writer INSERTs open flows without claimed_at.
  assert.match(oauthMigration, /claimed_at timestamptz,/);
  assert.match(oauthMigration, /completed_at timestamptz,/);
  assert.match(
    oauthMigration,
    /constraint square_oauth_flows_terminal_check check \(not \(completed_at is not null and failed_at is not null\)\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null claim insert plus UPDATE escape", () => {
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
  assert.match(pgTap, /Square OAuth claim time evidence is required/);
  assert.match(pgTap, /completed_at without claimed_at/);
  assert.match(pgTap, /failed_at without claimed_at/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
