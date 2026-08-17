import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isPosPlanningSyncStale,
  normalizePosPlanningSyncStatus,
  posPlanningNeedsOperatorAttention
} from "../services/domain/posPlanningSync";
import { deriveOperationalTodayTasks } from "../services/domain/todayTasks";
import type { PosIntegration } from "../types/mise";

const migration = readFileSync(
  "supabase/migrations/20260817021000_pos_planning_sync_state.sql",
  "utf8"
);
const syncPos = readFileSync("supabase/functions/sync-pos-sales/index.ts", "utf8");
const workflows = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");

function integration(patch: Partial<PosIntegration> = {}): PosIntegration {
  return {
    id: "pos_1",
    restaurant_id: "restaurant_1",
    provider: "square",
    status: "connected",
    external_location_id: "location_1",
    last_sync_at: "2026-08-17T01:00:00.000Z",
    sync_cursor: null,
    planning_sync_status: "fresh",
    planning_synced_at: "2026-08-17T01:00:00.000Z",
    planning_sync_error_code: null,
    settings: {},
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-17T01:00:00.000Z",
    ...patch
  };
}

test("planning sync status normalizer stays closed over known values", () => {
  assert.equal(normalizePosPlanningSyncStatus("fresh"), "fresh");
  assert.equal(normalizePosPlanningSyncStatus("stale"), "stale");
  assert.equal(normalizePosPlanningSyncStatus("unknown"), "unknown");
  assert.equal(normalizePosPlanningSyncStatus("weird"), "unknown");
});

test("operator attention requires a connected stale planning failure", () => {
  assert.equal(posPlanningNeedsOperatorAttention(integration()), false);
  assert.equal(
    isPosPlanningSyncStale(integration({ planning_sync_status: "stale" })),
    true
  );
  assert.equal(
    posPlanningNeedsOperatorAttention(
      integration({ planning_sync_status: "stale", planning_sync_error_code: null })
    ),
    false
  );
  assert.equal(
    posPlanningNeedsOperatorAttention(
      integration({
        planning_sync_status: "stale",
        planning_sync_error_code: "signal_refresh_failed"
      })
    ),
    true
  );
  assert.equal(
    posPlanningNeedsOperatorAttention(
      integration({
        status: "error",
        planning_sync_status: "stale",
        planning_sync_error_code: "signal_refresh_failed"
      })
    ),
    false
  );
});

test("today tasks keep connected POS incomplete when planning refresh failed", () => {
  const tasks = deriveOperationalTodayTasks({
    restaurantId: "restaurant_1",
    restaurantTimeZone: "UTC",
    now: new Date("2026-08-17T12:00:00.000Z"),
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    setupReadiness: null,
    posIntegrations: [
      integration({
        planning_sync_status: "stale",
        planning_sync_error_code: "signal_refresh_failed"
      })
    ],
    includeCompleted: true
  });
  const planningTask = tasks.find((task) => task.source.id === "pos_1");
  assert.ok(planningTask);
  assert.equal(planningTask?.status, "open");
  assert.equal(planningTask?.presentation.code, "today.integration.planningStale");
  assert.match(planningTask?.title ?? "", /Refresh Square planning/i);
});

test("POS planning sync migration keeps the recorder service-role only", () => {
  assert.match(migration, /planning_sync_status text not null default 'unknown'/i);
  assert.match(migration, /pos_integrations_planning_sync_status_check/i);
  assert.match(migration, /create or replace function private\.service_record_pos_planning_sync_state/i);
  assert.match(migration, /grant execute on function public\.service_record_pos_planning_sync_state/i);
  assert.match(
    migration,
    /revoke all on function public\.service_record_pos_planning_sync_state[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.service_record_pos_planning_sync_state[\s\S]*to service_role/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.service_record_pos_planning_sync_state[\s\S]*to authenticated/i
  );
});

test("Square sync records planning stale when signal refresh fails and clears on success", () => {
  assert.match(syncPos, /service_record_pos_planning_sync_state/i);
  assert.match(syncPos, /signal_refresh_failed/i);
  assert.match(syncPos, /planningSyncStatus/i);
  assert.match(syncPos, /p_status:\s*"stale"/i);
  assert.match(syncPos, /p_status:\s*"fresh"/i);
  assert.doesNotMatch(syncPos, /Sales persisted; signal refresh can retry from the client/i);
  assert.match(workflows, /planningFreshActions/i);
  assert.match(workflows, /service_record_pos_planning_sync_state/i);
  assert.match(workflows, /p_status:\s*"fresh"/i);
});
