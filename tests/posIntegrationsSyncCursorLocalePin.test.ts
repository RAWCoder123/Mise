import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928120000_mise_005bm_pos_integrations_sync_cursor_locale_pin.sql",
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
const squareSync = readFileSync(
  new URL(
    "../supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
    import.meta.url
  ),
  "utf8"
);
const authoritySync = readFileSync(
  new URL(
    "../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_integrations_sync_cursor_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005BM pins pos_integrations.sync_cursor cntrl CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BM"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint pos_integrations_sync_cursor_check check \(/i
  );
  assert.match(
    migration,
    /sync_cursor collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(migration, /length\(sync_cursor\) between 1 and 500/);
  assert.match(migration, /sync_cursor is null/);

  // Compose: CHECK-only. Do not rewrite Square sync writers, contested
  // complete-oauth / location stacks, or free-form ledgers.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /service_apply_square_sync_result/i);
  assert.doesNotMatch(sqlBody, /service_begin_square_authority_sync/i);
  assert.doesNotMatch(sqlBody, /service_complete_square_oauth/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_locations/i);
  assert.doesNotMatch(sqlBody, /alter table private\.square_credentials/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  // Do not accidentally reattach sibling external_location_id CHECK.
  assert.doesNotMatch(sqlBody, /external_location_id/i);
});

test("original pos_integrations.sync_cursor had no shape CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.pos_integrations \([\s\S]*?sync_cursor text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /pos_integrations_sync_cursor_check/
  );
  assert.doesNotMatch(
    originalFoundation,
    /sync_cursor collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("Square sync writers truncate sync_cursor to 500 without cntrl gate (prove the gap)", () => {
  assert.match(
    squareSync,
    /sync_cursor = nullif\(left\(coalesce\(p_sync_cursor, ''\), 500\), ''\)/
  );
  assert.doesNotMatch(
    squareSync,
    /p_sync_cursor collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    authoritySync,
    /sync_cursor = nullif\(left\(coalesce\(p_sync_cursor, ''\), 500\), ''\)/
  );
  assert.doesNotMatch(
    authoritySync,
    /p_sync_cursor collate "C" ~ '\[\[:cntrl:\]\]'/
  );
});

test("nullable length+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedSyncCursor = (value: string | null) =>
    value === null ||
    (value.length >= 1 &&
      value.length <= 500 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedSyncCursor(null), true);
  assert.equal(isAllowedSyncCursor("CAESEDabc123XYZ_cursor_token"), true);
  assert.equal(isAllowedSyncCursor("a".repeat(500)), true);
  assert.equal(isAllowedSyncCursor("a".repeat(501)), false);
  assert.equal(isAllowedSyncCursor(""), false);
  assert.equal(isAllowedSyncCursor("cursor\tpage-2"), false);
  assert.equal(isAllowedSyncCursor("cursor\u007fpage"), false);
  assert.equal(isAllowedSyncCursor("cursor\npage"), false);
});

test("pgTAP fixture pins pos_integrations.sync_cursor CHECK site", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /pos_integrations_sync_cursor_check exists/);
  assert.match(pgTap, /pos_integrations\.sync_cursor CHECK allows NULL/);
  assert.match(
    pgTap,
    /pos_integrations\.sync_cursor CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /pos_integrations\.sync_cursor CHECK preserves length 1–500 bound/
  );
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII sync cursor is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
  assert.match(
    pgTap,
    /max-length printable ASCII cursor is not a control under COLLATE C/
  );
});
