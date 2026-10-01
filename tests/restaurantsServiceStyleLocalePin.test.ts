import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001100000_mise_005ef_restaurants_service_style_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurants_service_style_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005EF pins restaurants service_style CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005EF"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurants_service_style_check\s+check \(\s*service_style in \(\s*'quick_service',\s*'fast_casual',\s*'full_service',\s*'bar',\s*'cafe',\s*'ghost_kitchen'\s*\)\s*and service_style collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`service_style collate "C" ~ '${TOKEN_PATTERN}'`),
    "service_style CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'quick_service'") &&
      migration.includes("'fast_casual'") &&
      migration.includes("'full_service'") &&
      migration.includes("'bar'") &&
      migration.includes("'cafe'") &&
      migration.includes("'ghost_kitchen'"),
    "exact service_style allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /update_restaurant_profile/i);
  assert.doesNotMatch(sqlBody, /brand_color/i);
  assert.doesNotMatch(sqlBody, /accent_color/i);
  assert.doesNotMatch(sqlBody, /setup_attachments/i);
  assert.doesNotMatch(sqlBody, /backend_identity/i);
  assert.doesNotMatch(sqlBody, /requested_action/i);
  assert.doesNotMatch(sqlBody, /alter table public\.setup_attachments/i);
  assert.doesNotMatch(sqlBody, /alter table private\.pilot_operational_control_changes/i);
});

test("original restaurants service_style used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /add constraint restaurants_service_style_check check \(\s*service_style in \('quick_service', 'fast_casual', 'full_service', 'bar', 'cafe', 'ghost_kitchen'\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /service_style collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurants service_style to COLLATE C", () => {
  assert.match(pgTap, /select plan\(14\)/);
  assert.match(pgTap, /restaurants_service_style_check exists/);
  assert.match(pgTap, /restaurants service_style CHECK keeps exact allowlist/);
  assert.match(pgTap, /restaurants service_style CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token quick_service matches under COLLATE C/);
  assert.match(pgTap, /writer token fast_casual matches under COLLATE C/);
  assert.match(pgTap, /writer token full_service matches under COLLATE C/);
  assert.match(pgTap, /writer token bar matches under COLLATE C/);
  assert.match(pgTap, /writer token cafe matches under COLLATE C/);
  assert.match(pgTap, /writer token ghost_kitchen matches under COLLATE C/);
  assert.match(pgTap, /spaced service_style token is rejected under COLLATE C/);
  assert.match(pgTap, /empty service_style token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated service_style token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII service_style token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted service_style tokens match under COLLATE C/
  );
});
