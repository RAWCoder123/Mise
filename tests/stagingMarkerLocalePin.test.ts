import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isStagingMarker,
  STAGING_MARKER_PATTERN,
} from "../scripts/staging-preflight.mjs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928000100_mise_005ba_staging_marker_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBounds = readFileSync(
  new URL(
    "../supabase/migrations/20260714183313_bound_resources_and_staging_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/staging_marker_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const preflight = readFileSync(
  new URL("../scripts/staging-preflight.mjs", import.meta.url),
  "utf8"
);
const safeEnv = readFileSync(
  new URL("../scripts/safe-env.mjs", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const MARKER_PATTERN = "^[A-Za-z0-9._-]{16,200}$";

test("MISE-005BA pins environment_identity.staging_marker CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BA"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint environment_identity_staging_marker_check check \(\s*staging_marker collate "C" ~ '\^\[A-Za-z0-9\._-\]\{16,200\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`staging_marker collate "C" ~ '${MARKER_PATTERN}'`),
    "staging_marker CHECK must pin under COLLATE C"
  );

  assert.match(
    migration,
    /p_expected_marker collate "C" ~ '\^\[A-Za-z0-9\._-\]\{16,200\}\$'/
  );

  assert.match(
    migration,
    /create or replace function public\.verify_staging_identity/
  );

  // Compose: do not rewrite contested sibling pins or private Square/Gmail writers.
  // Do not re-emit the anon grant — security.test deepEquals a single corpus grant.
  assert.doesNotMatch(sqlBody, /alter table private\.square_credentials/i);
  assert.doesNotMatch(sqlBody, /alter table private\.gmail_credentials/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /service_complete_square_oauth/i);
  assert.doesNotMatch(sqlBody, /service_complete_gmail_oauth/i);
  assert.doesNotMatch(sqlBody, /gmail_safe_error_code/i);
  assert.doesNotMatch(
    sqlBody,
    /grant\s+execute\s+on\s+function\s+public\.verify_staging_identity/i
  );
  assert.doesNotMatch(
    sqlBody,
    /revoke\s+all\s+on\s+function\s+public\.verify_staging_identity/i
  );

  assert.match(
    originalBounds,
    /grant execute on function public\.verify_staging_identity\(text\) to anon, authenticated;/i
  );
});

test("original environment_identity.staging_marker CHECK was length-only", () => {
  assert.match(
    originalBounds,
    /staging_marker text not null check \(length\(staging_marker\) between 16 and 200\)/
  );
  assert.match(
    originalBounds,
    /select length\(coalesce\(p_expected_marker, ''\)\) between 16 and 200/
  );
  assert.doesNotMatch(originalBounds, /environment_identity_staging_marker_check/);
  assert.doesNotMatch(
    originalBounds,
    /p_expected_marker collate "C" ~ '\^\[A-Za-z0-9\._-\]\{16,200\}\$'/
  );
});

test("pgTAP and preflight client pin the same COLLATE C staging_marker class", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /environment_identity_staging_marker_check/);
  assert.match(pgTap, /verify_staging_identity/);
  assert.match(pgTap, /mise-staging-marker-2026/);

  assert.match(preflight, /STAGING_MARKER_PATTERN/);
  assert.match(preflight, /isStagingMarker/);
  assert.ok(
    preflight.includes(MARKER_PATTERN) ||
      preflight.includes(String(STAGING_MARKER_PATTERN)),
    "preflight must export the ASCII staging marker pattern"
  );
  assert.match(preflight, /isStagingMarker\(marker\)/);

  assert.match(safeEnv, /isStagingMarker/);
  assert.match(safeEnv, /from "\.\/staging-preflight\.mjs"/);

  assert.equal(isStagingMarker("mise-staging-marker-2026"), true);
  assert.equal(isStagingMarker("mise_staging.marker-01"), true);
  assert.equal(isStagingMarker("short-marker-1"), false);
  assert.equal(isStagingMarker("mise staging marker!!"), false);
  assert.equal(isStagingMarker("mise-staging-café-2026"), false);
  assert.equal(isStagingMarker(""), false);
});
