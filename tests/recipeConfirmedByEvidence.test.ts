import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateRecipeConfirmedByEvidence } from "../services/domain/recipeConfirmedByEvidence";

const migrationPath =
  "supabase/migrations/20261127110000_recipe_confirmed_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/recipe_confirmed_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/recipeConfirmedByEvidence.ts",
  "utf8"
);
const authorityMigration = readFileSync(
  "supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql",
  "utf8"
);

test("validateRecipeConfirmedByEvidence rejects confirmed rows without recipe_confirmed_by", () => {
  assert.equal(
    validateRecipeConfirmedByEvidence({
      recipeConfirmedRevision: 0,
      recipeConfirmedAt: "2026-11-27T10:00:00Z",
      recipeConfirmedBy: null,
    }),
    "missing_recipe_confirmed_by"
  );
  assert.equal(
    validateRecipeConfirmedByEvidence({
      recipeConfirmedRevision: 1,
      recipeConfirmedAt: "2026-11-27T10:00:00Z",
      recipeConfirmedBy: "   ",
    }),
    "missing_recipe_confirmed_by"
  );
  assert.equal(
    validateRecipeConfirmedByEvidence({
      recipeConfirmedRevision: 2,
      recipeConfirmedAt: "2026-11-27T10:00:00Z",
      recipeConfirmedBy: "",
    }),
    "missing_recipe_confirmed_by"
  );
  assert.equal(
    validateRecipeConfirmedByEvidence({
      recipeConfirmedRevision: 0,
      recipeConfirmedAt: "2026-11-27T10:00:00Z",
    }),
    "missing_recipe_confirmed_by"
  );
});

test("validateRecipeConfirmedByEvidence accepts unconfirmed and attributed confirmed rows", () => {
  assert.equal(
    validateRecipeConfirmedByEvidence({
      recipeConfirmedRevision: null,
      recipeConfirmedAt: null,
      recipeConfirmedBy: null,
    }),
    null
  );
  assert.equal(
    validateRecipeConfirmedByEvidence({}),
    null
  );
  assert.equal(
    validateRecipeConfirmedByEvidence({
      recipeConfirmedRevision: 0,
      recipeConfirmedAt: "2026-11-27T10:00:00Z",
      recipeConfirmedBy: "user-manager-1",
    }),
    null
  );
  assert.equal(
    validateRecipeConfirmedByEvidence({
      recipeConfirmedRevision: 3,
      recipeConfirmedAt: "2026-11-27T10:00:00Z",
      recipeConfirmedBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT confirmation-actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_recipe_confirmed_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.menu_items[\s\S]*enforce_recipe_confirmed_by_evidence/
  );
  assert.match(migration, /Recipe confirmation actor is required/);
  assert.match(migration, /new\.recipe_confirmed_revision is not null/);
  // No table-level NOT NULL / confirmation-implies-actor CHECK — that would
  // block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+recipe_confirmed_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}recipe_confirmed_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.confirm_recipe_complete/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_recipe_confirmed_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_recipe_confirmed_by/);
  // Soft CHECK already pairs revision+timestamp but still allows null actor;
  // hosted writer stamps auth.uid() via UPDATE.
  assert.match(
    authorityMigration,
    /recipe_confirmed_by uuid references auth\.users\(id\) on delete set null/
  );
  assert.match(
    authorityMigration,
    /recipe_confirmed_by = auth\.uid\(\)/
  );
  assert.match(
    authorityMigration,
    /\(recipe_confirmed_revision is not null and recipe_confirmed_at is not null\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null confirmer plus anonymization", () => {
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
  assert.match(pgTap, /Recipe confirmation actor is required/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
