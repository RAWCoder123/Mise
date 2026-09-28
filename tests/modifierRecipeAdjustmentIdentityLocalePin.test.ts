import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928070000_mise_005bh_modifier_recipe_adjustment_identity_locale_pin.sql",
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
    "../supabase/tests/database/modifier_recipe_adjustment_identity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

const isAllowedExternalModifierId = (value: string) =>
  value.length >= 1 &&
  value.length <= 128 &&
  !CONTROL_CHARACTERS.test(value);

test("MISE-005BH pins modifier_recipe_adjustments.external_modifier_id CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BH"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint modifier_recipe_adjustments_external_modifier_id_check\s+check \(\s*length\(external_modifier_id\) between 1 and 128\s+and external_modifier_id collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );

  assert.ok(
    migration.includes(`external_modifier_id collate "C" !~ '[[:cntrl:]]'`),
    "external_modifier_id CHECK must pin cntrl under COLLATE C"
  );
  assert.ok(
    migration.includes("length(external_modifier_id) between 1 and 128"),
    "external_modifier_id CHECK must bound length 1–128"
  );

  // Compose: do not rewrite contested modifier CRUD / sync / depletion
  // writers, free-form modifier_name, or free-form ledgers.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_catalog_item_mappings/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /modifier_name/);
});

test("original modifier_recipe_adjustments.external_modifier_id had no cntrl CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.modifier_recipe_adjustments \([\s\S]*?external_modifier_id text not null,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /external_modifier_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /modifier_recipe_adjustments_external_modifier_id_check/
  );
});

test("length + cntrl class matches the pinned CHECK contract", () => {
  assert.equal(isAllowedExternalModifierId("MOD-A"), true);
  assert.equal(isAllowedExternalModifierId("mod_1"), true);
  assert.equal(isAllowedExternalModifierId("ITEM-VERIFY"), true);
  assert.equal(isAllowedExternalModifierId(""), false);
  assert.equal(isAllowedExternalModifierId("MOD\tA"), false);
  assert.equal(isAllowedExternalModifierId("MOD\u0001A"), false);
  assert.equal(isAllowedExternalModifierId("MOD\u007f"), false);
  assert.equal(isAllowedExternalModifierId("a".repeat(129)), false);
  assert.equal(isAllowedExternalModifierId("a".repeat(128)), true);
});

test("pgTAP fixture pins modifier_recipe_adjustments.external_modifier_id CHECK to COLLATE C", () => {
  assert.match(pgTap, /select plan\(7\)/);
  assert.match(
    pgTap,
    /modifier_recipe_adjustments_external_modifier_id_check exists/
  );
  assert.match(
    pgTap,
    /external_modifier_id CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(pgTap, /external_modifier_id CHECK bounds length 1–128/);
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII modifier id is not a control under COLLATE C/
  );
  assert.match(
    pgTap,
    /printable ASCII lowercase modifier id is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
});
