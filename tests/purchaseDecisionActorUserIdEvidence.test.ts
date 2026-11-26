import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePurchaseDecisionActorUserIdEvidence } from "../services/domain/purchaseDecisionActorUserIdEvidence";

const migrationPath =
  "supabase/migrations/20261126210000_purchase_decision_actor_userid_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_decision_actor_userid_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/purchaseDecisionActorUserIdEvidence.ts",
  "utf8"
);
const memoryMigration = readFileSync(
  "supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql",
  "utf8"
);

test("validatePurchaseDecisionActorUserIdEvidence rejects null, undefined, and blank actors", () => {
  assert.equal(
    validatePurchaseDecisionActorUserIdEvidence({ actorUserId: null }),
    "missing_actor_user_id"
  );
  assert.equal(
    validatePurchaseDecisionActorUserIdEvidence({ actorUserId: undefined }),
    "missing_actor_user_id"
  );
  assert.equal(
    validatePurchaseDecisionActorUserIdEvidence({ actorUserId: "" }),
    "missing_actor_user_id"
  );
  assert.equal(
    validatePurchaseDecisionActorUserIdEvidence({ actorUserId: "   " }),
    "missing_actor_user_id"
  );
});

test("validatePurchaseDecisionActorUserIdEvidence accepts a non-empty actor id", () => {
  assert.equal(
    validatePurchaseDecisionActorUserIdEvidence({ actorUserId: "user-manager-1" }),
    null
  );
});

test("additive migration pins the BEFORE INSERT actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_decision_actor_userid_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.purchase_decision_events[\s\S]*enforce_purchase_decision_actor_userid_evidence/
  );
  assert.match(migration, /Purchase decision actor is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(migration, /alter\s+column\s+actor_user_id\s+set\s+not\s+null/i);
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}actor_user_id\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.record_purchase_decision_base_event/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.record_purchase_decision_compensation/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.reject_purchase_decision_event_mutation/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_purchase_decision_actor_userid_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_actor_user_id/);
  // Hosted writers already stamp auth.uid(); anonymization escape already exists.
  assert.match(
    memoryMigration,
    /p_recommendation\.restaurant_id, auth\.uid\(\), actor_role, decision_type/
  );
  assert.match(
    memoryMigration,
    /old\.actor_user_id is not null[\s\S]*new\.actor_user_id is null/
  );
});

test("pgTAP plan equals assertion call sites and covers null insert plus anonymization", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch![1]);
  const assertionSites = [
    ...pgTap.matchAll(/^select (is|isnt|ok|matches|has_function)\(/gm)
  ].length;
  assert.equal(
    planned,
    assertionSites,
    "plan must be derived from assertion call sites, never from a passing run"
  );
  assert.equal(planned, 8);
  assert.match(pgTap, /Purchase decision actor is required/);
  assert.match(pgTap, /actor_user_id[\s\S]*null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /dismiss_purchase_recommendation/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
