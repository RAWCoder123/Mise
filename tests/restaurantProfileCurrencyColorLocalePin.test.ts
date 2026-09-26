import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926220000_mise_005ab_restaurant_profile_currency_color_locale_pin.sql",
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
const originalOps = readFileSync(
  new URL("../supabase/migrations/202606210002_restaurant_ops_backbone.sql", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_profile_currency_color_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function profileFunctionBody(source: string): string {
  const start = source.indexOf("create or replace function private.update_restaurant_profile(");
  assert.ok(start >= 0, "private.update_restaurant_profile must exist");
  const end = source.indexOf("$$;", start);
  assert.ok(end > start, "function body terminator must exist");
  return source.slice(start, end);
}

test("MISE-005AB pins restaurant currency and hex color shape to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AB"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurants_currency_code_check\s+check \(currency collate "C" ~ '\^\[A-Z\]\{3\}\$'\)/
  );
  assert.match(
    migration,
    /add constraint restaurants_brand_color_check\s+check \(brand_color collate "C" ~ '\^#\[0-9A-Fa-f\]\{6\}\$'\)/
  );
  assert.match(
    migration,
    /add constraint restaurants_accent_color_check\s+check \(accent_color collate "C" ~ '\^#\[0-9A-Fa-f\]\{6\}\$'\)/
  );

  const body = profileFunctionBody(migration);
  assert.match(
    body,
    /\(p_patch ->> 'brand_color'\) collate "C" !~ '\^#\[0-9A-Fa-f\]\{6\}\$'/
  );
  assert.match(
    body,
    /\(p_patch ->> 'accent_color'\) collate "C" !~ '\^#\[0-9A-Fa-f\]\{6\}\$'/
  );
  assert.match(body, /\(p_patch ->> 'currency'\) collate "C" !~ '\^\[A-Z\]\{3\}\$'/);

  assert.match(
    migration,
    /revoke all on function private\.update_restaurant_profile\(\s*uuid, jsonb\s*\)\s*from public, anon, authenticated, service_role/i
  );

  // Compose: do not rewrite public wrapper, create RPC, or purchase_lines writers.
  assert.doesNotMatch(migration, /create or replace function public\.update_restaurant_profile/i);
  assert.doesNotMatch(migration, /create or replace function public\.create_restaurant_with_owner/i);
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(migration, /create or replace function private\.append_purchase_line/i);
  assert.doesNotMatch(migration, /alter table public\.purchase_lines/i);
});

test("original restaurant profile currency and color gates were bare", () => {
  assert.match(
    originalOps,
    /add constraint restaurants_brand_color_check check \(brand_color ~ '\^#\[0-9A-Fa-f\]\{6\}\$'\)/
  );
  assert.match(
    originalOps,
    /add constraint restaurants_accent_color_check check \(accent_color ~ '\^#\[0-9A-Fa-f\]\{6\}\$'\)/
  );
  assert.match(
    originalHarden,
    /add constraint restaurants_currency_code_check\s+check \(currency ~ '\^\[A-Z\]\{3\}\$'\)/
  );

  const body = profileFunctionBody(originalHarden);
  assert.match(body, /p_patch ->> 'brand_color' !~ '\^#\[0-9A-Fa-f\]\{6\}\$'/);
  assert.match(body, /p_patch ->> 'accent_color' !~ '\^#\[0-9A-Fa-f\]\{6\}\$'/);
  assert.match(body, /p_patch ->> 'currency' !~ '\^\[A-Z\]\{3\}\$'/);
  assert.doesNotMatch(body, /collate "C"/);
});

test("pgTAP fixture pins restaurant currency and color shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /restaurants currency CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurants brand_color CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurants accent_color CHECK uses COLLATE C/);
  assert.match(pgTap, /profile brand_color patch gate uses COLLATE C/);
  assert.match(pgTap, /profile accent_color patch gate uses COLLATE C/);
  assert.match(pgTap, /profile currency patch gate uses COLLATE C/);
  assert.match(pgTap, /authenticated retains EXECUTE on public\.update_restaurant_profile/);
  assert.match(pgTap, /authenticated lacks EXECUTE on private\.update_restaurant_profile/);
});

test("client hex and currency validators already match the ASCII shape", () => {
  assert.match("#EF3F27", /^#[0-9A-Fa-f]{6}$/);
  assert.match("#ef3f27", /^#[0-9A-Fa-f]{6}$/);
  assert.doesNotMatch("#EF3F2", /^#[0-9A-Fa-f]{6}$/);
  assert.doesNotMatch("EF3F27", /^#[0-9A-Fa-f]{6}$/);
  assert.match("USD", /^[A-Z]{3}$/);
  assert.doesNotMatch("usd", /^[A-Z]{3}$/);
  assert.doesNotMatch("US", /^[A-Z]{3}$/);
});
