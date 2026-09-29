import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929170000_mise_005ce_sibling_canonical_unit_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalLedgerBound = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const originalDeliveryBound = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/sibling_canonical_unit_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

const notNullConstraint = (name: string) =>
  new RegExp(
    `add constraint ${name}\\s+check \\(\\s*canonical_unit in \\('g', 'ml', 'each'\\)\\s*and canonical_unit collate "C" ~ '\\^\\[A-Za-z0-9\\._-\\]\\{1,80\\}\\$'\\s*\\)`
  );

test("MISE-005CE pins sibling canonical_unit CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CE"), "additive pin must stay labeled");

  assert.match(migration, notNullConstraint("inventory_events_canonical_unit_check"));
  assert.match(migration, notNullConstraint("recipe_ingredients_canonical_unit_check"));
  assert.match(
    migration,
    notNullConstraint("modifier_recipe_adjustments_canonical_unit_check")
  );
  assert.match(
    migration,
    notNullConstraint("ingredient_substitutions_canonical_unit_check")
  );
  assert.match(
    migration,
    notNullConstraint("supplier_delivery_items_canonical_unit_check")
  );
  assert.match(
    migration,
    /add constraint supplier_items_canonical_unit_check\s+check \(\s*canonical_unit is null\s*or \(\s*canonical_unit in \('g', 'ml', 'each'\)\s*and canonical_unit collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`canonical_unit collate "C" ~ '${TOKEN_PATTERN}'`),
    "canonical_unit CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'g'") &&
      migration.includes("'ml'") &&
      migration.includes("'each'"),
    "exact canonical_unit allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or #490 / #478 targets.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /verify_inventory_item_canonical_unit/i);
  assert.doesNotMatch(sqlBody, /enforce_inventory_event_canonical_unit/i);
  assert.doesNotMatch(sqlBody, /client_event_id/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /recommendation_unit/i);
  assert.doesNotMatch(sqlBody, /evidence_version/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
});

test("original sibling canonical_unit used bare IN without COLLATE C shape", () => {
  assert.match(
    originalLedgerBound,
    /create table if not exists public\.inventory_events[\s\S]*?canonical_unit text not null check \(canonical_unit in \('g', 'ml', 'each'\)\)/
  );
  assert.match(
    originalLedgerBound,
    /create table if not exists public\.recipe_ingredients[\s\S]*?canonical_unit text not null check \(canonical_unit in \('g', 'ml', 'each'\)\)/
  );
  assert.match(
    originalLedgerBound,
    /create table if not exists public\.modifier_recipe_adjustments[\s\S]*?canonical_unit text not null check \(canonical_unit in \('g', 'ml', 'each'\)\)/
  );
  assert.match(
    originalLedgerBound,
    /create table if not exists public\.ingredient_substitutions[\s\S]*?canonical_unit text not null check \(canonical_unit in \('g', 'ml', 'each'\)\)/
  );
  assert.match(
    originalLedgerBound,
    /supplier_items_canonical_unit_check[\s\S]*?check \(canonical_unit is null or canonical_unit in \('g', 'ml', 'each'\)\)/
  );
  assert.match(
    originalDeliveryBound,
    /create table if not exists public\.supplier_delivery_items[\s\S]*?canonical_unit text not null check \(canonical_unit in \('g', 'ml', 'each'\)\)/
  );

  assert.doesNotMatch(
    originalLedgerBound,
    /canonical_unit collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalDeliveryBound,
    /canonical_unit collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins sibling canonical_unit to COLLATE C", () => {
  assert.match(pgTap, /select plan\(27\)/);
  assert.match(pgTap, /inventory_events_canonical_unit_check exists/);
  assert.match(pgTap, /inventory_events canonical_unit CHECK keeps exact allowlist/);
  assert.match(pgTap, /inventory_events canonical_unit CHECK uses COLLATE C/);
  assert.match(pgTap, /recipe_ingredients_canonical_unit_check exists/);
  assert.match(pgTap, /recipe_ingredients canonical_unit CHECK keeps exact allowlist/);
  assert.match(pgTap, /recipe_ingredients canonical_unit CHECK uses COLLATE C/);
  assert.match(pgTap, /modifier_recipe_adjustments_canonical_unit_check exists/);
  assert.match(
    pgTap,
    /modifier_recipe_adjustments canonical_unit CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /modifier_recipe_adjustments canonical_unit CHECK uses COLLATE C/
  );
  assert.match(pgTap, /ingredient_substitutions_canonical_unit_check exists/);
  assert.match(
    pgTap,
    /ingredient_substitutions canonical_unit CHECK keeps exact allowlist/
  );
  assert.match(pgTap, /ingredient_substitutions canonical_unit CHECK uses COLLATE C/);
  assert.match(pgTap, /supplier_items_canonical_unit_check exists/);
  assert.match(pgTap, /supplier_items canonical_unit CHECK keeps exact allowlist/);
  assert.match(pgTap, /supplier_items canonical_unit CHECK uses COLLATE C/);
  assert.match(pgTap, /supplier_items canonical_unit CHECK keeps null-or draft shape/);
  assert.match(pgTap, /supplier_delivery_items_canonical_unit_check exists/);
  assert.match(
    pgTap,
    /supplier_delivery_items canonical_unit CHECK keeps exact allowlist/
  );
  assert.match(pgTap, /supplier_delivery_items canonical_unit CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token g matches under COLLATE C/);
  assert.match(pgTap, /writer token ml matches under COLLATE C/);
  assert.match(pgTap, /writer token each matches under COLLATE C/);
  assert.match(pgTap, /spaced canonical_unit token is rejected under COLLATE C/);
  assert.match(pgTap, /empty canonical_unit token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated canonical_unit token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII canonical_unit token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted canonical_unit tokens match under COLLATE C/);
});
