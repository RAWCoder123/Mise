import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929120000_mise_005bz_edge_function_security_events_function_name_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/edge_function_security_events_function_name_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";
const ALLOWLIST = [
  "sync-pos-sales",
  "generate-ai-insights",
  "link-gmail",
  "gmail-oauth-callback",
  "send-supplier-email",
  "operational-workflows",
  "delete-account",
  "export-restaurant-data",
  "link-square",
  "square-oauth-callback",
  "square-webhooks"
] as const;

test("MISE-005BZ pins edge_function_security_events function_name CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BZ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint edge_function_security_events_function_name_check check \(\s*function_name in \(\s*'sync-pos-sales', 'generate-ai-insights', 'link-gmail',\s*'gmail-oauth-callback', 'send-supplier-email', 'operational-workflows',\s*'delete-account', 'export-restaurant-data',\s*'link-square', 'square-oauth-callback', 'square-webhooks'\s*\)\s*and function_name collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`function_name collate "C" ~ '${TOKEN_PATTERN}'`),
    "function_name CHECK must pin under COLLATE C"
  );
  for (const token of ALLOWLIST) {
    assert.ok(
      migration.includes(`'${token}'`),
      `exact function_name allowlist must preserve ${token}`
    );
  }

  // Compose: CHECK-only. Do not rewrite writers, policy, or sibling pins.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /edge_function_policy/i);
  assert.doesNotMatch(sqlBody, /alter table public\.insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("original edge function_name used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /edge_function_security_events_function_name_check[\s\S]*?check \(\s*function_name in \(\s*'sync-pos-sales', 'generate-ai-insights', 'link-gmail',\s*'gmail-oauth-callback', 'send-supplier-email', 'operational-workflows',\s*'delete-account', 'export-restaurant-data',\s*'link-square', 'square-oauth-callback', 'square-webhooks'\s*\)\s*\)/
  );
  assert.doesNotMatch(
    originalBound,
    /function_name collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins edge function_name to COLLATE C", () => {
  assert.match(pgTap, /select plan\(13\)/);
  assert.match(pgTap, /edge_function_security_events_function_name_check exists/);
  assert.match(pgTap, /function_name CHECK keeps exact allowlist/);
  assert.match(pgTap, /function_name CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token sync-pos-sales matches under COLLATE C/);
  assert.match(pgTap, /writer token export-restaurant-data matches under COLLATE C/);
  assert.match(pgTap, /writer token square-webhooks matches under COLLATE C/);
  assert.match(pgTap, /spaced function_name token is rejected under COLLATE C/);
  assert.match(pgTap, /empty function_name token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated function_name token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII function_name token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted function_name tokens match under COLLATE C/);
  assert.match(pgTap, /the Edge event constraint still accepts restaurant export events/);
  assert.match(pgTap, /export-compatible function_name CHECK remains pinned under COLLATE C/);
});
