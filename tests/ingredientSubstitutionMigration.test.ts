import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260901230000_ingredient_substitution_manager_authority.sql",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/ingredient_substitution_manager.test.sql",
  "utf8"
);

test("ingredient substitution RPCs are manager-only authenticated mutators", () => {
  for (const name of [
    "upsert_ingredient_substitution",
    "verify_ingredient_substitution",
    "reject_ingredient_substitution",
    "expire_ingredient_substitution"
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
  assert.match(migration, /Substitution requires verified matching canonical units/);
  assert.match(migration, /Only draft substitutions can be edited/);
  assert.match(migration, /ingredient_substitution\.verified/);
});

test("database coverage exercises staff denial, tenant isolation, and verify/expire", () => {
  for (const phrase of [
    "staff cannot upsert an ingredient substitution",
    "a manager cannot upsert another tenant substitution",
    "a manager can create a draft ingredient substitution",
    "a manager can verify a draft ingredient substitution",
    "verified substitutions cannot be edited",
    "a manager can expire a verified ingredient substitution",
    "authenticated clients still cannot insert ingredient_substitutions directly"
  ]) {
    assert.match(pgTap, new RegExp(phrase, "i"));
  }
});
