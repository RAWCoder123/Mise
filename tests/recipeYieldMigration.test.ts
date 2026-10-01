import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260902010000_recipe_version_yield_manager_authority.sql",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/recipe_version_yield_manager.test.sql",
  "utf8"
);

test("recipe yield RPCs are manager-only authenticated mutators", () => {
  for (const name of [
    "upsert_recipe_version_yields",
    "verify_recipe_version_yields",
    "retire_recipe_version_yields"
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}`, "i"));
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${name}[\\s\\S]*to authenticated`, "i")
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`grant execute on function public\\.${name}[\\s\\S]*to service_role`, "i")
    );
  }
  assert.match(migration, /private\.has_restaurant_role\(/);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/);
  assert.match(migration, /Only draft recipe yields can be edited/);
  assert.match(migration, /Only draft recipe yields can be verified/);
  assert.match(migration, /recipe_version_yield\.verified/);
  assert.match(migration, /set search_path = ''/);
});

test("database coverage exercises staff denial, tenant isolation, and verify succession", () => {
  for (const phrase of [
    "staff cannot upsert recipe yields",
    "a manager cannot upsert another tenant recipe yield",
    "a manager can create a draft recipe yield",
    "a manager can verify a draft recipe yield",
    "verified recipe yields cannot be edited in place",
    "a manager can retire a verified recipe yield",
    "authenticated clients still cannot insert recipe_versions directly"
  ]) {
    assert.match(pgTap, new RegExp(phrase, "i"));
  }
});
