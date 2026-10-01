import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260826100000_pilot_recommend_readiness_rpc_gate.sql", import.meta.url),
  "utf8"
);
const repository = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/pilotReadiness.ts", import.meta.url),
  "utf8"
);

test("pilot recommend readiness RPC gate evaluates POS, counts, and recipe coverage", () => {
  assert.match(migration, /create or replace function private\.evaluate_pilot_can_recommend/i);
  assert.match(migration, /create or replace function private\.require_pilot_can_recommend/i);
  assert.match(migration, /minimum_sales_days integer := 7/i);
  assert.match(migration, /minimum_recipe_coverage numeric := 0\.9/i);
  assert.match(migration, /maximum_count_age_hours numeric := 36/i);
  assert.match(migration, /can_recommend := pos_status = 'ready'/i);
  assert.match(migration, /inventory_status = 'ready'/i);
  assert.match(migration, /recipe_status = 'ready'/i);
  assert.match(migration, /private\.sale_requires_provider_identity/i);
  assert.match(migration, /pos_catalog_item_mappings/i);
});

test("pending approval and create-pending RPCs require pilot canRecommend", () => {
  assert.match(
    migration,
    /if recommendation_snapshot\.status = 'pending' then\s+perform private\.require_pilot_can_recommend/i
  );
  assert.match(
    migration,
    /create function public\.create_pending_purchase_recommendation[\s\S]*perform private\.require_pilot_can_recommend[\s\S]*create_pending_purchase_recommendation_pre_pilot_readiness/i
  );
  assert.match(
    migration,
    /raise exception 'Pilot readiness is incomplete for purchase recommendations\.'/i
  );
  assert.doesNotMatch(migration, /grant execute on function private\.evaluate_pilot_can_recommend/i);
  assert.doesNotMatch(migration, /grant execute on function private\.require_pilot_can_recommend/i);
});

test("hosted repository maps readiness RPC failures to typed pilot errors", () => {
  assert.match(repository, /mapPilotReadinessRpcError/);
  assert.match(repository, /create_pending_purchase_recommendation[\s\S]*mapPilotReadinessRpcError/);
  assert.match(repository, /approve_purchase_recommendation[\s\S]*mapPilotReadinessRpcError/);
  assert.match(domain, /class PilotReadinessBlockedError/);
  assert.match(domain, /isPilotReadinessRpcBlockedError/);
  assert.match(domain, /assertPilotCanRecommend/);
});
