import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  executePilotControlAction,
  normalizePilotControlRequest,
  plannedPilotControlMutations
} from "../scripts/lib/pilotRestaurantControls.mjs";

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

function operations(initial = state()) {
  let current = structuredClone(initial);
  const calls: string[] = [];
  return {
    calls,
    fetchState: async () => structuredClone(current),
    updateSystem: async (patch: Record<string, unknown>) => {
      calls.push(`system:${Object.keys(patch).sort().join(",")}`);
      current.system = { ...current.system, ...patch };
    },
    updateRestaurant: async (_restaurantId: string, patch: Record<string, unknown>) => {
      calls.push(`restaurant:${Object.keys(patch).sort().join(",")}`);
      current.restaurant = { ...current.restaurant, ...patch };
    },
    setSystemMode: async (mode: string) => {
      calls.push(`mode:${mode}`);
      current.system = { ...current.system, operational_mode: mode };
    }
  };
}

test("pilot control requests are bounded to explicit restaurant-scoped actions", () => {
  assert.deepEqual(
    normalizePilotControlRequest({ restaurantId: restaurantId.toUpperCase(), action: "disable-external" }),
    { restaurantId, action: "disable-external" }
  );
  assert.throws(() => normalizePilotControlRequest({ restaurantId: "not-a-uuid", action: "status" }), /restaurant UUID/);
  assert.throws(() => normalizePilotControlRequest({ restaurantId, action: "enable-everything" }), /Unsupported/);
  assert.deepEqual(plannedPilotControlMutations("disable-gmail-delivery"), ["restaurant.gmail_delivery=off"]);
});

test("Square enablement proves connection and opens the global gate before the tenant gate", async () => {
  const ops = operations();
  const result = await executePilotControlAction({ restaurantId, action: "enable-square-sync" }, ops);
  assert.deepEqual(ops.calls, ["system:square_sync_enabled", "restaurant:square_sync_enabled"]);
  assert.equal(result.state.square.systemSync, true);
  assert.equal(result.state.square.restaurantSync, true);

  const incomplete = operations(state({ square: { connected: true, activeLocations: 0 } }));
  await assert.rejects(
    executePilotControlAction({ restaurantId, action: "enable-square-sync" }, incomplete),
    /active location/
  );
  assert.deepEqual(incomplete.calls, []);
});

test("global enablement refuses to activate a previously armed different restaurant", async () => {
  const ops = operations(state({
    otherEnabled: { squareSync: 1, squareWebhooks: 0, gmailDelivery: 0, orderDrafting: 0 }
  }));
  await assert.rejects(
    executePilotControlAction({ restaurantId, action: "enable-square-sync" }, ops),
    /another restaurant/
  );
  assert.deepEqual(ops.calls, []);
});

test("Gmail enablement requires a verified sender and supplier recipient", async () => {
  const missingRecipient = operations(state({
    gmail: { connected: true, senderVerified: true, configuredRecipients: 0 }
  }));
  await assert.rejects(
    executePilotControlAction({ restaurantId, action: "enable-gmail-delivery" }, missingRecipient),
    /supplier recipient/
  );

  const ops = operations();
  const result = await executePilotControlAction({ restaurantId, action: "enable-gmail-delivery" }, ops);
  assert.deepEqual(ops.calls, ["system:gmail_delivery_enabled", "restaurant:gmail_delivery_enabled"]);
  assert.equal(result.state.gmail.restaurantEnabled, true);
});

test("restaurant kill switches close only the selected tenant and verify the result", async () => {
  const ops = operations(state({
    system: {
      singleton: true,
      operational_mode: "normal",
      square_sync_enabled: true,
      square_webhooks_enabled: true,
      gmail_delivery_enabled: true,
      order_drafting_enabled: true,
      ordering_policy: "draft_only"
    },
    restaurant: {
      restaurant_id: restaurantId,
      square_sync_enabled: true,
      square_webhooks_enabled: true,
      gmail_delivery_enabled: true,
      order_drafting_enabled: true,
      ordering_policy: "draft_only"
    }
  }));
  const result = await executePilotControlAction({ restaurantId, action: "disable-external" }, ops);
  assert.deepEqual(ops.calls, [
    "restaurant:gmail_delivery_enabled,order_drafting_enabled,ordering_policy,square_sync_enabled,square_webhooks_enabled"
  ]);
  assert.equal(result.state.square.restaurantSync, false);
  assert.equal(result.state.gmail.restaurantEnabled, false);
  assert.equal(result.state.drafting.restaurantEnabled, false);
  assert.equal(result.state.square.systemSync, true);
});

test("global integration pause uses the replay-evidenced service mode boundary", async () => {
  const ops = operations();
  const result = await executePilotControlAction({ restaurantId, action: "pause-integrations" }, ops);
  assert.deepEqual(ops.calls, ["mode:integrations_paused"]);
  assert.equal(result.state.operationalMode, "integrations_paused");
});

test("pilot control CLI is staging-pinned and never prints secret-bearing fields", () => {
  const source = readFileSync("scripts/pilot-restaurant-controls.mjs", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  assert.match(source, /assertStagingPreflight\(\)/);
  assert.match(source, /assertProvisioningEnvironment/);
  assert.match(source, /SUPABASE_STAGING_SECRET_KEY/);
  assert.match(source, /service_set_system_operational_mode/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^)]*(?:secretKey|accessToken|refreshToken)/);
  assert.match(packageJson, /"pilot:controls"/);
});
