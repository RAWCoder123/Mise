import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeOperationalQuantity } from "../services/domain/operationalMapping";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007080000_mise_005iv_canonical_unit_conversion_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalUnitAuthority = readFileSync(
  new URL(
    "../supabase/migrations/20260726233159_inventory_item_canonical_unit_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const originalQuantityProjection = readFileSync(
  new URL(
    "../supabase/migrations/20260727210306_inventory_canonical_conversion_projection.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/canonical_unit_conversion_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const operationalMapping = readFileSync(
  new URL("../services/domain/operationalMapping.ts", import.meta.url),
  "utf8"
);

test("MISE-005IV pins canonical-unit conversion IMMUTABLE helpers to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005IV"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.canonical_unit_for_standard_unit\(p_unit text\)/i
  );
  assert.match(
    migration,
    /create or replace function private\.canonical_quantity_per_standard_unit\(p_unit text\)/i
  );
  assert.match(
    migration,
    /select case pg_catalog\.lower\(pg_catalog\.btrim\(coalesce\(p_unit, ''\)\) collate "C"\)/
  );
  assert.equal(
    (
      migration.match(
        /pg_catalog\.lower\(pg_catalog\.btrim\(coalesce\(p_unit, ''\)\) collate "C"\)/g
      ) ?? []
    ).length,
    2,
    "both conversion helpers must pin lower(btrim) to COLLATE C"
  );
  assert.match(
    migration,
    /revoke all on function private\.canonical_unit_for_standard_unit\(text\)\s+from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /revoke all on function private\.canonical_quantity_per_standard_unit\(text\)\s+from public, anon, authenticated, service_role/i
  );

  const unitBody = migration.slice(
    migration.indexOf(
      "create or replace function private.canonical_unit_for_standard_unit"
    ),
    migration.indexOf(
      "create or replace function private.canonical_quantity_per_standard_unit"
    )
  );
  const quantityBody = migration.slice(
    migration.indexOf(
      "create or replace function private.canonical_quantity_per_standard_unit"
    )
  );
  assert.doesNotMatch(unitBody, /lower\(trim\(coalesce\(p_unit, ''\)\)\)/);
  assert.doesNotMatch(quantityBody, /lower\(trim\(coalesce\(p_unit, ''\)\)\)/);

  // Compose: do not reattach canonical_unit CHECKs or rewrite normalize triggers.
  assert.doesNotMatch(migration, /inventory_items_canonical_unit_check/);
  assert.doesNotMatch(
    migration,
    /create or replace function private\.normalize_inventory_item_canonical_unit/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.normalize_supplier_name/i
  );
});

test("foundation originally left conversion helpers on bare lower(trim)", () => {
  assert.match(
    originalUnitAuthority,
    /select case lower\(trim\(coalesce\(p_unit, ''\)\)\)/
  );
  assert.doesNotMatch(
    originalUnitAuthority,
    /lower\(.*btrim\(coalesce\(p_unit, ''\)\) collate "C"\)/
  );
  assert.match(
    originalQuantityProjection,
    /select case lower\(trim\(coalesce\(p_unit, ''\)\)\)/
  );
  assert.doesNotMatch(
    originalQuantityProjection,
    /lower\(.*btrim\(coalesce\(p_unit, ''\)\) collate "C"\)/
  );
});

test("pgTAP fixture pins conversion helpers to COLLATE C", () => {
  // Plan count must equal assertion call sites in the fixture source.
  const assertionCalls = (
    pgTap.match(/^select (?:ok|is|isnt|matches|throws_ok)\(/gm) ?? []
  ).length;
  assert.equal(assertionCalls, 12);
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /canonical_unit_for_standard_unit folds case under COLLATE C/);
  assert.match(
    pgTap,
    /canonical_quantity_per_standard_unit folds case under COLLATE C/
  );
  assert.match(pgTap, /authenticated lacks EXECUTE on canonical_unit_for_standard_unit/);
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on canonical_quantity_per_standard_unit/
  );
});

test("client operational unit normalize uses ASCII C-locale case folding", () => {
  assert.match(
    operationalMapping,
    /function asciiCLower\(value: string\)/
  );
  assert.doesNotMatch(
    operationalMapping,
    /toLocaleLowerCase\(/
  );
  assert.equal(
    normalizeOperationalQuantity({ quantity: 2, unit: "KILOGRAMS" }).unit,
    "g"
  );
  assert.equal(
    normalizeOperationalQuantity({ quantity: 2, unit: "KILOGRAMS" }).quantity,
    2000
  );
  assert.equal(
    normalizeOperationalQuantity({ quantity: 1, unit: "  Lb  " }).unit,
    "g"
  );
  assert.equal(
    normalizeOperationalQuantity({ quantity: 1, unit: "FL OZ" }).unit,
    "ml"
  );
});
