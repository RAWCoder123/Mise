import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928140000_mise_005bo_pos_locations_timezone_locale_pin.sql",
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
const squareOauth = readFileSync(
  new URL(
    "../supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
    import.meta.url
  ),
  "utf8"
);
const squareShared = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_locations_timezone_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TIMEZONE_PATTERN = "^[A-Za-z0-9/_+-]{1,64}$";

test("MISE-005BO pins pos_locations.timezone CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BO"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint pos_locations_timezone_check check \(/i
  );
  assert.match(
    migration,
    /timezone collate "C" ~ '\^\[A-Za-z0-9\/_\+-\]\{1,64\}\$'/
  );
  assert.match(migration, /timezone is null/);

  // Compose: CHECK-only. Do not rewrite contested Square OAuth / location
  // writer stacks (#236/#460/#465), sibling timezone CHECKs (#462/#463), or
  // free-form display_name / external_location_id.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /service_complete_square_oauth/i);
  assert.doesNotMatch(sqlBody, /service_apply_square_sync_result/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /restaurants_timezone/i);
  assert.doesNotMatch(sqlBody, /outreach_campaigns_timezone/i);
  assert.doesNotMatch(sqlBody, /add constraint[^;]*external_location_id/i);
  assert.doesNotMatch(sqlBody, /add constraint[^;]*display_name/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("original pos_locations.timezone had no shape CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.pos_locations \([\s\S]*?timezone text,/
  );
  assert.doesNotMatch(originalFoundation, /pos_locations_timezone_check/);
  assert.doesNotMatch(
    originalFoundation,
    /timezone collate "C" ~ '\^\[A-Za-z0-9\/_\+-\]\{1,64\}\$'/
  );
});

test("Square OAuth writer stores timezone via left(..., 64) / nullif empty", () => {
  assert.match(
    squareOauth,
    /nullif\(left\(coalesce\(location_row->>'timezone', ''\), 64\), ''\)/
  );
  // Edge mapper today accepts any ≤64 string; writer follow-up stays deferred
  // with open Square location stacks.
  assert.match(
    squareShared,
    /typeof record\.timezone === "string" && record\.timezone\.length <= 64/
  );
});

test("nullable IANA ASCII class matches the pinned CHECK contract", () => {
  const isAllowedPosLocationTimezone = (value: string | null) =>
    value === null || new RegExp(TIMEZONE_PATTERN).test(value);

  assert.equal(isAllowedPosLocationTimezone(null), true);
  assert.equal(isAllowedPosLocationTimezone("America/New_York"), true);
  assert.equal(isAllowedPosLocationTimezone("Etc/GMT+5"), true);
  assert.equal(isAllowedPosLocationTimezone("UTC"), true);
  assert.equal(isAllowedPosLocationTimezone("America/New York"), false);
  assert.equal(isAllowedPosLocationTimezone("America/São_Paulo"), false);
  assert.equal(isAllowedPosLocationTimezone("America/New_York\t"), false);
  assert.equal(isAllowedPosLocationTimezone(""), false);
  assert.equal(isAllowedPosLocationTimezone("a".repeat(65)), false);
});

test("pgTAP fixture pins pos_locations.timezone CHECK site", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /pos_locations_timezone_check exists/);
  assert.match(pgTap, /pos_locations\.timezone CHECK allows NULL/);
  assert.match(
    pgTap,
    /pos_locations\.timezone CHECK uses COLLATE C IANA ASCII shape/
  );
  assert.match(pgTap, /America\/New_York matches under COLLATE C/);
  assert.match(pgTap, /Etc\/GMT\+5 matches under COLLATE C/);
  assert.match(pgTap, /spaced timezone label is rejected under COLLATE C/);
  assert.match(pgTap, /ASCII tab timezone is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII timezone label is rejected under COLLATE C/);
});
