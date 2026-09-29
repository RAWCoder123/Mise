import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929190000_mise_005cg_verification_status_locale_pin.sql",
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
const originalCanonicalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260726233159_inventory_item_canonical_unit_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/verification_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

const verificationStatusConstraint = (name: string) =>
  new RegExp(
    `add constraint ${name}\\s+check \\(\\s*verification_status in \\('draft', 'verified', 'rejected', 'expired'\\)\\s*and verification_status collate "C" ~ '\\^\\[A-Za-z0-9\\._-\\]\\{1,80\\}\\$'\\s*\\)`
  );

test("MISE-005CG pins verification_status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CG"), "additive pin must stay labeled");

  assert.match(
    migration,
    verificationStatusConstraint("pos_catalog_item_mappings_verification_status_check")
  );
  assert.match(
    migration,
    verificationStatusConstraint("recipe_ingredients_verification_status_check")
  );
  assert.match(
    migration,
    verificationStatusConstraint("modifier_recipe_adjustments_verification_status_check")
  );
  assert.match(
    migration,
    verificationStatusConstraint("ingredient_substitutions_verification_status_check")
  );
  assert.match(
    migration,
    verificationStatusConstraint("supplier_items_verification_status_check")
  );
  assert.match(
    migration,
    /add constraint inventory_items_canonical_unit_verification_status_check\s+check \(\s*canonical_unit_verification_status in \('draft', 'verified', 'rejected', 'expired'\)\s*and canonical_unit_verification_status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`verification_status collate "C" ~ '${TOKEN_PATTERN}'`),
    "verification_status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(
      `canonical_unit_verification_status collate "C" ~ '${TOKEN_PATTERN}'`
    ),
    "canonical_unit_verification_status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'draft'") &&
      migration.includes("'verified'") &&
      migration.includes("'rejected'") &&
      migration.includes("'expired'"),
    "exact verification_status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /external_catalog_item_id/i);
  assert.doesNotMatch(sqlBody, /external_variation_id/i);
  assert.doesNotMatch(sqlBody, /external_modifier_id/i);
  assert.doesNotMatch(sqlBody, /inventory_events_event_type_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.recipe_versions/i);
  assert.doesNotMatch(sqlBody, /canonical_unit in \('g'/i);
  assert.doesNotMatch(sqlBody, /verify_inventory_item_canonical_unit/i);
  assert.doesNotMatch(sqlBody, /review_pos_catalog_item_mapping/i);
});

test("original verification_status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalLedgerBound,
    /create table if not exists public\.pos_catalog_item_mappings[\s\S]*?verification_status text not null default 'draft'\s+check \(verification_status in \('draft', 'verified', 'rejected', 'expired'\)\)/
  );
  assert.match(
    originalLedgerBound,
    /create table if not exists public\.recipe_ingredients[\s\S]*?verification_status text not null default 'draft'\s+check \(verification_status in \('draft', 'verified', 'rejected', 'expired'\)\)/
  );
  assert.match(
    originalLedgerBound,
    /create table if not exists public\.modifier_recipe_adjustments[\s\S]*?verification_status text not null default 'draft'\s+check \(verification_status in \('draft', 'verified', 'rejected', 'expired'\)\)/
  );
  assert.match(
    originalLedgerBound,
    /create table if not exists public\.ingredient_substitutions[\s\S]*?verification_status text not null default 'draft'\s+check \(verification_status in \('draft', 'verified', 'rejected', 'expired'\)\)/
  );
  assert.match(
    originalLedgerBound,
    /supplier_items_verification_status_check[\s\S]*?check \(verification_status in \('draft', 'verified', 'rejected', 'expired'\)\)/
  );
  assert.match(
    originalCanonicalBound,
    /inventory_items_canonical_unit_verification_status_check[\s\S]*?check \(canonical_unit_verification_status in \('draft', 'verified', 'rejected', 'expired'\)\)/
  );

  assert.doesNotMatch(
    originalLedgerBound,
    /verification_status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalCanonicalBound,
    /canonical_unit_verification_status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins verification_status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(27\)/);
  assert.match(pgTap, /pos_catalog_item_mappings_verification_status_check exists/);
  assert.match(
    pgTap,
    /pos_catalog_item_mappings verification_status CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /pos_catalog_item_mappings verification_status CHECK uses COLLATE C/
  );
  assert.match(pgTap, /recipe_ingredients_verification_status_check exists/);
  assert.match(
    pgTap,
    /recipe_ingredients verification_status CHECK keeps exact allowlist/
  );
  assert.match(pgTap, /recipe_ingredients verification_status CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /modifier_recipe_adjustments_verification_status_check exists/
  );
  assert.match(
    pgTap,
    /modifier_recipe_adjustments verification_status CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /modifier_recipe_adjustments verification_status CHECK uses COLLATE C/
  );
  assert.match(pgTap, /ingredient_substitutions_verification_status_check exists/);
  assert.match(
    pgTap,
    /ingredient_substitutions verification_status CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /ingredient_substitutions verification_status CHECK uses COLLATE C/
  );
  assert.match(pgTap, /supplier_items_verification_status_check exists/);
  assert.match(pgTap, /supplier_items verification_status CHECK keeps exact allowlist/);
  assert.match(pgTap, /supplier_items verification_status CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /inventory_items_canonical_unit_verification_status_check exists/
  );
  assert.match(
    pgTap,
    /inventory_items canonical_unit_verification_status CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /inventory_items canonical_unit_verification_status CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token draft matches under COLLATE C/);
  assert.match(pgTap, /writer token verified matches under COLLATE C/);
  assert.match(pgTap, /writer token rejected matches under COLLATE C/);
  assert.match(pgTap, /writer token expired matches under COLLATE C/);
  assert.match(pgTap, /spaced verification_status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty verification_status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated verification_status token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII verification_status token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted verification_status tokens match under COLLATE C/
  );
});
