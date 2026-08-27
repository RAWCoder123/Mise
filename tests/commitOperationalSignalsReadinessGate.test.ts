import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260827050000_commit_operational_signals_readiness_gate.sql",
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

test("commit_operational_signals empties recommendations when canRecommend is false", () => {
  assert.match(migration, /create or replace function private\.commit_operational_signals/i);
  assert.match(migration, /readiness := private\.evaluate_pilot_can_recommend\(p_restaurant_id\)/i);
  assert.match(migration, /can_recommend := coalesce\(\(readiness->>'canRecommend'\)::boolean, false\)/i);
  assert.match(
    migration,
    /if can_recommend is not true then\s+safe_recommendations := '\[\]'::jsonb;/i
  );
  assert.match(
    migration,
    /delete from public\.purchase_recommendations[\s\S]*generation_source in \('mise_rules', 'legacy_client'\)/i
  );
  assert.match(migration, /delete from public\.insights where restaurant_id = p_restaurant_id/i);
  assert.doesNotMatch(
    migration,
    /commit_operational_signals[\s\S]*raise exception 'Pilot readiness is incomplete for purchase recommendations\.'/i
  );
});

test("purchase RPC wrappers authorize membership before readiness evaluation", () => {
  assert.match(
    migration,
    /create or replace function public\.approve_purchase_recommendation[\s\S]*if auth\.uid\(\) is null or not private\.is_restaurant_member\(p_restaurant_id\)[\s\S]*require_pilot_can_recommend/i
  );
  assert.match(
    migration,
    /create or replace function public\.create_pending_purchase_recommendation[\s\S]*if auth\.uid\(\) is null or not private\.is_restaurant_member\(p_restaurant_id\)[\s\S]*require_pilot_can_recommend/i
  );
});

test("pgTAP proves blocked commit clears system recommendations and keeps insights", () => {
  assert.match(pgTap, /blocked restaurant publishes zero system recommendations on commit/i);
  assert.match(pgTap, /blocked commit clears stale pending mise_rules recommendations/i);
  assert.match(pgTap, /blocked commit still replaces insights/i);
  assert.match(pgTap, /outsider cannot create pending recommendations for another restaurant/i);
  assert.match(pgTap, /outsider cannot approve recommendations for another restaurant/i);
});
