import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateRecipeVersionVerifiedByEvidence } from "../services/domain/recipeVersionVerifiedByEvidence";

const migrationPath =
  "supabase/migrations/20261127140000_recipe_version_verified_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/recipe_version_verified_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/recipeVersionVerifiedByEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
  "utf8"
);

test("validateRecipeVersionVerifiedByEvidence rejects verified rows without verified_by", () => {
  assert.equal(
    validateRecipeVersionVerifiedByEvidence({
      status: "verified",
      verifiedBy: null,
    }),
    "missing_verified_by"
  );
  assert.equal(
    validateRecipeVersionVerifiedByEvidence({
      status: "verified",
      verifiedBy: "   ",
    }),
    "missing_verified_by"
  );
  assert.equal(
    validateRecipeVersionVerifiedByEvidence({
      status: "verified",
      verifiedBy: "",
    }),
    "missing_verified_by"
  );
  assert.equal(
    validateRecipeVersionVerifiedByEvidence({
      status: "verified",
    }),
    "missing_verified_by"
  );
});

test("validateRecipeVersionVerifiedByEvidence accepts draft, retired, and attributed verified rows", () => {
  assert.equal(
    validateRecipeVersionVerifiedByEvidence({
      status: "draft",
      verifiedBy: null,
    }),
    null
  );
  assert.equal(
    validateRecipeVersionVerifiedByEvidence({
      status: "retired",
      verifiedBy: null,
    }),
    null
  );
  assert.equal(
    validateRecipeVersionVerifiedByEvidence({}),
    null
  );
  assert.equal(
    validateRecipeVersionVerifiedByEvidence({
      status: "verified",
      verifiedBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT verifier guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_recipe_version_verified_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.recipe_versions[\s\S]*enforce_recipe_version_verified_by_evidence/
  );
  assert.match(migration, /Recipe version verifier is required/);
  assert.match(migration, /new\.status = 'verified'/);
  // No table-level NOT NULL / status-implies-actor CHECK — that would
  // block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+verified_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}verified_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.verify_recipe_version/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_recipe_version_verified_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_verified_by/);
  // Column is nullable with ON DELETE SET NULL; status vocabulary includes verified.
  assert.match(
    foundationMigration,
    /create table if not exists public\.recipe_versions \([\s\S]*verified_by uuid references auth\.users\(id\) on delete set null/
  );
  assert.match(
    foundationMigration,
    /status text not null default 'draft' check \(status in \('draft', 'verified', 'retired'\)\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null verifier plus anonymization", () => {
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
  assert.match(pgTap, /Recipe version verifier is required/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
