import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateActivityUserActorEvidence } from "../services/domain/activityUserActorEvidence";

const migrationPath =
  "supabase/migrations/20261127050000_activity_user_actor_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/activity_user_actor_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/activityUserActorEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateActivityUserActorEvidence rejects actor_type=user without actor_user_id", () => {
  assert.equal(
    validateActivityUserActorEvidence({
      actorType: "user",
      actorUserId: null,
    }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateActivityUserActorEvidence({
      actorType: "user",
      actorUserId: "   ",
    }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateActivityUserActorEvidence({
      actorType: "user",
      actorUserId: undefined,
    }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateActivityUserActorEvidence({
      actorType: "user",
      actorUserId: "",
    }),
    "missing_actor_user_id"
  );
});

test("validateActivityUserActorEvidence accepts non-user actors and attributed users", () => {
  assert.equal(
    validateActivityUserActorEvidence({
      actorType: "mise",
      actorUserId: null,
    }),
    null
  );
  assert.equal(
    validateActivityUserActorEvidence({
      actorType: "system",
      actorUserId: null,
    }),
    null
  );
  assert.equal(
    validateActivityUserActorEvidence({
      actorType: "integration",
      actorUserId: null,
    }),
    null
  );
  assert.equal(
    validateActivityUserActorEvidence({}),
    null
  );
  assert.equal(
    validateActivityUserActorEvidence({
      actorType: "user",
      actorUserId: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT user-actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_activity_user_actor_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.activity_events[\s\S]*enforce_activity_user_actor_evidence/
  );
  assert.match(migration, /Activity user actor is required/);
  // No table-level NOT NULL / user-implies-actor CHECK — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+actor_user_id\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}actor_type\s*=\s*'user'[\s\S]{0,80}actor_user_id\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.append_activity_event/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_activity_user_actor_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_actor_user_id/);
  // Soft actor_type CHECK already allows user without forcing actor_user_id.
  assert.match(
    foundationMigration,
    /actor_type text not null default 'mise' check \(actor_type in \('mise', 'user', 'integration', 'system'\)\)/
  );
  assert.match(
    foundationMigration,
    /actor_user_id uuid references auth\.users\(id\) on delete set null/
  );
});

test("pgTAP plan equals assertion call sites and covers null user actors plus anonymization", () => {
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
  assert.match(pgTap, /Activity user actor is required/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /append_activity_event/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
