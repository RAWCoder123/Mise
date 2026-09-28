import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928180000_mise_005bs_ai_insight_schema_version_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260715164843_harden_profile_ai_and_order_boundaries.sql",
    import.meta.url
  ),
  "utf8"
);
const backbone = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/ai_insight_schema_version_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const structuredInsights = readFileSync(
  new URL("../services/ai/structuredInsights.ts", import.meta.url),
  "utf8"
);
const edgeShared = readFileSync(
  new URL("../supabase/functions/_shared/mise.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const SCHEMA_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005BS pins ai_insights schema_version CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BS"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint ai_insights_schema_version_check check \(\s*schema_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`schema_version collate "C" ~ '${SCHEMA_PATTERN}'`),
    "schema_version CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling provenance pins.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_create_rules_engine_ai_insight/i
  );
  assert.doesNotMatch(sqlBody, /ai_insights_server_provenance_check/i);
  assert.doesNotMatch(sqlBody, /ai_insights_output_bounds_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
});

test("original ai_insights schema_version CHECK was length-only", () => {
  assert.match(
    originalBound,
    /ai_insights_schema_version_length_check[\s\S]*?check \(pg_catalog\.length\(schema_version\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    originalBound,
    /schema_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );

  assert.match(
    backbone,
    /schema_version text not null default 'mise\.ai_insight\.v1'/
  );
  assert.match(structuredInsights, /schema_version:\s*"mise\.ai_insight\.v1"/);
  assert.match(edgeShared, /schema_version:\s*"mise\.ai_insight\.v1"/);
  assert.match(
    originalBound,
    /'mise\.ai_insight\.v1'/
  );
});

test("pgTAP fixture pins ai_insights schema_version shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(7\)/);
  assert.match(pgTap, /ai_insights_schema_version_check exists/);
  assert.match(pgTap, /ai_insights schema_version CHECK uses COLLATE C/);
  assert.match(pgTap, /ai_insights schema_version CHECK is not length-only/);
  assert.match(
    pgTap,
    /writer schema_version mise\.ai_insight\.v1 matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced ai_insights schema_version is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty ai_insights schema_version is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /legacy ai_insights_schema_version_length_check is removed/
  );
});
