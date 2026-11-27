import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateIngredientSubstitutionVerifiedAtEvidence } from "../services/domain/ingredientSubstitutionVerifiedAtEvidence";

const migrationPath =
  "supabase/migrations/20261127160000_ingredient_substitution_verified_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/ingredient_substitution_verified_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/ingredientSubstitutionVerifiedAtEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
  "utf8"
);

test("validateIngredientSubstitutionVerifiedAtEvidence rejects verified rows without verified_at", () => {
  assert.equal(
    validateIngredientSubstitutionVerifiedAtEvidence({
      verificationStatus: "verified",
      verifiedAt: null,
    }),
    "missing_verified_at"
  );
  assert.equal(
    validateIngredientSubstitutionVerifiedAtEvidence({
      verificationStatus: "verified",
      verifiedAt: "   ",
    }),
    "missing_verified_at"
  );
  assert.equal(
    validateIngredientSubstitutionVerifiedAtEvidence({
      verificationStatus: "verified",
      verifiedAt: "",
    }),
    "missing_verified_at"
  );
  assert.equal(
    validateIngredientSubstitutionVerifiedAtEvidence({
      verificationStatus: "verified",
    }),
    "missing_verified_at"
  );
});

test("validateIngredientSubstitutionVerifiedAtEvidence accepts draft, rejected, expired, and time-stamped verified rows", () => {
  assert.equal(
    validateIngredientSubstitutionVerifiedAtEvidence({
      verificationStatus: "draft",
      verifiedAt: null,
    }),
    null
  );
  assert.equal(
    validateIngredientSubstitutionVerifiedAtEvidence({
      verificationStatus: "rejected",
      verifiedAt: null,
    }),
    null
  );
  assert.equal(
    validateIngredientSubstitutionVerifiedAtEvidence({
      verificationStatus: "expired",
      verifiedAt: null,
    }),
    null
  );
  assert.equal(validateIngredientSubstitutionVerifiedAtEvidence({}), null);
  assert.equal(
    validateIngredientSubstitutionVerifiedAtEvidence({
      verificationStatus: "verified",
      verifiedAt: "2024-01-02T00:00:00Z",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT verification-time guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_ingredient_substitution_verified_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.ingredient_substitutions[\s\S]*enforce_ingredient_substitution_verified_at_evidence/
  );
  assert.match(
    migration,
    /Ingredient substitution verification time is required/
  );
  assert.match(migration, /new\.verification_status = 'verified'/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and orthogonal to the companion verified_by actor tip.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+verified_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}verified_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.verify_ingredient_substitution/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_ingredient_substitution_verified_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_verified_at/);
  // Column is nullable; status vocabulary includes verified.
  assert.match(
    foundationMigration,
    /create table if not exists public\.ingredient_substitutions \([\s\S]*verified_at timestamptz,/
  );
  assert.match(
    foundationMigration,
    /verification_status text not null default 'draft'\s+check \(verification_status in \('draft', 'verified', 'rejected', 'expired'\)\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null verified_at plus anonymization", () => {
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
  assert.match(
    pgTap,
    /Ingredient substitution verification time is required/
  );
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(pgTap, /preserving verified_at/);
});
