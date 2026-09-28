import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928150000_mise_005bp_sync_cursor_writer_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalAuthority = readFileSync(
  new URL(
    "../supabase/migrations/20260822063410_mise_003a_authority_correction.sql",
    import.meta.url
  ),
  "utf8"
);
const baseApply = readFileSync(
  new URL(
    "../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/sync_cursor_writer_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005BP pins scoped sync_cursor cntrl preflight to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BP"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.service_apply_square_sync_result_scoped\(\s*p_actor_user_id uuid,\s*p_restaurant_id uuid,\s*p_integration_id uuid,\s*p_sync_token uuid,\s*p_snapshot_mode text,\s*p_sales jsonb,\s*p_catalog_items jsonb,\s*p_sync_cursor text,\s*p_from date,\s*p_to date/i
  );
  assert.match(
    migration,
    /normalized_sync_cursor := nullif\(left\(coalesce\(p_sync_cursor, ''\), 500\), ''\)/
  );
  assert.match(
    migration,
    /and normalized_sync_cursor collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /raise exception 'Square sync cursor is invalid' using errcode = '22023'/
  );
  // Pass the already-normalized cursor into base so storage matches the gate.
  assert.match(
    migration,
    /private\.service_apply_square_sync_result_mise_003a_base\(\s*p_actor_user_id,\s*p_restaurant_id,\s*p_integration_id,\s*prepared_sales,\s*p_catalog_items,\s*normalized_sync_cursor,\s*p_from,\s*p_to\s*\)/i
  );
  assert.match(
    migration,
    /grant execute on function private\.service_apply_square_sync_result_scoped\(\s*uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date\s*\)\s*to service_role/i
  );
  assert.match(
    migration,
    /revoke all on function private\.service_apply_square_sync_result_scoped\(\s*uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date\s*\)\s*from public, anon, authenticated, service_role/i
  );

  // Compose: writer-only. Do not reattach CHECK, rewrite base/prepare/oauth,
  // or touch free-form ledgers / contested location stacks.
  assert.doesNotMatch(sqlBody, /pos_integrations_sync_cursor_check/);
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_apply_square_sync_result_mise_003a_base/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.prepare_square_sales_for_authority/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_begin_square_authority_sync/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_fail_square_authority_sync/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_complete_square_oauth/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_locations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("MISE-003A scoped apply originally forwarded p_sync_cursor without cntrl gate", () => {
  assert.match(
    originalAuthority,
    /create or replace function private\.service_apply_square_sync_result_scoped\(/i
  );
  assert.doesNotMatch(
    originalAuthority,
    /normalized_sync_cursor collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalAuthority,
    /Square sync cursor is invalid/
  );
  // Base storage truncates without cntrl rejection (gap proved for #473 + this tip).
  assert.match(
    baseApply,
    /sync_cursor = nullif\(left\(coalesce\(p_sync_cursor, ''\), 500\), ''\)/
  );
  assert.doesNotMatch(
    baseApply,
    /p_sync_cursor collate "C" ~ '\[\[:cntrl:\]\]'/
  );
});

test("nullable stored sync_cursor class matches writer + CHECK contract", () => {
  const normalize = (value: string | null) => {
    if (value == null) return null;
    const truncated = value.slice(0, 500);
    return truncated === "" ? null : truncated;
  };
  const isAllowedStoredCursor = (value: string | null) => {
    const stored = normalize(value);
    return (
      stored === null ||
      (stored.length >= 1 &&
        stored.length <= 500 &&
        !/[\u0000-\u001f\u007f]/.test(stored))
    );
  };

  assert.equal(isAllowedStoredCursor(null), true);
  assert.equal(isAllowedStoredCursor(""), true);
  assert.equal(isAllowedStoredCursor("CAESEDabc123XYZ_cursor_token"), true);
  assert.equal(isAllowedStoredCursor("a".repeat(500)), true);
  assert.equal(isAllowedStoredCursor("a".repeat(501)), true); // truncated
  assert.equal(isAllowedStoredCursor("cursor\tpage-2"), false);
  assert.equal(isAllowedStoredCursor("cursor\u007fpage"), false);
  assert.equal(isAllowedStoredCursor("cursor\npage"), false);
});

test("pgTAP fixture pins scoped sync_cursor cntrl preflight site", () => {
  assert.match(pgTap, /select plan\(5\)/);
  assert.match(pgTap, /scoped sync_cursor cntrl preflight uses COLLATE C/);
  assert.match(
    pgTap,
    /scoped sync_cursor preflight raises clear invalid-cursor error/
  );
  assert.match(pgTap, /service_role retains EXECUTE on scoped Square sync apply/);
  assert.match(pgTap, /authenticated lacks EXECUTE on scoped Square sync apply/);
});
