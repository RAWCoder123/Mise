import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateActivityResolutionActorEvidence } from "../services/domain/activityResolutionActorEvidence";

const migrationPath =
  "supabase/migrations/20261127040000_activity_resolution_actor_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/activity_resolution_actor_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/activityResolutionActorEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateActivityResolutionActorEvidence rejects resolved_at without resolved_by", () => {
  assert.equal(
    validateActivityResolutionActorEvidence({
      resolvedAt: "2026-11-27T03:00:00.000Z",
      resolvedBy: null,
    }),
    "missing_resolved_by"
  );
  assert.equal(
    validateActivityResolutionActorEvidence({
      resolvedAt: "2026-11-27T03:00:00.000Z",
      resolvedBy: "   ",
    }),
    "missing_resolved_by"
  );
  assert.equal(
    validateActivityResolutionActorEvidence({
      resolvedAt: "2026-11-27T03:00:00.000Z",
      resolvedBy: undefined,
    }),
    "missing_resolved_by"
  );
  assert.equal(
    validateActivityResolutionActorEvidence({
      resolvedAt: "2026-11-27T03:00:00.000Z",
      resolvedBy: "",
    }),
    "missing_resolved_by"
  );
});

test("validateActivityResolutionActorEvidence accepts unresolved and attributed resolutions", () => {
  assert.equal(
    validateActivityResolutionActorEvidence({
      resolvedAt: null,
      resolvedBy: null,
    }),
    null
  );
  assert.equal(
    validateActivityResolutionActorEvidence({}),
    null
  );
  assert.equal(
    validateActivityResolutionActorEvidence({
      resolvedAt: "2026-11-27T03:00:00.000Z",
      resolvedBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT resolution-actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_activity_resolution_actor_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.activity_events[\s\S]*enforce_activity_resolution_actor_evidence/
  );
  assert.match(migration, /Activity resolution actor is required/);
  // No table-level NOT NULL / resolved-implies-actor CHECK — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+resolved_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}resolved_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.append_activity_event/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_activity_resolution_actor_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_resolved_by/);
  // Soft CHECK already allows resolved_at without resolved_by (anonymization escape).
  assert.match(
    foundationMigration,
    /constraint activity_events_resolution_check[\s\S]*resolved_at is not null/
  );
  assert.match(
    foundationMigration,
    /resolved_by uuid references auth\.users\(id\) on delete set null/
  );
});

test("pgTAP plan equals assertion call sites and covers null resolution actors plus anonymization", () => {
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
  assert.equal(planned, 11);
  assert.match(pgTap, /Activity resolution actor is required/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /append_activity_event/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
