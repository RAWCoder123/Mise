import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928040000_mise_005be_pos_location_external_id_locale_pin.sql",
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
    "../supabase/tests/database/pos_location_external_id_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const edgeSource = readFileSync(
  new URL("../supabase/functions/square-oauth-callback/index.ts", import.meta.url),
  "utf8"
);
const sharedSquare = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const LOCATION_PATTERN = "^[A-Za-z0-9_-]{1,128}$";

test("MISE-005BE pins pos_locations.external_location_id CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BE"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_locations_external_location_id_check check \(\s*external_location_id collate "C" ~ '\^\[A-Za-z0-9_-\]\{1,128\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`external_location_id collate "C" ~ '${LOCATION_PATTERN}'`),
    "external_location_id CHECK must pin under COLLATE C"
  );

  // Compose: do not rewrite contested complete-oauth (#236/#460), location
  // authorize (#236), pos_sales identity (#417), or free-form ledgers.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /service_complete_square_oauth/i);
  assert.doesNotMatch(sqlBody, /set_pos_location_status/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table private\.square_credentials/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("original pos_locations.external_location_id had no shape CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.pos_locations \([\s\S]*?external_location_id text not null,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /external_location_id collate "C" ~ '\^\[A-Za-z0-9_-\]\{1,128\}\$'/
  );
  assert.doesNotMatch(
    originalFoundation,
    /pos_locations_external_location_id_check/
  );
});

test("Edge square-oauth-callback external_location_id shape matches the pinned ASCII class", () => {
  assert.match(
    edgeSource,
    /const SQUARE_EXTERNAL_LOCATION_ID_PATTERN = \/\^\[A-Za-z0-9_-\]\{1,128\}\$\//
  );
  assert.match(edgeSource, /function isSquareExternalLocationId\(value: string\)/);
  assert.match(edgeSource, /isSquareExternalLocationId\(location\.externalLocationId\)/);
  assert.match(edgeSource, /square_oauth_location_id_invalid/);

  // Do not rewrite contested _shared/square.ts while #460 is open.
  assert.doesNotMatch(sharedSquare, /SQUARE_EXTERNAL_LOCATION_ID_PATTERN/);
  assert.doesNotMatch(sharedSquare, /isSquareExternalLocationId/);

  // Mirror the Edge allowlist locally so the static contract stays executable.
  const SQUARE_EXTERNAL_LOCATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
  const isSquareExternalLocationId = (value: string) =>
    SQUARE_EXTERNAL_LOCATION_ID_PATTERN.test(value);

  assert.equal(isSquareExternalLocationId("LABCDEFG1234567"), true);
  assert.equal(isSquareExternalLocationId("demo-location"), true);
  assert.equal(isSquareExternalLocationId("loc_1"), true);
  assert.equal(isSquareExternalLocationId("location with space"), false);
  assert.equal(isSquareExternalLocationId("ubicación-ñ"), false);
  assert.equal(isSquareExternalLocationId("location\twith-tab"), false);
  assert.equal(isSquareExternalLocationId(""), false);
  assert.equal(isSquareExternalLocationId("a".repeat(129)), false);
  assert.equal(isSquareExternalLocationId("a".repeat(128)), true);
});

test("pgTAP fixture pins pos_locations.external_location_id shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /pos_locations_external_location_id_check exists/);
  assert.match(
    pgTap,
    /pos_locations\.external_location_id CHECK uses COLLATE C ASCII shape/
  );
  assert.match(
    pgTap,
    /pos_locations\.external_location_id CHECK is not length-only/
  );
  assert.match(pgTap, /Square-style location id matches under COLLATE C/);
  assert.match(pgTap, /fixture ASCII location id matches under COLLATE C/);
  assert.match(pgTap, /spaced external_location_id is rejected under COLLATE C/);
  assert.match(pgTap, /ASCII tab external_location_id is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII external_location_id is rejected under COLLATE C/);
});
