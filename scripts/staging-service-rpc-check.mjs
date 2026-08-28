import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertStagingPreflight } from "./staging-preflight.mjs";

const url = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const secretKey = process.env.SUPABASE_STAGING_SECRET_KEY;

if (
  !url ||
  !anonKey ||
  !secretKey ||
  !process.env.SUPABASE_STAGING_PROJECT_REF ||
  !process.env.MISE_STAGING_MARKER
) {
  console.error(
    "Set the staging URL, project ref, anon/secret keys, and identity marker before running service-RPC checks."
  );
  process.exit(1);
}

await assertStagingPreflight();
assert.notEqual(secretKey, anonKey, "service-RPC verification requires a server-only staging secret");

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tenantBInventoryId = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";

const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersResult.error) throw usersResult.error;
const managerA = usersResult.data.users.find((user) => user.email === "manager-a@mise-staging.test");
assert.ok(managerA, "manager A staging fixture is required for actor-bound service-RPC checks");

async function assertDeniedRpc(functionName, parameters, message, expectedCode = "42501") {
  const result = await admin.rpc(functionName, parameters);
  assert.notEqual(result.error, null, message);
  assert.equal(result.error.code, expectedCode, `${message}: expected PostgreSQL code ${expectedCode}`);
}

const forgedReservation = await admin.rpc("reserve_edge_function_invocation", {
  target_restaurant_id: tenantB,
  p_actor_user_id: managerA.id,
  p_function_name: "operational-workflows",
  action_name: "staging_cross_tenant_probe",
  metadata: { source: "staging_service_rpc_check" }
});
if (forgedReservation.error) throw forgedReservation.error;
assert.equal(forgedReservation.data.allowed, false, "service reservation rejects a forged actor/tenant binding");
assert.equal(forgedReservation.data.reason, "forbidden", "forged reservation uses the bounded forbidden result");

const validReservation = await admin.rpc("reserve_edge_function_invocation", {
  target_restaurant_id: tenantA,
  p_actor_user_id: managerA.id,
  p_function_name: "operational-workflows",
  action_name: "staging_service_rpc_probe",
  metadata: { source: "staging_service_rpc_check" }
});
if (validReservation.error) throw validReservation.error;
assert.equal(validReservation.data.allowed, true, "same-tenant service reservation remains available");
assert.equal(typeof validReservation.data.reservation_id, "string", "accepted reservation returns an ID");

await assertDeniedRpc(
  "record_edge_function_security_event",
  {
    target_restaurant_id: tenantB,
    p_actor_user_id: managerA.id,
    p_reservation_id: validReservation.data.reservation_id,
    p_function_name: "operational-workflows",
    p_event_type: "error",
    action_name: "staging_cross_tenant_probe",
    metadata: { source: "staging_service_rpc_check" }
  },
  "terminal event persistence rejects a forged reservation tenant",
  "22023"
);

await assertDeniedRpc(
  "service_fetch_operational_planning_snapshot",
  { p_actor_user_id: managerA.id, p_restaurant_id: tenantB },
  "planning snapshot rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_mark_operational_signals_pending",
  { p_actor_user_id: managerA.id, p_restaurant_id: tenantB },
  "signal-pending transition rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_commit_operational_signals",
  {
    p_actor_user_id: managerA.id,
    p_restaurant_id: tenantB,
    p_expected_revision: 0,
    p_recommendations: [],
    p_insights: [],
    p_complete_setup: false,
    p_setup_metadata: {}
  },
  "signal commit rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_update_inventory_and_signals",
  {
    p_actor_user_id: managerA.id,
    p_restaurant_id: tenantB,
    p_inventory_item_id: tenantBInventoryId,
    p_expected_revision: 0,
    p_patch: { par_level: 1 },
    p_recommendations: [],
    p_insights: []
  },
  "inventory workflow rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_create_inventory_item_and_signals",
  {
    p_actor_user_id: managerA.id,
    p_restaurant_id: tenantB,
    p_inventory_item_id: "99999999-9999-4999-8999-999999999999",
    p_expected_revision: 0,
    p_item: {
      item_name: "Forged item",
      category: "Produce",
      unit: "lb",
      current_quantity: 1,
      par_level: 2,
      reorder_threshold: 1,
      estimated_unit_cost: 1,
      supplier_id: "88888888-8888-4888-8888-888888888888"
    },
    p_recommendations: [],
    p_insights: []
  },
  "inventory create rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_save_recipe_and_signals",
  {
    p_actor_user_id: managerA.id,
    p_restaurant_id: tenantB,
    p_mapping_id: null,
    p_menu_item_name: "Forged recipe",
    p_inventory_item_id: tenantBInventoryId,
    p_quantity_used_per_sale: 1,
    p_unit: "lb",
    p_expected_revision: 0,
    p_recommendations: [],
    p_insights: []
  },
  "recipe workflow rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_begin_inventory_count_session",
  {
    p_actor_user_id: managerA.id,
    p_restaurant_id: tenantB,
    p_note: null
  },
  "count session begin rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_approve_inventory_count_session",
  {
    p_actor_user_id: managerA.id,
    p_restaurant_id: tenantB,
    p_session_id: "00000000-0000-4000-8000-000000009999",
    p_expected_revision: 0,
    p_recommendations: [],
    p_insights: []
  },
  "count session approve rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_create_rules_engine_ai_insight",
  {
    p_actor_user_id: managerA.id,
    p_restaurant_id: tenantB,
    p_output: {
      title: "Forged tenant insight",
      summary: "This service payload must be rejected.",
      recommended_action: "Reject the forged tenant binding.",
      risk_level: "low",
      confidence: 0.1,
      affected_workflow: "inventory",
      evidence: ["Staging cross-tenant probe."]
    }
  },
  "AI persistence rejects a forged actor/tenant binding"
);
await assertDeniedRpc(
  "service_record_edge_audit_log",
  {
    p_actor_user_id: managerA.id,
    p_restaurant_id: tenantB,
    p_action: "staging_cross_tenant_probe",
    p_entity_table: "inventory_items",
    p_entity_id: tenantBInventoryId,
    p_metadata: { source: "staging_service_rpc_check" }
  },
  "service audit persistence rejects a forged actor/tenant binding"
);

const closeReservation = await admin.rpc("record_edge_function_security_event", {
  target_restaurant_id: tenantA,
  p_actor_user_id: managerA.id,
  p_reservation_id: validReservation.data.reservation_id,
  p_function_name: "operational-workflows",
  p_event_type: "completed",
  action_name: "staging_service_rpc_probe_completed",
  metadata: { source: "staging_service_rpc_check" }
});
if (closeReservation.error) throw closeReservation.error;
assert.equal(closeReservation.data, true, "same-tenant reservation closes with exactly one terminal event");

console.log("Mise hosted service-RPC actor and tenant binding checks passed.");
