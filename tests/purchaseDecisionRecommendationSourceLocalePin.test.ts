import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001050000_mise_005ea_purchase_decision_recommendation_source_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_decision_recommendation_source_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005EA pins purchase_decision recommendation_source CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005EA"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_decision_events_recommendation_source_check\s+check \(\s*recommendation_source in \('mise_rules', 'legacy_client'\)\s*and recommendation_source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`recommendation_source collate "C" ~ '${TOKEN_PATTERN}'`),
    "recommendation_source CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'mise_rules'") && migration.includes("'legacy_client'"),
    "exact recommendation_source allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_purchase_decision/i);
  assert.doesNotMatch(sqlBody, /purchase_decision_actor_role/i);
  assert.doesNotMatch(sqlBody, /purchase_decision_events_shape_check/i);
  assert.doesNotMatch(sqlBody, /actor_role/i);
  assert.doesNotMatch(sqlBody, /decision_type/i);
  assert.doesNotMatch(sqlBody, /source_event_key/i);
  assert.doesNotMatch(sqlBody, /evidence_version/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
  assert.doesNotMatch(sqlBody, /generation_source/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
});

test("original purchase_decision recommendation_source used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /recommendation_source text not null check \(\s*recommendation_source in \('mise_rules', 'legacy_client'\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /recommendation_source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins purchase_decision recommendation_source to COLLATE C", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(
    pgTap,
    /purchase_decision_events_recommendation_source_check exists/
  );
  assert.match(
    pgTap,
    /purchase_decision_events recommendation_source CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /purchase_decision_events recommendation_source CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token mise_rules matches under COLLATE C/);
  assert.match(pgTap, /writer token legacy_client matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced recommendation_source token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty recommendation_source token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated recommendation_source token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII recommendation_source token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted recommendation_source tokens match under COLLATE C/
  );
});
