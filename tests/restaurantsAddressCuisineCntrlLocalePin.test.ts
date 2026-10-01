import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  requireRestaurantAddress,
  requireRestaurantCuisineType,
  requireRestaurantProfilePatch
} from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001150000_mise_005ek_restaurants_address_cuisine_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260715164843_harden_profile_ai_and_order_boundaries.sql",
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
    "../supabase/tests/database/restaurants_address_cuisine_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005EK pins restaurants.address and cuisine_type CHECKs to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EK"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurants_address_length_check check \(\s*address is null\s*or \(\s*pg_catalog\.length\(address\) <= 500\s*and address collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurants_cuisine_type_length_check check \(\s*cuisine_type is null\s*or \(\s*pg_catalog\.length\(cuisine_type\) <= 120\s*and cuisine_type collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`address collate "C" !~ '[[:cntrl:]]'`),
    "restaurants.address CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(`cuisine_type collate "C" !~ '[[:cntrl:]]'`),
    "restaurants.cuisine_type CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(migration.includes("<= 500"), "exact address length bound must be preserved");
  assert.ok(migration.includes("<= 120"), "exact cuisine_type length bound must be preserved");

  // Compose: CHECK-only. Do not rewrite profile mutators or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /update_restaurant_profile/i);
  assert.doesNotMatch(sqlBody, /restaurants_name_length_check/i);
  assert.doesNotMatch(sqlBody, /restaurants_logo_url_check/i);
  assert.doesNotMatch(sqlBody, /service_style/i);
  assert.doesNotMatch(sqlBody, /timezone/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /insights_content_bounds/i);
});

test("original restaurants address and cuisine_type CHECKs had length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint restaurants_address_length_check\s+check \(address is null or pg_catalog\.length\(address\) <= 500\)/
  );
  assert.match(
    original,
    /add constraint restaurants_cuisine_type_length_check\s+check \(cuisine_type is null or pg_catalog\.length\(cuisine_type\) <= 120\)/
  );
  assert.doesNotMatch(
    original,
    /restaurants_address_length_check[\s\S]*?\[\[:cntrl:\]\]/
  );
  assert.doesNotMatch(
    original,
    /restaurants_cuisine_type_length_check[\s\S]*?\[\[:cntrl:\]\]/
  );
});

test("requireRestaurantAddress rejects ASCII C control characters", () => {
  assert.equal(requireRestaurantAddress(" 12 Harbor St "), "12 Harbor St");
  assert.equal(requireRestaurantAddress(""), null);
  assert.equal(requireRestaurantAddress(null), null);
  assert.throws(
    () => requireRestaurantAddress("12 Harbor\tSt"),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantAddress("12 Harbor\nSt"),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantAddress("12 Harbor\u007fSt"),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantAddress("A".repeat(501)),
    /500 characters/
  );
  assert.match(
    validation,
    /export function requireRestaurantAddress[\s\S]*hasControlCharacters\(normalized\)/
  );
});

test("requireRestaurantCuisineType rejects ASCII C control characters", () => {
  assert.equal(requireRestaurantCuisineType(" Coastal "), "Coastal");
  assert.equal(requireRestaurantCuisineType(""), null);
  assert.throws(
    () => requireRestaurantCuisineType("Coastal\tItalian"),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantCuisineType("Coastal\nItalian"),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantCuisineType("Coastal\u007fItalian"),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantCuisineType("C".repeat(121)),
    /120 characters/
  );
  assert.match(
    validation,
    /export function requireRestaurantCuisineType[\s\S]*hasControlCharacters\(normalized\)/
  );
  assert.match(
    validation,
    /function hasControlCharacters\(value: string\) \{\s*return \/\[\\u0000-\\u001f\\u007f\]\/\.test\(value\);/
  );
});

test("requireRestaurantProfilePatch routes address through cntrl-aware validator", () => {
  assert.equal(
    requireRestaurantProfilePatch({ address: " 12 Harbor St " }).address,
    "12 Harbor St"
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ address: "12 Harbor\tSt" }),
    /without control characters/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ cuisine_type: "Coastal\nItalian" }),
    /without control characters/
  );
  assert.match(
    validation,
    /if \(patch\.address !== undefined\) patch\.address = requireRestaurantAddress\(patch\.address\);/
  );
});

test("pgTAP fixture pins restaurants address and cuisine_type to COLLATE C", () => {
  assert.match(pgTap, /select plan\(15\)/);
  assert.match(pgTap, /restaurants_address_length_check exists/);
  assert.match(pgTap, /restaurants address CHECK keeps exact length bound/);
  assert.match(pgTap, /restaurants address CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /restaurants_cuisine_type_length_check exists/);
  assert.match(pgTap, /restaurants cuisine_type CHECK keeps exact length bound/);
  assert.match(pgTap, /restaurants cuisine_type CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /printable restaurant profile text is accepted under COLLATE C/);
  assert.match(pgTap, /tab in restaurant profile text is rejected under COLLATE C/);
  assert.match(pgTap, /newline in restaurant profile text is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in restaurant profile text is rejected under COLLATE C/);
  assert.match(pgTap, /empty string has no control characters under COLLATE C/);
  assert.match(
    pgTap,
    /restaurant profile control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
  assert.match(pgTap, /restaurants address CHECK keeps original length window/);
  assert.match(pgTap, /restaurants cuisine_type CHECK keeps original length window/);
});
