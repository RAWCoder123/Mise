import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928220000_mise_005bw_ai_insight_provenance_locale_pin.sql",
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
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/ai_insight_provenance_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005BW pins ai_insights provenance CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BW"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint ai_insights_server_provenance_check check \(\s*source = 'rules_engine'\s*and source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*and generated_by in \(\s*'edge_function_scaffold',\s*'mise_rules',\s*'staging_seed',\s*'legacy_unverified'\s*\)\s*and generated_by collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`source collate "C" ~ '${TOKEN_PATTERN}'`),
    "source CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`generated_by collate "C" ~ '${TOKEN_PATTERN}'`),
    "generated_by CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("source = 'rules_engine'"),
    "exact source allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'edge_function_scaffold'") &&
      migration.includes("'mise_rules'") &&
      migration.includes("'staging_seed'") &&
      migration.includes("'legacy_unverified'"),
    "exact generated_by allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling schema_version pin.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_create_rules_engine_ai_insight/i
  );
  assert.doesNotMatch(sqlBody, /ai_insights_schema_version/i);
  assert.doesNotMatch(sqlBody, /ai_insights_output_bounds_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("original ai_insights provenance used bare equality without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /ai_insights_server_provenance_check[\s\S]*?check \(\s*source = 'rules_engine'\s*and generated_by in \('edge_function_scaffold', 'mise_rules', 'staging_seed', 'legacy_unverified'\)\s*\)/
  );
  assert.doesNotMatch(
    originalBound,
    /source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /generated_by collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );

  assert.match(
    originalBound,
    /'rules_engine',\s*'mise\.ai_insight\.v1'/
  );
  assert.match(originalBound, /'edge_function_scaffold'/);
});

test("pgTAP fixture pins ai_insights provenance to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /ai_insights_server_provenance_check exists/);
  assert.match(pgTap, /provenance CHECK keeps exact source allowlist/);
  assert.match(pgTap, /provenance CHECK keeps exact generated_by allowlist/);
  assert.match(pgTap, /provenance source CHECK uses COLLATE C/);
  assert.match(pgTap, /provenance generated_by CHECK uses COLLATE C/);
  assert.match(pgTap, /writer source rules_engine matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer generated_by edge_function_scaffold matches under COLLATE C/
  );
  assert.match(pgTap, /spaced provenance token is rejected under COLLATE C/);
  assert.match(pgTap, /empty provenance token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated provenance token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII provenance token is rejected under COLLATE C/);
  assert.match(pgTap, /seed generated_by tokens match under COLLATE C/);
});
