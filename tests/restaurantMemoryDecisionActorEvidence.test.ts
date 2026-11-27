import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateRestaurantMemoryDecisionActorEvidence } from "../services/domain/restaurantMemoryDecisionActorEvidence";

const migrationPath =
  "supabase/migrations/20261127030000_restaurant_memory_decision_actor_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/restaurant_memory_decision_actor_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/restaurantMemoryDecisionActorEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateRestaurantMemoryDecisionActorEvidence rejects decision status without corrected_by", () => {
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "corrected",
      correctedBy: null,
    }),
    "missing_corrected_by"
  );
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "corrected",
      correctedBy: "   ",
    }),
    "missing_corrected_by"
  );
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "dismissed",
      correctedBy: undefined,
    }),
    "missing_corrected_by"
  );
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "confirmed",
      correctedBy: "",
    }),
    "missing_corrected_by"
  );
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "forgotten",
      correctedBy: null,
    }),
    "missing_corrected_by"
  );
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "disabled",
      correctedBy: null,
    }),
    "missing_corrected_by"
  );
});

test("validateRestaurantMemoryDecisionActorEvidence accepts active and attributed decision statuses", () => {
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "active",
    }),
    null
  );
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "corrected",
      correctedBy: "user-manager-1",
    }),
    null
  );
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "dismissed",
      correctedBy: "user-manager-1",
    }),
    null
  );
  assert.equal(
    validateRestaurantMemoryDecisionActorEvidence({
      status: "confirmed",
      correctedBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT decision-actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_restaurant_memory_decision_actor_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.restaurant_memories[\s\S]*enforce_restaurant_memory_decision_actor_evidence/
  );
  assert.match(migration, /Restaurant memory decision actor is required/);
  // No table-level NOT NULL / status-implies-actor CHECK — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+corrected_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}corrected_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.update_restaurant_memory/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_restaurant_memory_decision_actor_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_corrected_by/);
  // Hosted writer stamps auth.uid() via UPDATE; anonymization escape already exists.
  assert.match(
    foundationMigration,
    /corrected_by = auth\.uid\(\)/
  );
  assert.match(
    foundationMigration,
    /corrected_by uuid references auth\.users\(id\) on delete set null/
  );
});

test("pgTAP plan equals assertion call sites and covers null decision actors plus anonymization", () => {
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
  assert.match(pgTap, /Restaurant memory decision actor is required/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /update_restaurant_memory/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
