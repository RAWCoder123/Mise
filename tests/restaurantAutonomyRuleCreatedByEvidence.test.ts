import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateRestaurantAutonomyRuleCreatedByEvidence } from "../services/domain/restaurantAutonomyRuleCreatedByEvidence";

const migrationPath =
  "supabase/migrations/20261127070000_restaurant_autonomy_rule_created_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/restaurant_autonomy_rule_created_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/restaurantAutonomyRuleCreatedByEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateRestaurantAutonomyRuleCreatedByEvidence rejects null, undefined, and blank creators", () => {
  assert.equal(
    validateRestaurantAutonomyRuleCreatedByEvidence({ createdBy: null }),
    "missing_created_by"
  );
  assert.equal(
    validateRestaurantAutonomyRuleCreatedByEvidence({ createdBy: undefined }),
    "missing_created_by"
  );
  assert.equal(
    validateRestaurantAutonomyRuleCreatedByEvidence({ createdBy: "" }),
    "missing_created_by"
  );
  assert.equal(
    validateRestaurantAutonomyRuleCreatedByEvidence({ createdBy: "   " }),
    "missing_created_by"
  );
});

test("validateRestaurantAutonomyRuleCreatedByEvidence accepts a non-empty creator id", () => {
  assert.equal(
    validateRestaurantAutonomyRuleCreatedByEvidence({
      createdBy: "user-owner-1"
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT creator guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_restaurant_autonomy_rule_created_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.restaurant_autonomy_rules[\s\S]*enforce_restaurant_autonomy_rule_created_by_evidence/
  );
  assert.match(migration, /Restaurant autonomy rule creator is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+created_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}created_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.upsert_restaurant_autonomy_rule/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_restaurant_autonomy_rule_created_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_created_by/);
  // Soft nullable creator + ON DELETE SET NULL already exist; hosted upsert stamps auth.uid().
  assert.match(
    foundationMigration,
    /created_by uuid references auth\.users\(id\) on delete set null/
  );
  assert.match(
    foundationMigration,
    /allowed_end_time, created_by, updated_by[\s\S]*auth\.uid\(\), auth\.uid\(\)/
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
  assert.match(pgTap, /Restaurant autonomy rule creator is required/);
  assert.match(pgTap, /created_by[\s\S]*null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /upsert_restaurant_autonomy_rule/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
