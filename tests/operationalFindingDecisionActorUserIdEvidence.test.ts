import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOperationalFindingDecisionActorUserIdEvidence } from "../services/domain/operationalFindingDecisionActorUserIdEvidence";

const migrationPath =
  "supabase/migrations/20261126220000_operational_finding_decision_actor_userid_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/operational_finding_decision_actor_userid_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/operationalFindingDecisionActorUserIdEvidence.ts",
  "utf8"
);
const findingDecisionMigration = readFileSync(
  "supabase/migrations/20260728192830_append_operational_finding_decisions.sql",
  "utf8"
);

test("validateOperationalFindingDecisionActorUserIdEvidence rejects null, undefined, and blank actors", () => {
  assert.equal(
    validateOperationalFindingDecisionActorUserIdEvidence({ actorUserId: null }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateOperationalFindingDecisionActorUserIdEvidence({
      actorUserId: undefined,
    }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateOperationalFindingDecisionActorUserIdEvidence({ actorUserId: "" }),
    "missing_actor_user_id"
  );
  assert.equal(
    validateOperationalFindingDecisionActorUserIdEvidence({
      actorUserId: "   ",
    }),
    "missing_actor_user_id"
  );
});

test("validateOperationalFindingDecisionActorUserIdEvidence accepts a non-empty actor id", () => {
  assert.equal(
    validateOperationalFindingDecisionActorUserIdEvidence({
      actorUserId: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_operational_finding_decision_actor_userid_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.operational_finding_decisions[\s\S]*enforce_operational_finding_decision_actor_userid_evidence/
  );
  assert.match(migration, /Operational finding decision actor is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+actor_user_id\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}actor_user_id\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.record_operational_finding_decision/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.reject_operational_finding_decision_mutation/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_operational_finding_decision_actor_userid_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_actor_user_id/);
  // Hosted writer already stamps auth.uid(); anonymization escape already exists.
  assert.match(
    findingDecisionMigration,
    /idempotency_key,\s*actor_user_id\s*\)[\s\S]*auth\.uid\(\)/
  );
  assert.match(
    findingDecisionMigration,
    /old\.actor_user_id is not null[\s\S]*new\.actor_user_id is null/
  );
});

test("pgTAP plan equals assertion call sites and covers null insert plus anonymization", () => {
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
  assert.equal(planned, 8);
  assert.match(pgTap, /Operational finding decision actor is required/);
  assert.match(pgTap, /actor_user_id[\s\S]*null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /record_operational_finding_decision/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
