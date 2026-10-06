import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007120000_mise_005ix_purchase_line_unit_helpers_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_line_unit_helpers_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005IX pins purchase-line unit IMMUTABLE helpers to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005IX"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.purchase_line_unit_dimension\(p_unit text\)/i
  );
  assert.match(
    migration,
    /create or replace function private\.purchase_line_pack_unit\(p_pack_size text\)/i
  );
  assert.match(
    migration,
    /pg_catalog\.lower\(coalesce\(p_unit, ''\) collate "C"\)/
  );
  assert.match(
    migration,
    /pg_catalog\.lower\(coalesce\(p_pack_size, ''\) collate "C"\)/
  );
  assert.match(
    migration,
    /revoke all on function private\.purchase_line_unit_dimension\(text\)\s+from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /revoke all on function private\.purchase_line_pack_unit\(text\)\s+from public, anon, authenticated, service_role/i
  );

  const dimensionBody = migration.slice(
    migration.indexOf(
      "create or replace function private.purchase_line_unit_dimension"
    ),
    migration.indexOf(
      "create or replace function private.purchase_line_pack_unit(p_pack_size"
    )
  );
  const packBody = migration.slice(
    migration.indexOf(
      "create or replace function private.purchase_line_pack_unit(p_pack_size"
    )
  );
  assert.doesNotMatch(dimensionBody, /pg_catalog\.lower\(p_unit\)/);
  assert.doesNotMatch(packBody, /pg_catalog\.lower\(p_pack_size\)/);

  // Compose: do not rewrite already-pinned fold/normalize helpers or other tips.
  assert.doesNotMatch(
    migration,
    /create or replace function private\.fold_purchase_line_description/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.normalize_purchase_item_key/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.purchase_units_compatible/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.canonical_unit_for_standard_unit/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.normalize_supplier_name/i
  );
});

test("MISE-004C originally left purchase-line unit helpers on bare lower()", () => {
  const dimensionBody = originalLedger.slice(
    originalLedger.indexOf(
      "create or replace function private.purchase_line_unit_dimension"
    ),
    originalLedger.indexOf(
      "create or replace function private.purchase_line_pack_unit(p_pack_size"
    )
  );
  const packBody = originalLedger.slice(
    originalLedger.indexOf(
      "create or replace function private.purchase_line_pack_unit(p_pack_size"
    ),
    originalLedger.indexOf(
      "create or replace function private.purchase_line_consistency_flags"
    )
  );
  assert.match(dimensionBody, /pg_catalog\.btrim\(pg_catalog\.lower\(p_unit\)\)/);
  assert.doesNotMatch(dimensionBody, /collate "C"/);
  assert.match(packBody, /pg_catalog\.regexp_match\(pg_catalog\.lower\(p_pack_size\),/);
  assert.doesNotMatch(packBody, /collate "C"/);
});

test("pgTAP fixture pins purchase-line unit helpers to COLLATE C", () => {
  // Plan count must equal assertion call sites in the fixture source.
  const assertionCalls = (
    pgTap.match(/^select (?:ok|is|isnt|matches|throws_ok)\(/gm) ?? []
  ).length;
  assert.equal(assertionCalls, 12);
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(
    pgTap,
    /purchase_line_unit_dimension folds unit under COLLATE C/
  );
  assert.match(
    pgTap,
    /purchase_line_pack_unit folds pack size under COLLATE C/
  );
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on purchase_line_unit_dimension/
  );
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on purchase_line_pack_unit/
  );
});
