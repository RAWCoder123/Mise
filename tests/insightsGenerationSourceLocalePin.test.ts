import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928231000_mise_005by_insights_generation_source_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260714183310_secure_operational_workflows.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/insights_generation_source_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005BY pins insights generation_source CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BY"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint insights_generation_source_check check \(\s*generation_source in \('manual', 'mise_rules', 'legacy_client'\)\s*and generation_source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`generation_source collate "C" ~ '${TOKEN_PATTERN}'`),
    "generation_source CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'manual'") &&
      migration.includes("'mise_rules'") &&
      migration.includes("'legacy_client'"),
    "exact generation_source allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling purchase pin.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations_generation_source_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /planning_revision/i);
});

test("original insights generation_source used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /insights_generation_source_check[\s\S]*?check \(generation_source in \('manual', 'mise_rules', 'legacy_client'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /generation_source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins insights generation_source to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /insights_generation_source_check exists/);
  assert.match(pgTap, /generation_source CHECK keeps exact allowlist/);
  assert.match(pgTap, /generation_source CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token manual matches under COLLATE C/);
  assert.match(pgTap, /writer token mise_rules matches under COLLATE C/);
  assert.match(pgTap, /writer token legacy_client matches under COLLATE C/);
  assert.match(pgTap, /spaced generation_source token is rejected under COLLATE C/);
  assert.match(pgTap, /empty generation_source token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated generation_source token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII generation_source token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted generation_source tokens match under COLLATE C/);
});
