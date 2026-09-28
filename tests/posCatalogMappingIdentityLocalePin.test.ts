import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928060000_mise_005bg_pos_catalog_mapping_identity_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_catalog_mapping_identity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

const isAllowedExternalCatalogItemId = (value: string) =>
  value.length >= 1 &&
  value.length <= 128 &&
  !CONTROL_CHARACTERS.test(value);

const isAllowedExternalVariationId = (value: string) =>
  value === "" ||
  (value.length >= 1 &&
    value.length <= 128 &&
    !CONTROL_CHARACTERS.test(value));

test("MISE-005BG pins pos_catalog_item_mappings identity CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BG"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_catalog_item_mappings_external_catalog_item_id_check\s+check \(\s*length\(external_catalog_item_id\) between 1 and 128\s+and external_catalog_item_id collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );

  assert.match(
    migration,
    /add constraint pos_catalog_item_mappings_external_variation_id_check\s+check \(\s*external_variation_id = ''\s+or \(\s*length\(external_variation_id\) between 1 and 128\s+and external_variation_id collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`external_catalog_item_id collate "C" !~ '[[:cntrl:]]'`),
    "external_catalog_item_id CHECK must pin cntrl under COLLATE C"
  );
  assert.ok(
    migration.includes(`external_variation_id collate "C" !~ '[[:cntrl:]]'`),
    "external_variation_id CHECK must pin cntrl under COLLATE C"
  );
  assert.ok(
    migration.includes("external_variation_id = ''"),
    "empty-string variation sentinel must remain allowed"
  );

  // Compose: do not rewrite contested POS sync / mapping-review writers,
  // sale identity (#417), location ids (#465/#466), or free-form ledgers.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_locations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.modifier_recipe_adjustments/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("original pos_catalog_item_mappings identity columns had no cntrl CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.pos_catalog_item_mappings \([\s\S]*?external_catalog_item_id text not null,\s*external_variation_id text not null default '',/
  );
  assert.doesNotMatch(
    originalFoundation,
    /external_catalog_item_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /external_variation_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /pos_catalog_item_mappings_external_catalog_item_id_check/
  );
  assert.doesNotMatch(
    originalFoundation,
    /pos_catalog_item_mappings_external_variation_id_check/
  );
});

test("length + cntrl class matches the pinned CHECK contract", () => {
  assert.equal(isAllowedExternalCatalogItemId("ITEM-A"), true);
  assert.equal(isAllowedExternalCatalogItemId("ITEM-VERIFY"), true);
  assert.equal(isAllowedExternalCatalogItemId("item_1"), true);
  assert.equal(isAllowedExternalCatalogItemId(""), false);
  assert.equal(isAllowedExternalCatalogItemId("ITEM\tA"), false);
  assert.equal(isAllowedExternalCatalogItemId("ITEM\u0001A"), false);
  assert.equal(isAllowedExternalCatalogItemId("ITEM\u007f"), false);
  assert.equal(isAllowedExternalCatalogItemId("a".repeat(129)), false);
  assert.equal(isAllowedExternalCatalogItemId("a".repeat(128)), true);

  assert.equal(isAllowedExternalVariationId(""), true);
  assert.equal(isAllowedExternalVariationId("VAR-A"), true);
  assert.equal(isAllowedExternalVariationId("VAR\tA"), false);
  assert.equal(isAllowedExternalVariationId("VAR\u0001A"), false);
  assert.equal(isAllowedExternalVariationId("a".repeat(129)), false);
  assert.equal(isAllowedExternalVariationId("a".repeat(128)), true);
});

test("pgTAP fixture pins pos_catalog_item_mappings identity CHECKs to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /pos_catalog_item_mappings_external_catalog_item_id_check exists/);
  assert.match(pgTap, /pos_catalog_item_mappings_external_variation_id_check exists/);
  assert.match(
    pgTap,
    /external_catalog_item_id CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(pgTap, /external_catalog_item_id CHECK bounds length 1–128/);
  assert.match(
    pgTap,
    /external_variation_id CHECK allows empty-string sentinel/
  );
  assert.match(
    pgTap,
    /external_variation_id CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /external_variation_id CHECK bounds non-empty length 1–128/
  );
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII catalog id is not a control under COLLATE C/
  );
  assert.match(
    pgTap,
    /printable ASCII variation id is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
});
