import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  IANA_TIMEZONE_SHAPE_PATTERN,
  isIanaTimezoneShape,
  requireRestaurantProfilePatch
} from "../services/miseValidation.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928010000_mise_005bb_restaurant_timezone_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalProfile = readFileSync(
  new URL(
    "../supabase/migrations/20260715164843_harden_profile_ai_and_order_boundaries.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_timezone_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TIMEZONE_PATTERN = "^[A-Za-z0-9/_+-]{1,64}$";

test("MISE-005BB pins restaurants.timezone CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BB"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurants_timezone_length_check check \(\s*timezone collate "C" ~ '\^\[A-Za-z0-9\/_\+-\]\{1,64\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`timezone collate "C" ~ '${TIMEZONE_PATTERN}'`),
    "timezone CHECK must pin under COLLATE C"
  );

  // Compose: do not rewrite profile update / create (owned by open #436/#437)
  // or sibling restaurant identity CHECKs.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.update_restaurant_profile/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.update_restaurant_profile/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.create_restaurant_with_owner/i
  );
  assert.doesNotMatch(sqlBody, /restaurants_currency_code_check/i);
  assert.doesNotMatch(sqlBody, /restaurants_brand_color_check/i);
  assert.doesNotMatch(sqlBody, /restaurants_accent_color_check/i);
  assert.doesNotMatch(sqlBody, /restaurants_logo_url_check/i);
  assert.doesNotMatch(sqlBody, /outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
});

test("original restaurants.timezone CHECK was length-only", () => {
  assert.match(
    originalProfile,
    /add constraint restaurants_timezone_length_check\s+check \(pg_catalog\.length\(timezone\) between 1 and 64\)/
  );
  assert.doesNotMatch(
    originalProfile,
    /timezone collate "C" ~ '\^\[A-Za-z0-9\/_\+-\]\{1,64\}\$'/
  );
});

test("client IANA timezone shape allowlist matches the pinned ASCII class", () => {
  assert.equal(IANA_TIMEZONE_SHAPE_PATTERN.source, TIMEZONE_PATTERN);
  assert.equal(isIanaTimezoneShape("America/New_York"), true);
  assert.equal(isIanaTimezoneShape("Etc/GMT+5"), true);
  assert.equal(isIanaTimezoneShape("UTC"), true);
  assert.equal(isIanaTimezoneShape("America/New York"), false);
  assert.equal(isIanaTimezoneShape("America/São_Paulo"), false);
  assert.equal(isIanaTimezoneShape("America/New_York\t"), false);
  assert.equal(isIanaTimezoneShape(""), false);
  assert.equal(isIanaTimezoneShape("a".repeat(65)), false);

  assert.match(validationSource, /export const IANA_TIMEZONE_SHAPE_PATTERN/);
  assert.match(validationSource, /export function isIanaTimezoneShape/);
  assert.match(
    validationSource,
    /if \(typeof value !== "string" \|\| !isIanaTimezoneShape\(value\)\)/
  );

  assert.deepEqual(requireRestaurantProfilePatch({ timezone: "America/Chicago" }), {
    timezone: "America/Chicago"
  });
  assert.throws(
    () => requireRestaurantProfilePatch({ timezone: "America/New York" }),
    /IANA timezone/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ timezone: "America/São_Paulo" }),
    /IANA timezone/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ timezone: "Mars/Olympus_Mons" }),
    /IANA timezone/
  );
});

test("pgTAP fixture pins restaurants.timezone shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /restaurants_timezone_length_check exists/);
  assert.match(pgTap, /restaurants\.timezone CHECK uses COLLATE C IANA ASCII shape/);
  assert.match(pgTap, /restaurants\.timezone CHECK is not length-only/);
  assert.match(pgTap, /America\/New_York matches under COLLATE C/);
  assert.match(pgTap, /Etc\/GMT\+5 matches under COLLATE C/);
  assert.match(pgTap, /spaced timezone label is rejected under COLLATE C/);
  assert.match(pgTap, /ASCII tab timezone is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII timezone label is rejected under COLLATE C/);
});
