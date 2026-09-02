import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260902030000_modifier_recipe_adjustment_manager_authority.sql",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/modifier_recipe_adjustment_manager.test.sql",
  "utf8"
);

test("modifier recipe adjustment RPCs are manager-only authenticated mutators", () => {
  for (const name of [
    "upsert_modifier_recipe_adjustment",
    "verify_modifier_recipe_adjustment",
    "reject_modifier_recipe_adjustment",
    "expire_modifier_recipe_adjustment"
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
  assert.match(migration, /Modifier adjustments require a verified matching canonical unit/);
  assert.match(migration, /Only draft modifier adjustments can be edited/);
  assert.match(migration, /modifier_recipe_adjustment\.verified/);
  assert.match(migration, /ensure_restaurant_wide_recipe_version_for_modifiers/);
});

test("database coverage exercises staff denial, tenant isolation, and verify/expire", () => {
  for (const phrase of [
    "staff cannot upsert a modifier recipe adjustment",
    "a manager cannot upsert another tenant modifier adjustment",
    "a manager can create a draft modifier recipe adjustment",
    "a manager can verify a draft modifier recipe adjustment",
    "verified modifier adjustments cannot be edited",
    "a manager can expire a verified modifier recipe adjustment",
    "authenticated clients still cannot insert modifier_recipe_adjustments directly"
  ]) {
    assert.match(pgTap, new RegExp(phrase, "i"));
  }
});
