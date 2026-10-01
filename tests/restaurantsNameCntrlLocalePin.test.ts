import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requireRestaurantName } from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001140000_mise_005ej_restaurants_name_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260714183313_bound_resources_and_staging_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurants_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005EJ pins restaurants.name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EJ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurants_name_length_check check \(\s*pg_catalog\.length\(pg_catalog\.btrim\(name\)\) between 1 and 120\s*and name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );

  assert.ok(
    migration.includes(`name collate "C" !~ '[[:cntrl:]]'`),
    "restaurants.name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("between 1 and 120"),
    "exact restaurants.name length bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite restaurant mutators or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create_restaurant_with_owner/i);
  assert.doesNotMatch(sqlBody, /restaurants_address_length_check/i);
  assert.doesNotMatch(sqlBody, /restaurants_cuisine_type_length_check/i);
  assert.doesNotMatch(sqlBody, /restaurants_logo_url_check/i);
  assert.doesNotMatch(sqlBody, /service_style/i);
  assert.doesNotMatch(sqlBody, /timezone/i);
});

test("original restaurants.name CHECK had length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint restaurants_name_length_check check \(length\(trim\(name\)\) between 1 and 120\)/
  );
  assert.doesNotMatch(
    original,
    /restaurants_name_length_check[\s\S]*?\[\[:cntrl:\]\]/
  );
});

test("requireRestaurantName rejects ASCII C control characters", () => {
  assert.equal(requireRestaurantName(" Harbor Kitchen "), "Harbor Kitchen");
  assert.throws(
    () => requireRestaurantName("Harbor\tKitchen"),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantName("Harbor\nKitchen"),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantName("Harbor\u007fKitchen"),
    /without control characters/
  );
  assert.match(
    validation,
    /export function requireRestaurantName[\s\S]*hasControlCharacters\(normalized\)/
  );
  assert.match(
    validation,
    /function hasControlCharacters\(value: string\) \{\s*return \/\[\\u0000-\\u001f\\u007f\]\/\.test\(value\);/
  );
});

test("pgTAP fixture pins restaurants.name to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /restaurants_name_length_check exists/);
  assert.match(pgTap, /restaurants name CHECK keeps exact length bound/);
  assert.match(pgTap, /restaurants name CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /printable restaurant name is accepted under COLLATE C/);
  assert.match(pgTap, /tab in restaurant name is rejected under COLLATE C/);
  assert.match(pgTap, /newline in restaurant name is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in restaurant name is rejected under COLLATE C/);
  assert.match(pgTap, /empty string has no control characters under COLLATE C/);
  assert.match(
    pgTap,
    /restaurant name control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
  assert.match(pgTap, /restaurants name CHECK keeps original length window/);
});
