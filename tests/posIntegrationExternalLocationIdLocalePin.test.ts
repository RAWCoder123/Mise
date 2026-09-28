import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928050000_mise_005bf_pos_integration_external_location_id_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_integration_external_location_id_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const LOCATION_PATTERN = "^[A-Za-z0-9_-]{1,128}$";

test("MISE-005BF pins pos_integrations.external_location_id CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BF"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_integrations_external_location_id_check check \(\s*external_location_id is null\s*or external_location_id collate "C" ~ '\^\[A-Za-z0-9_-\]\{1,128\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`external_location_id collate "C" ~ '${LOCATION_PATTERN}'`),
    "external_location_id CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("external_location_id is null"),
    "nullable primary snapshot must remain allowed when disconnected"
  );

  // Compose: do not rewrite contested complete-oauth (#236/#460), location
  // authorize (#236), pos_locations (#465), pos_sales identity (#417), or
  // free-form ledgers.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /service_complete_square_oauth/i);
  assert.doesNotMatch(sqlBody, /set_pos_location_status/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_locations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table private\.square_credentials/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("original pos_integrations.external_location_id had no shape CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.pos_integrations \([\s\S]*?external_location_id text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /external_location_id collate "C" ~ '\^\[A-Za-z0-9_-\]\{1,128\}\$'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /pos_integrations_external_location_id_check/
  );
});

test("nullable ASCII class matches the pinned CHECK contract", () => {
  const LOCATION_PATTERN_RE = /^[A-Za-z0-9_-]{1,128}$/;
  const isAllowedPrimaryExternalLocationId = (value: string | null) =>
    value === null || LOCATION_PATTERN_RE.test(value);

  assert.equal(isAllowedPrimaryExternalLocationId(null), true);
  assert.equal(isAllowedPrimaryExternalLocationId("LABCDEFG1234567"), true);
  assert.equal(isAllowedPrimaryExternalLocationId("demo-location"), true);
  assert.equal(isAllowedPrimaryExternalLocationId("demo-square-location"), true);
  assert.equal(isAllowedPrimaryExternalLocationId("loc_1"), true);
  assert.equal(isAllowedPrimaryExternalLocationId("location with space"), false);
  assert.equal(isAllowedPrimaryExternalLocationId("ubicación-ñ"), false);
  assert.equal(isAllowedPrimaryExternalLocationId("location\twith-tab"), false);
  assert.equal(isAllowedPrimaryExternalLocationId(""), false);
  assert.equal(isAllowedPrimaryExternalLocationId("a".repeat(129)), false);
  assert.equal(isAllowedPrimaryExternalLocationId("a".repeat(128)), true);
});

test("pgTAP fixture pins pos_integrations.external_location_id shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(9\)/);
  assert.match(pgTap, /pos_integrations_external_location_id_check exists/);
  assert.match(
    pgTap,
    /pos_integrations\.external_location_id CHECK allows NULL/
  );
  assert.match(
    pgTap,
    /pos_integrations\.external_location_id CHECK uses COLLATE C ASCII shape/
  );
  assert.match(
    pgTap,
    /pos_integrations\.external_location_id CHECK is not length-only/
  );
  assert.match(pgTap, /Square-style primary location id matches under COLLATE C/);
  assert.match(pgTap, /fixture ASCII primary location id matches under COLLATE C/);
  assert.match(pgTap, /spaced primary external_location_id is rejected under COLLATE C/);
  assert.match(pgTap, /ASCII tab primary external_location_id is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII primary external_location_id is rejected under COLLATE C/);
});
