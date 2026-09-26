import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926230000_mise_005ac_restaurant_logo_url_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalHarden = readFileSync(
  new URL(
    "../supabase/migrations/20260715164843_harden_profile_ai_and_order_boundaries.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_logo_url_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const LOGO_HOST_PATTERN =
  "^https://([A-Za-z0-9-]+\\.)+[A-Za-z]{2,63}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$";

function profileFunctionBody(source: string): string {
  const start = source.indexOf("create or replace function private.update_restaurant_profile(");
  assert.ok(start >= 0, "private.update_restaurant_profile must exist");
  const end = source.indexOf("$$;", start);
  assert.ok(end > start, "function body terminator must exist");
  return source.slice(start, end);
}

test("MISE-005AC pins restaurant logo_url HTTPS host class to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AC"), "additive pin must stay labeled");

  assert.ok(
    migration.includes(`logo_url collate "C" ~* '${LOGO_HOST_PATTERN}'`),
    "CHECK must pin logo_url host class under COLLATE C"
  );

  const body = profileFunctionBody(migration);
  assert.ok(
    body.includes(`next_logo_url collate "C" !~* '${LOGO_HOST_PATTERN}'`),
    "profile patch gate must pin logo_url under COLLATE C"
  );

  assert.match(
    migration,
    /revoke all on function private\.update_restaurant_profile\(\s*uuid, jsonb\s*\)\s*from public, anon, authenticated, service_role/i
  );

  // Compose: do not rewrite public wrapper, create RPC, currency/hex (005AB),
  // or purchase_lines writers.
  assert.doesNotMatch(migration, /create or replace function public\.update_restaurant_profile/i);
  assert.doesNotMatch(migration, /create or replace function public\.create_restaurant_with_owner/i);
  assert.doesNotMatch(migration, /restaurants_currency_code_check/);
  assert.doesNotMatch(migration, /restaurants_brand_color_check/);
  assert.doesNotMatch(migration, /restaurants_accent_color_check/);
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(migration, /alter table public\.purchase_lines/i);
});

test("original restaurant logo_url gates were bare", () => {
  assert.ok(
    originalHarden.includes(`logo_url ~* '${LOGO_HOST_PATTERN}'`),
    "original CHECK used bare logo_url ~*"
  );
  assert.ok(
    !originalHarden.includes(`logo_url collate "C" ~* '${LOGO_HOST_PATTERN}'`),
    "original CHECK must not already pin COLLATE C"
  );

  const body = profileFunctionBody(originalHarden);
  assert.ok(
    body.includes(`next_logo_url !~* '${LOGO_HOST_PATTERN}'`),
    "original patch gate used bare !~*"
  );
  assert.ok(
    !body.includes(`next_logo_url collate "C"`),
    "original patch gate must not already pin COLLATE C"
  );
});

test("pgTAP fixture pins restaurant logo_url shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(pgTap, /restaurants logo_url CHECK uses COLLATE C/);
  assert.match(pgTap, /profile logo_url patch gate uses COLLATE C/);
  assert.match(pgTap, /authenticated retains EXECUTE on public\.update_restaurant_profile/);
  assert.match(pgTap, /authenticated lacks EXECUTE on private\.update_restaurant_profile/);
});

test("client HTTPS logo URL shape already matches the ASCII host class", () => {
  const pattern =
    /^https:\/\/([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(:[0-9]{1,5})?([/?#][^\s]*)?$/i;
  assert.match("https://cdn.example.com/logo.png", pattern);
  assert.match("https://assets.example.co.uk:443/a/b.png?x=1", pattern);
  assert.doesNotMatch("http://cdn.example.com/logo.png", pattern);
  assert.doesNotMatch("https://bad_host.example/logo.png", pattern);
  assert.doesNotMatch("https://example.com/logo with space.png", pattern);
});
