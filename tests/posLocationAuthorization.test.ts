import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isPosLocationOperatorStatus,
  requirePosLocationOperatorStatus
} from "../services/domain/posLocations";
import { normalizePosLocation } from "../services/miseValidation";
import type { PosLocation } from "../types/mise";

function location(overrides: Partial<PosLocation> = {}): PosLocation {
  return {
    id: "loc-1",
    restaurant_id: "restaurant-a",
    pos_integration_id: "integration-1",
    external_location_id: "L123",
    display_name: "Downtown",
    timezone: "America/New_York",
    status: "active",
    created_at: "2026-08-28T10:00:00.000Z",
    updated_at: "2026-08-28T10:00:00.000Z",
    ...overrides
  };
}

test("operator POS location statuses are active or paused only", () => {
  assert.equal(isPosLocationOperatorStatus("active"), true);
  assert.equal(isPosLocationOperatorStatus("paused"), true);
  assert.equal(isPosLocationOperatorStatus("disconnected"), false);
  assert.equal(requirePosLocationOperatorStatus("paused"), "paused");
  assert.throws(() => requirePosLocationOperatorStatus("disconnected"));
});

test("normalizePosLocation preserves authorized and paused sync states", () => {
  assert.equal(normalizePosLocation(location()).status, "active");
  assert.equal(normalizePosLocation(location({ status: "paused" })).status, "paused");
  assert.equal(
    normalizePosLocation(location({ status: "disconnected" })).status,
    "disconnected"
  );
});

test("hosted POS location status changes use only the guarded RPC", () => {
  const source = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const start = source.indexOf("async setPosLocationStatus");
  const end = source.indexOf("async fetchPosMappingReviewQueue", start);
  const method = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(method, /rpc\("set_pos_location_status"/);
  assert.doesNotMatch(method, /\.from\("pos_locations"\)[\s\S]*\.update\(/);
});

test("POS settings screen wires location authorize and pause actions", () => {
  const screen = readFileSync("app/settings/pos.tsx", "utf8");
  assert.match(screen, /fetchPosLocations/);
  assert.match(screen, /setPosLocationStatus/);
  assert.match(screen, /pos\.locations\.authorize/);
  assert.match(screen, /pos\.locations\.pause/);
});

test("migration pins owner or admin location authorization and pause preservation", () => {
  const migration = readFileSync(
    "supabase/migrations/20260828180000_pos_location_authorization.sql",
    "utf8"
  );
  assert.match(migration, /create or replace function public\.set_pos_location_status/);
  assert.match(migration, /array\['owner', 'admin'\]/);
  assert.match(migration, /p_status is distinct from 'active' and p_status is distinct from 'paused'/);
  assert.match(migration, /when public\.pos_locations\.status = 'paused' then 'paused'/);
  assert.match(migration, /grant execute on function public\.set_pos_location_status/);
  assert.match(
    migration,
    /revoke all on function public\.set_pos_location_status\(uuid, uuid, text\)/
  );
  assert.doesNotMatch(migration, /grant (insert|update|delete) on public\.pos_locations to authenticated/i);
});
