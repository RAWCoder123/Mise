import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261008130000_commit_operational_signals_readiness_gate.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/commit_operational_signals_readiness_gate.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("commit_operational_signals empties recommendations without pilot canRecommend", () => {
  assert.match(migration, /create or replace function private\.evaluate_pilot_can_recommend/i);
  assert.match(migration, /create or replace function private\.commit_operational_signals/i);
  assert.match(
    migration,
    /readiness := private\.evaluate_pilot_can_recommend\(p_restaurant_id\);[\s\S]*can_recommend := coalesce\(\(readiness->>'canRecommend'\)::boolean, false\);[\s\S]*if can_recommend is not true then[\s\S]*safe_recommendations := '\[\]'::jsonb;/i
  );
  assert.match(migration, /minimum_sales_days integer := 7/i);
  assert.match(migration, /minimum_recipe_coverage numeric := 0\.9/i);
  assert.match(migration, /maximum_count_age_hours numeric := 36/i);
  assert.match(migration, /pg_catalog\.lower\(/i);
  assert.match(migration, /collate "C"/i);
  assert.doesNotMatch(migration, /grant execute on function private\.evaluate_pilot_can_recommend/i);
  // Approve / create wrappers stay on the purchase RPC readiness tip.
  assert.doesNotMatch(migration, /create_pending_purchase_recommendation/i);
  assert.doesNotMatch(migration, /approve_purchase_recommendation/i);
});

test("pgTAP proves blocked commits clear system recommendations and keep insights", () => {
  // Plan is derived from assertion call sites below, never from a run transcript.
  const assertionCalls = [
    ...pgTap.matchAll(/^\s*select\s+(?:ok|is|isnt|throws_ok|lives_ok)\s*\(/gim)
  ];
  assert.equal(assertionCalls.length, 8);
  assert.match(pgTap, /select\s+plan\(\s*8\s*\)/i);
  assert.match(pgTap, /ready restaurant evaluates canRecommend true for commit gate/i);
  assert.match(pgTap, /blocked restaurant evaluates canRecommend false for commit gate/i);
  assert.match(pgTap, /ready restaurant persists system recommendations on commit/i);
  assert.match(pgTap, /ready commit leaves one pending mise_rules recommendation/i);
  assert.match(pgTap, /blocked restaurant publishes zero system recommendations on commit/i);
  assert.match(pgTap, /blocked commit clears stale pending mise_rules recommendations/i);
  assert.match(pgTap, /blocked commit still replaces insights/i);
  assert.match(pgTap, /blocked commit still advances signal status to current/i);
});
