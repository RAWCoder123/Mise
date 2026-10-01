import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001130000_mise_005ei_pos_authority_sync_mode_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260822063410_mise_003a_authority_correction.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_authority_sync_mode_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005EI pins authority_sync_mode CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005EI"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_integrations_authority_sync_state_check check \(\s*\(\s*authority_sync_token is null[\s\S]*?authority_sync_mode in \('full', 'partial'\)\s*and authority_sync_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );

  assert.ok(
    migration.includes(`authority_sync_mode collate "C" ~ '${TOKEN_PATTERN}'`),
    "authority_sync_mode CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'full'") && migration.includes("'partial'"),
    "exact authority_sync_mode allowlist must be preserved"
  );
  assert.ok(
    migration.includes("authority_sync_token is null") &&
      migration.includes("authority_sync_mode is null") &&
      migration.includes("cardinality(authority_sync_location_ids) > 0"),
    "idle-all-null and active-lease state machine must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite Square sync writers or sibling POS tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /prepare_square/i);
  assert.doesNotMatch(sqlBody, /apply_square/i);
  assert.doesNotMatch(sqlBody, /service_apply_square_sync_result/i);
  assert.doesNotMatch(sqlBody, /sync_cursor/i);
  assert.doesNotMatch(sqlBody, /external_location_id/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
  assert.doesNotMatch(sqlBody, /pos_integrations_provider/i);
  assert.doesNotMatch(sqlBody, /pos_integrations_status/i);
});

test("original authority_sync_mode used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /pos_integrations_authority_sync_state_check check \(\s*\([\s\S]*?authority_sync_mode in \('full', 'partial'\)[\s\S]*?cardinality\(authority_sync_location_ids\) > 0/
  );
  assert.doesNotMatch(
    original,
    /authority_sync_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins authority_sync_mode to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(
    pgTap,
    /pos_integrations_authority_sync_state_check exists/
  );
  assert.match(
    pgTap,
    /pos_integrations authority_sync_mode CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /pos_integrations authority_sync_mode CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token full matches under COLLATE C/);
  assert.match(pgTap, /writer token partial matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced authority_sync_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty authority_sync_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated authority_sync_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII authority_sync_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted authority_sync_mode tokens match under COLLATE C/
  );
  assert.match(
    pgTap,
    /pos_integrations authority sync state CHECK keeps idle-all-null branch/
  );
});
