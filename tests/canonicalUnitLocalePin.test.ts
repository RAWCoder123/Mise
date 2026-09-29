import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929160000_mise_005cd_canonical_unit_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalInventoryBound = readFileSync(
  new URL(
    "../supabase/migrations/20260726233159_inventory_item_canonical_unit_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const originalWriter = readFileSync(
  new URL(
    "../supabase/migrations/20260727210306_inventory_canonical_conversion_projection.sql",
    import.meta.url
  ),
  "utf8"
);
const originalDecisionBound = readFileSync(
  new URL(
    "../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/canonical_unit_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CD pins canonical_unit CHECK and verify writer to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CD"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_items_canonical_unit_check\s+check \(\s*canonical_unit is null\s*or \(\s*canonical_unit in \('g', 'ml', 'each'\)\s*and canonical_unit collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)\s*\)/
  );
  assert.match(
    migration,
    /add constraint purchase_decision_events_canonical_unit_check\s+check \(\s*canonical_unit in \('g', 'ml', 'each'\)\s*and canonical_unit collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
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

  assert.match(
    migration,
    /function public\.verify_inventory_item_canonical_unit\(\s*p_restaurant_id uuid,\s*p_inventory_item_id uuid,\s*p_canonical_unit text,\s*p_canonical_quantity_per_unit numeric\s*\)/
  );
  assert.ok(
    migration.includes(`p_canonical_unit collate "C" !~ '${TOKEN_PATTERN}'`),
    "verify writer gate must pin under COLLATE C"
  );
  assert.match(migration, /p_canonical_unit not in \('g', 'ml', 'each'\)/);
  assert.match(
    migration,
    /revoke all on function public\.verify_inventory_item_canonical_unit\(uuid, uuid, text, numeric\) from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.verify_inventory_item_canonical_unit\(uuid, uuid, text, numeric\) to authenticated/i
  );

  // Compose: do not rewrite purchase-decision writers, sibling unit tables,
  // or contested stacks.
  assert.doesNotMatch(sqlBody, /function private\.record_purchase_decision/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.recipe_ingredients/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_delivery_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.modifier_recipe_adjustments/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ingredient_substitutions/i);
  assert.doesNotMatch(sqlBody, /recommendation_unit/i);
  assert.doesNotMatch(sqlBody, /evidence_version/i);
  assert.doesNotMatch(sqlBody, /normalize_inventory_item_canonical_unit/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
});

test("original canonical_unit used bare IN without COLLATE C shape", () => {
  assert.match(
    originalInventoryBound,
    /inventory_items_canonical_unit_check[\s\S]*?check \(canonical_unit is null or canonical_unit in \('g', 'ml', 'each'\)\)/
  );
  assert.doesNotMatch(
    originalInventoryBound,
    /canonical_unit collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );

  assert.match(
    originalDecisionBound,
    /canonical_unit text not null check \(canonical_unit in \('g', 'ml', 'each'\)\)/
  );
  assert.doesNotMatch(
    originalDecisionBound,
    /canonical_unit collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );

  assert.match(originalWriter, /p_canonical_unit not in \('g', 'ml', 'each'\)/);
  assert.doesNotMatch(
    originalWriter,
    /p_canonical_unit collate "C" !~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins canonical_unit to COLLATE C", () => {
  assert.match(pgTap, /select plan\(18\)/);
  assert.match(pgTap, /inventory_items_canonical_unit_check exists/);
  assert.match(pgTap, /inventory_items canonical_unit CHECK keeps exact allowlist/);
  assert.match(pgTap, /inventory_items canonical_unit CHECK uses COLLATE C/);
  assert.match(pgTap, /inventory_items canonical_unit CHECK keeps null-or draft shape/);
  assert.match(pgTap, /purchase_decision_events_canonical_unit_check exists/);
  assert.match(pgTap, /purchase_decision canonical_unit CHECK keeps exact allowlist/);
  assert.match(pgTap, /purchase_decision canonical_unit CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /verify_inventory_item_canonical_unit writer uses COLLATE C shape gate/
  );
  assert.match(
    pgTap,
    /verify_inventory_item_canonical_unit writer keeps exact allowlist/
  );
  assert.match(pgTap, /writer token g matches under COLLATE C/);
  assert.match(pgTap, /writer token ml matches under COLLATE C/);
  assert.match(pgTap, /writer token each matches under COLLATE C/);
  assert.match(pgTap, /spaced canonical_unit token is rejected under COLLATE C/);
  assert.match(pgTap, /empty canonical_unit token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated canonical_unit token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII canonical_unit token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted canonical_unit tokens match under COLLATE C/);
  assert.match(
    pgTap,
    /authenticated EXECUTE on verify_inventory_item_canonical_unit is preserved/
  );
});
