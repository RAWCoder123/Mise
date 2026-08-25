import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  executePilotControlAction,
  normalizePilotControlMutationRequest,
  normalizePilotControlRequest
} from "../scripts/lib/pilotRestaurantControls.mjs";

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const auditId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function state(overrides: Record<string, unknown> = {}) {
  return {
    system: {
      singleton: true,
      operational_mode: "normal",
      square_sync_enabled: false,
      square_webhooks_enabled: false,
      gmail_delivery_enabled: false,
      order_drafting_enabled: false,
      ordering_policy: "off"
    },
    restaurant: {
      restaurant_id: restaurantId,
      square_sync_enabled: false,
      square_webhooks_enabled: false,
      gmail_delivery_enabled: false,
      order_drafting_enabled: false,
      ordering_policy: "off"
    },
    square: { connected: true, activeLocations: 1 },
    gmail: { connected: true, senderVerified: true, configuredRecipients: 1 },
    otherEnabled: { squareSync: 0, squareWebhooks: 0, gmailDelivery: 0, orderDrafting: 0 },
    ...overrides
  };
}

function applied(action: string, nextState: ReturnType<typeof state>) {
  return {
    outcome: "applied",
    auditId,
    requestId,
    restaurantId,
    actorUserId,
    action,
    reasonCode: action.replaceAll("-", "_"),
    changed: true,
    state: nextState
  };
}

test("pilot control requests stay bounded and applied changes require actor plus replay identity", () => {
  assert.deepEqual(
    normalizePilotControlRequest({ restaurantId: restaurantId.toUpperCase(), action: "disable-external" }),
    { restaurantId, action: "disable-external" }
  );
  assert.throws(() => normalizePilotControlRequest({ restaurantId: "not-a-uuid", action: "status" }), /restaurant UUID/);
  assert.throws(() => normalizePilotControlRequest({ restaurantId, action: "enable-everything" }), /Unsupported/);
  assert.throws(
    () => normalizePilotControlMutationRequest({ restaurantId, action: "enable-square-sync" }),
    /request UUID/
  );
  assert.throws(
    () => normalizePilotControlMutationRequest({ restaurantId, action: "status", requestId, actorUserId }),
    /read-only/
  );
  assert.deepEqual(
    normalizePilotControlMutationRequest({ restaurantId, action: "disable-square", requestId, actorUserId }),
    { restaurantId, action: "disable-square", requestId, actorUserId, reasonCode: "disable_square" }
  );
});

test("a mutation crosses exactly one atomic RPC operation and returns its audit identity", async () => {
  const nextState = state({
    system: { ...state().system, square_sync_enabled: true },
    restaurant: { ...state().restaurant, square_sync_enabled: true }
  });
  const calls: unknown[] = [];
  const result = await executePilotControlAction(
    { restaurantId, action: "enable-square-sync", requestId, actorUserId },
    {
      fetchState: async () => { throw new Error("mutation must not perform a separate state read"); },
      applyControl: async (request: unknown) => {
        calls.push(request);
        return applied("enable-square-sync", nextState);
      }
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(result.auditId, auditId);
  assert.equal(result.outcome, "applied");
  assert.equal(result.state.square.systemSync, true);
  assert.deepEqual(result.mutations, ["atomic:system.square_sync=on+restaurant.square_sync=on"]);
});

test("read-only status never invokes the mutation RPC", async () => {
  let reads = 0;
  const result = await executePilotControlAction(
    { restaurantId, action: "status" },
    {
      fetchState: async () => { reads += 1; return state(); },
      applyControl: async () => { throw new Error("status must not mutate"); }
    }
  );
  assert.equal(reads, 1);
  assert.equal(result.action, "status");
  assert.equal(result.state.operationalMode, "normal");
});

test("RPC authority mismatches and missing audit evidence fail closed", async () => {
  const request = { restaurantId, action: "disable-square", requestId, actorUserId };
  await assert.rejects(
    executePilotControlAction(request, {
      fetchState: async () => state(),
      applyControl: async () => ({ ...applied("disable-square", state()), auditId: null })
    }),
    /audit identity/
  );
  await assert.rejects(
    executePilotControlAction(request, {
      fetchState: async () => state(),
      applyControl: async () => ({ ...applied("disable-square", state()), actorUserId: requestId })
    }),
    /actor or action/
  );
});

test("pause and resume are routed through the same attributed atomic RPC boundary", async () => {
  const pausedState = state({ system: { ...state().system, operational_mode: "integrations_paused" } });
  const result = await executePilotControlAction(
    { restaurantId, action: "pause-integrations", requestId, actorUserId },
    {
      fetchState: async () => state(),
      applyControl: async () => applied("pause-integrations", pausedState)
    }
  );
  assert.equal(result.state.operationalMode, "integrations_paused");
  assert.equal(result.actorUserId, actorUserId);
});

test("pilot CLI has no split control updates and requires the service-owned RPC", () => {
  const source = readFileSync("scripts/pilot-restaurant-controls.mjs", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  assert.match(source, /assertStagingPreflight\(\)/);
  assert.match(source, /assertProvisioningEnvironment/);
  assert.match(source, /SUPABASE_STAGING_SECRET_KEY/);
  assert.match(source, /service_apply_pilot_operational_control/);
  assert.match(source, /"actor-user-id"/);
  assert.match(source, /"request-id"/);
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /service_set_system_operational_mode/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^)]*(?:secretKey|accessToken|refreshToken)/);
  assert.match(packageJson, /"pilot:controls"/);
});

test("the migration pins locking, actor verification, atomic audit, and service-only execution", () => {
  const migration = readFileSync(
    "supabase/migrations/20260824230000_mise_pilot_001_atomic_controls.sql",
    "utf8"
  );
  assert.match(migration, /system_operational_controls[\s\S]*for update/i);
  assert.match(migration, /restaurant_operational_controls[\s\S]*for update/i);
  assert.match(migration, /order by controls\.restaurant_id[\s\S]*for update/i);
  assert.match(migration, /membership\.role in \('owner', 'admin'\)/i);
  assert.match(migration, /insert into private\.pilot_operational_control_changes/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
  assert.match(migration, /revoke all[\s\S]*authenticated/i);
});
