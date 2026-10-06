import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007100000_mise_005iw_purchase_units_compatible_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalAuthority = readFileSync(
  new URL(
    "../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_units_compatible_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005IW pins purchase_units_compatible IMMUTABLE lower() to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005IW"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.purchase_units_compatible\(\s*p_recipe_unit text,\s*p_item_unit text,\s*p_item_canonical_unit text\s*\)/i
  );
  assert.match(
    migration,
    /pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_recipe_unit, ''\)\) collate "C"\s*\)/
  );
  assert.match(
    migration,
    /pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_item_unit, ''\)\) collate "C"\s*\)/
  );
  assert.equal(
    (
      migration.match(
        /pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_(?:recipe|item)_unit, ''\)\) collate "C"\s*\)/g
      ) ?? []
    ).length,
    3,
    "nullif + equality must pin recipe/item lower(btrim) to COLLATE C"
  );
  assert.match(
    migration,
    /revoke all on function private\.purchase_units_compatible\(text, text, text\)\s+from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /private\.canonical_unit_for_standard_unit\(p_recipe_unit\)/
  );

  const body = migration.slice(
    migration.indexOf(
      "create or replace function private.purchase_units_compatible"
    )
  );
  assert.doesNotMatch(body, /lower\(trim\(/);
  assert.doesNotMatch(
    migration,
    /create or replace function private\.canonical_unit_for_standard_unit/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.normalize_supplier_name/i
  );
});

test("MISE-003A originally left purchase_units_compatible on bare lower(trim)", () => {
  const body = originalAuthority.slice(
    originalAuthority.indexOf(
      "create or replace function private.purchase_units_compatible"
    ),
    originalAuthority.indexOf(
      "create or replace function private.invalidate_menu_item_recipe_authority"
    )
  );
  assert.match(body, /lower\(trim\(coalesce\(p_recipe_unit, ''\)\)\)/);
  assert.match(body, /lower\(trim\(p_recipe_unit\)\) = lower\(trim\(coalesce\(p_item_unit, ''\)\)\)/);
  assert.doesNotMatch(body, /collate "C"/);
});

test("pgTAP fixture pins purchase_units_compatible to COLLATE C", () => {
  // Plan count must equal assertion call sites in the fixture source.
  const assertionCalls = (
    pgTap.match(/^select (?:ok|is|isnt|matches|throws_ok)\(/gm) ?? []
  ).length;
  assert.equal(assertionCalls, 10);
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(
    pgTap,
    /purchase_units_compatible folds recipe unit under COLLATE C/
  );
  assert.match(
    pgTap,
    /purchase_units_compatible folds item unit under COLLATE C/
  );
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on purchase_units_compatible/
  );
});
