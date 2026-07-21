import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertStagingPreflight } from "./staging-preflight.mjs";

const url = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const password = process.env.MISE_STAGING_SEED_PASSWORD;

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tenantC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tenantAInventoryId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const tenantBInventoryId = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";
const tenantCInventoryId = "cccccccc-1111-4111-8111-cccccccccccc";
const tenantCPosIntegrationId = "cccccccc-4444-4444-8444-cccccccccccc";
const tenantARecommendationId = "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa";
const tenantBRecommendationId = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const tenantAOrderId = "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa";
const tenantBOrderId = "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb";

const tenantScopedTables = [
  "pos_sales",
  "inventory_items",
  "menu_item_ingredients",
  "purchase_recommendations",
  "supplier_orders",
  "pos_integrations",
  "sales_imports",
  "insights",
  "supplier_items",
  "purchase_orders",
  "ai_insights",
  "restaurant_email_connections",
  "supplier_recipients",
  "setup_attachments"
];

if (!url || !anonKey || !password || !process.env.SUPABASE_STAGING_PROJECT_REF || !process.env.MISE_STAGING_MARKER) {
  console.error(
    "Set SUPABASE_STAGING_URL, SUPABASE_STAGING_ANON_KEY, and MISE_STAGING_SEED_PASSWORD before running staging tenant checks."
  );
  process.exit(1);
}

await assertStagingPreflight();

function anonymousClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function signedClient(email) {
  const client = anonymousClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  assert.ok(data.user, `${email} did not return an authenticated user`);
  return { client, user: data.user };
}

async function selectCount(client, table, restaurantId) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
  return count ?? 0;
}

async function assertTenantCount(client, table, restaurantId, expected, message) {
  assert.equal(await selectCount(client, table, restaurantId), expected, message);
}

function assertDenied(result, message) {
  assert.notEqual(result.error, null, message);
  assert.equal(result.data, null, `${message} returns no protected data`);
}

function assertDeniedOrEmpty(result, message) {
  if (result.error) {
    assert.equal(result.data, null, `${message} returns no protected data`);
    return;
  }
  assert.deepEqual(result.data ?? [], [], message);
}

async function invokeOperationalWorkflow(session, body) {
  return session.client.functions.invoke("operational-workflows", { body });
}

async function throwInvocationFailure(label, error) {
  let responseDetail = "";
  try {
    if (error?.context instanceof Response) {
      responseDetail = (await error.context.clone().text()).slice(0, 1000);
    }
  } catch {
    // The response body may already be consumed. The status and function label remain actionable.
  }
  const status = error?.context instanceof Response ? ` HTTP ${error.context.status}` : "";
  throw new Error(`${label} failed${status}: ${responseDetail || error?.message || "unknown Edge error"}`);
}

async function readInvocationHttpFailure(label, result) {
  assert.ok(result.error, `${label} must return a non-success Edge response`);
  assert.equal(result.data, null, `${label} must not return protected or placeholder data`);
  assert.ok(result.error.context instanceof Response, `${label} exposes its bounded HTTP failure response`);
  const response = result.error.context;
  let payload = null;
  try {
    payload = await response.clone().json();
  } catch {
    // The status remains authoritative if a hosted gateway consumed the body.
  }
  return { status: response.status, payload };
}

const anon = anonymousClient();
const ownerA = await signedClient("owner-a@mise-staging.test");
const adminA = await signedClient("admin-a@mise-staging.test");
const managerA = await signedClient("manager-a@mise-staging.test");
const staffA = await signedClient("staff-a@mise-staging.test");
const ownerB = await signedClient("owner-b@mise-staging.test");

const anonRead = await anon.from("inventory_items").select("id").eq("restaurant_id", tenantA);
assertDenied(anonRead, "unauthenticated users cannot read restaurant inventory");

for (const table of tenantScopedTables) {
  await assertTenantCount(managerA.client, table, tenantA, 1, `manager A can read tenant A ${table}`);
  await assertTenantCount(managerA.client, table, tenantB, 0, `manager A cannot read tenant B ${table}`);
  await assertTenantCount(ownerB.client, table, tenantB, 1, `owner B confirms tenant B ${table} fixture exists`);
}
await assertTenantCount(managerA.client, "inventory_items", tenantC, 0, "manager A cannot read unrelated tenant C inventory");
await assertTenantCount(ownerB.client, "inventory_items", tenantC, 1, "tenant C verification owner can read its fixture inventory");

await assertTenantCount(ownerA.client, "audit_logs", tenantA, 1, "owner A can read tenant A audit logs");
await assertTenantCount(ownerA.client, "audit_logs", tenantB, 0, "owner A cannot read tenant B audit logs");
const managerAuditRead = await managerA.client.from("audit_logs").select("id").eq("restaurant_id", tenantA);
assert.equal(managerAuditRead.error, null, "manager audit read is contained by RLS");
assert.equal(managerAuditRead.data?.length ?? 0, 0, "manager cannot read audit logs");

const crossTenantMutationProbes = [
  {
    table: "pos_sales",
    fixtureId: "bbbbbbbb-1212-4121-8121-bbbbbbbbbbbb",
    insertId: "dddddddd-1001-4001-8001-dddddddddddd",
    row: {
      id: "dddddddd-1001-4001-8001-dddddddddddd",
      restaurant_id: tenantC,
      source_record_id: "staging-cross-tenant-probe",
      sale_date: new Date().toISOString().slice(0, 10),
      item_name: "Forged pastry",
      category: "Entree",
      quantity_sold: 1,
      gross_sales: 10,
      net_sales: 9,
      source_pos: "Staging probe"
    }
  },
  {
    table: "inventory_items",
    fixtureId: tenantBInventoryId,
    insertId: "dddddddd-1002-4002-8002-dddddddddddd",
    row: {
      id: "dddddddd-1002-4002-8002-dddddddddddd",
      restaurant_id: tenantC,
      item_name: "Forged inventory",
      category: "Dry goods",
      unit: "lb",
      current_quantity: 1,
      par_level: 2,
      reorder_threshold: 1,
      estimated_unit_cost: 1,
      supplier_name: "Probe supplier"
    }
  },
  {
    table: "menu_item_ingredients",
    fixtureId: "bbbbbbbb-1313-4131-8131-bbbbbbbbbbbb",
    insertId: "dddddddd-1003-4003-8003-dddddddddddd",
    row: {
      id: "dddddddd-1003-4003-8003-dddddddddddd",
      restaurant_id: tenantC,
      menu_item_name: "Forged recipe",
      inventory_item_id: tenantCInventoryId,
      quantity_used_per_sale: 0.1,
      unit: "lb"
    }
  },
  {
    table: "purchase_recommendations",
    fixtureId: tenantBRecommendationId,
    insertId: "dddddddd-1004-4004-8004-dddddddddddd",
    row: {
      id: "dddddddd-1004-4004-8004-dddddddddddd",
      restaurant_id: tenantC,
      inventory_item_id: tenantCInventoryId,
      item_name: "Forged recommendation",
      supplier_name: "Probe supplier",
      recommended_quantity: 1,
      unit: "lb",
      reason: "Cross-tenant probe",
      urgency: "low",
      status: "dismissed"
    }
  },
  {
    table: "supplier_orders",
    fixtureId: tenantBOrderId,
    insertId: "dddddddd-1005-4005-8005-dddddddddddd",
    row: {
      id: "dddddddd-1005-4005-8005-dddddddddddd",
      restaurant_id: tenantC,
      supplier_name: "Probe supplier",
      order_message: "Cross-tenant order probe",
      status: "draft"
    }
  },
  {
    table: "insights",
    fixtureId: "bbbbbbbb-6161-4616-8616-bbbbbbbbbbbb",
    insertId: "dddddddd-1006-4006-8006-dddddddddddd",
    row: {
      id: "dddddddd-1006-4006-8006-dddddddddddd",
      restaurant_id: tenantC,
      insight_type: "inventory",
      title: "Forged insight",
      description: "Cross-tenant probe.",
      recommended_action: "Reject this probe.",
      severity: "info"
    }
  },
  {
    table: "pos_integrations",
    fixtureId: "bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb",
    insertId: "dddddddd-1007-4007-8007-dddddddddddd",
    row: {
      id: "dddddddd-1007-4007-8007-dddddddddddd",
      restaurant_id: tenantC,
      provider: "manual_csv",
      status: "connected",
      settings: { source: "staging_cross_tenant_probe" }
    }
  },
  {
    table: "sales_imports",
    fixtureId: "bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb",
    insertId: "dddddddd-1008-4008-8008-dddddddddddd",
    row: {
      id: "dddddddd-1008-4008-8008-dddddddddddd",
      restaurant_id: tenantC,
      pos_integration_id: tenantCPosIntegrationId,
      import_type: "pos_sync",
      status: "completed",
      records_processed: 1,
      metadata: { source: "staging_cross_tenant_probe" }
    }
  },
  {
    table: "supplier_items",
    fixtureId: "bbbbbbbb-1515-4515-8515-bbbbbbbbbbbb",
    insertId: "dddddddd-1009-4009-8009-dddddddddddd",
    row: {
      id: "dddddddd-1009-4009-8009-dddddddddddd",
      restaurant_id: tenantC,
      supplier_name: "Probe supplier",
      item_name: "Forged supplier item",
      unit: "lb",
      estimated_unit_cost: 1
    }
  },
  {
    table: "purchase_orders",
    fixtureId: "bbbbbbbb-1616-4616-8616-bbbbbbbbbbbb",
    insertId: "dddddddd-1010-4010-8010-dddddddddddd",
    row: {
      id: "dddddddd-1010-4010-8010-dddddddddddd",
      restaurant_id: tenantC,
      supplier_name: "Probe supplier",
      status: "draft",
      order_payload: { items: [] },
      subtotal_estimate: 0
    }
  },
  {
    table: "ai_insights",
    fixtureId: "bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb",
    insertId: "dddddddd-1011-4011-8011-dddddddddddd",
    row: {
      id: "dddddddd-1011-4011-8011-dddddddddddd",
      restaurant_id: tenantC,
      output: {
        title: "Forged insight",
        summary: "Cross-tenant probe.",
        recommended_action: "Reject this probe.",
        risk_level: "low",
        confidence: 0.6,
        affected_workflow: "inventory",
        evidence: ["Staging probe fixture."]
      },
      risk_level: "low",
      confidence: 0.6,
      status: "generated",
      generated_by: "staging_seed"
    }
  },
  {
    table: "audit_logs",
    fixtureId: "bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb",
    insertId: "dddddddd-1012-4012-8012-dddddddddddd",
    row: {
      id: "dddddddd-1012-4012-8012-dddddddddddd",
      restaurant_id: tenantC,
      actor_user_id: managerA.user.id,
      action: "cross_tenant_probe",
      entity_table: "inventory_items",
      entity_id: tenantCInventoryId
    }
  },
  {
    table: "restaurant_email_connections",
    fixtureId: "bbbbbbbb-8888-4888-8888-bbbbbbbbbbbb",
    insertId: "dddddddd-1013-4013-8013-dddddddddddd",
    row: {
      id: "dddddddd-1013-4013-8013-dddddddddddd",
      restaurant_id: tenantC,
      provider: "gmail",
      status: "not_connected",
      sender_email: null
    }
  },
  {
    table: "supplier_recipients",
    fixtureId: "bbbbbbbb-9999-4999-8999-bbbbbbbbbbbb",
    insertId: "dddddddd-1014-4014-8014-dddddddddddd",
    row: {
      id: "dddddddd-1014-4014-8014-dddddddddddd",
      restaurant_id: tenantC,
      supplier_name: "Probe supplier",
      email: "probe@tenant-c.test"
    }
  },
  {
    table: "setup_attachments",
    fixtureId: "bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbb01",
    insertId: "dddddddd-1015-4015-8015-dddddddddddd",
    row: {
      id: "dddddddd-1015-4015-8015-dddddddddddd",
      restaurant_id: tenantC,
      kind: "csv",
      label: "Cross-tenant probe",
      status: "queued",
      metadata: { storage_status: "metadata_only" },
      created_by: managerA.user.id
    }
  }
];

for (const probe of crossTenantMutationProbes) {
  const insertResult = await managerA.client.from(probe.table).insert(probe.row).select("id");
  assertDenied(insertResult, `manager A cannot INSERT into unrelated tenant C ${probe.table}`);
  await assertTenantCount(
    ownerB.client,
    probe.table,
    tenantC,
    probe.table === "inventory_items" || probe.table === "pos_integrations" ? 1 : 0,
    `denied ${probe.table} insert leaves tenant C unchanged`
  );

  const updateResult = await managerA.client
    .from(probe.table)
    .update({ restaurant_id: tenantB })
    .eq("id", probe.fixtureId)
    .select("id");
  assertDeniedOrEmpty(updateResult, `manager A cannot UPDATE tenant B ${probe.table}`);

  const deleteResult = await managerA.client
    .from(probe.table)
    .delete()
    .eq("id", probe.fixtureId)
    .select("id");
  assertDeniedOrEmpty(deleteResult, `manager A cannot DELETE tenant B ${probe.table}`);

  const fixtureAfter = await ownerB.client.from(probe.table).select("id").eq("id", probe.fixtureId).single();
  if (fixtureAfter.error) throw fixtureAfter.error;
  assert.equal(fixtureAfter.data.id, probe.fixtureId, `tenant B ${probe.table} fixture remains unchanged`);
}

const directInventoryUpdate = await managerA.client
  .from("inventory_items")
  .update({ current_quantity: 41 })
  .eq("restaurant_id", tenantA)
  .eq("id", tenantAInventoryId)
  .select("current_quantity");
assertDenied(directInventoryUpdate, "manager inventory writes are RPC-only");

const staffInventoryUpdate = await staffA.client
  .from("inventory_items")
  .update({ current_quantity: 40 })
  .eq("restaurant_id", tenantA)
  .eq("id", tenantAInventoryId)
  .select("current_quantity");
assertDenied(staffInventoryUpdate, "staff cannot update inventory rows");

const directRecommendationUpdate = await managerA.client
  .from("purchase_recommendations")
  .update({ status: "approved" })
  .eq("restaurant_id", tenantA)
  .eq("id", tenantARecommendationId)
  .select("status");
assertDenied(directRecommendationUpdate, "manager recommendation transitions are RPC-only");

const directOrderUpdate = await managerA.client
  .from("supplier_orders")
  .update({ status: "sent" })
  .eq("restaurant_id", tenantA)
  .eq("id", tenantAOrderId)
  .select("status");
assertDenied(directOrderUpdate, "manager supplier-order transitions are RPC-only");

const directRecipientUpdate = await managerA.client
  .from("supplier_recipients")
  .update({ email: "orders@fresh-tenant-a.test" })
  .eq("restaurant_id", tenantA)
  .select("email");
assertDenied(directRecipientUpdate, "setup supplier writes are RPC-only");

for (const invalidQuantity of [-1, 0, 1_000_001]) {
  const rejected = await managerA.client.rpc("approve_purchase_recommendation", {
    p_restaurant_id: tenantA,
    p_recommendation_id: tenantARecommendationId,
    p_recommended_quantity: invalidQuantity
  });
  assertDenied(rejected, `approval quantity ${invalidQuantity} is rejected server-side`);
}

const pendingAfterInvalid = await managerA.client
  .from("purchase_recommendations")
  .select("status")
  .eq("id", tenantARecommendationId)
  .single();
if (pendingAfterInvalid.error) throw pendingAfterInvalid.error;
assert.equal(pendingAfterInvalid.data.status, "pending", "invalid approval quantities do not mutate workflow state");

const approved = await managerA.client.rpc("approve_purchase_recommendation", {
  p_restaurant_id: tenantA,
  p_recommendation_id: tenantARecommendationId,
  p_recommended_quantity: 12
});
if (approved.error) throw approved.error;
assert.equal(approved.data.recommendation.status, "approved", "guarded approval workflow succeeds");
assert.equal(approved.data.order.id, tenantAOrderId, "approval attaches to the existing tenant draft");

const sentWithoutProviderAcceptance = await managerA.client.rpc("mark_supplier_order_sent", {
  p_restaurant_id: tenantA,
  p_order_id: tenantAOrderId
});
assertDenied(
  sentWithoutProviderAcceptance,
  "supplier order cannot become sent without persisted provider acceptance"
);

const repeatedSentWithoutProviderAcceptance = await managerA.client.rpc("mark_supplier_order_sent", {
  p_restaurant_id: tenantA,
  p_order_id: tenantAOrderId
});
assertDenied(
  repeatedSentWithoutProviderAcceptance,
  "replaying an unaccepted supplier send cannot bypass provider evidence"
);

const orderAfterRejectedSend = await managerA.client
  .from("supplier_orders")
  .select("status,provider_message_id,sent_at")
  .eq("restaurant_id", tenantA)
  .eq("id", tenantAOrderId)
  .single();
if (orderAfterRejectedSend.error) throw orderAfterRejectedSend.error;
assert.deepEqual(
  orderAfterRejectedSend.data,
  { status: "draft", provider_message_id: null, sent_at: null },
  "rejected mark-sent attempts leave the supplier draft unchanged"
);

const inventoryBefore = await managerA.client
  .from("inventory_items")
  .select("current_quantity,last_updated")
  .eq("id", tenantAInventoryId)
  .single();
if (inventoryBefore.error) throw inventoryBefore.error;

const obsoleteInventoryRpc = await managerA.client.rpc("update_inventory_item_and_signals", {
  p_restaurant_id: tenantA,
  p_inventory_item_id: tenantAInventoryId,
  p_expected_last_updated: inventoryBefore.data.last_updated,
  p_patch: { current_quantity: 23 },
  p_recommendations: [],
  p_insights: [
    {
      insight_type: "invalid",
      title: "Invalid signal",
      description: "Must roll back.",
      recommended_action: "Do nothing.",
      severity: "warning"
    }
  ]
});
assertDenied(obsoleteInventoryRpc, "authenticated clients cannot call the obsolete payload-authority inventory RPC");

const inventoryAfterRollback = await managerA.client
  .from("inventory_items")
  .select("current_quantity,last_updated")
  .eq("id", tenantAInventoryId)
  .single();
if (inventoryAfterRollback.error) throw inventoryAfterRollback.error;
assert.equal(
  Number(inventoryAfterRollback.data.current_quantity),
  Number(inventoryBefore.data.current_quantity),
  "failed signal regeneration preserves the inventory count"
);
assert.equal(
  inventoryAfterRollback.data.last_updated,
  inventoryBefore.data.last_updated,
  "failed signal regeneration preserves the optimistic version"
);

const validInventoryUpdate = await invokeOperationalWorkflow(managerA, {
  action: "update_inventory",
  restaurantId: tenantA,
  itemId: tenantAInventoryId,
  patch: { current_quantity: 4 }
});
if (validInventoryUpdate.error) await throwInvocationFailure("valid inventory workflow", validInventoryUpdate.error);
assert.equal(Number(validInventoryUpdate.data.result.current_quantity), 4, "server workflow persists a valid inventory count");

const staleInventoryUpdate = await managerA.client.rpc("update_inventory_item_and_signals", {
  p_restaurant_id: tenantA,
  p_inventory_item_id: tenantAInventoryId,
  p_expected_last_updated: inventoryBefore.data.last_updated,
  p_patch: { current_quantity: 22 },
  p_recommendations: [],
  p_insights: []
});
assertDenied(staleInventoryUpdate, "stale clients cannot fall back to the obsolete inventory RPC");

const crossTenantRpc = await invokeOperationalWorkflow(managerA, {
  action: "update_inventory",
  restaurantId: tenantB,
  itemId: tenantBInventoryId,
  patch: { current_quantity: 1 }
});
assert.notEqual(crossTenantRpc.error, null, "manager A cannot invoke a tenant B inventory workflow");

const staffRpc = await invokeOperationalWorkflow(staffA, {
  action: "refresh_signals",
  restaurantId: tenantA
});
assert.notEqual(staffRpc.error, null, "staff cannot replace manager-owned operational signals");

const auditForge = await managerA.client.from("audit_logs").insert({
  restaurant_id: tenantA,
  actor_user_id: ownerA.user.id,
  action: "forged_actor_check",
  entity_table: "inventory_items",
  entity_id: tenantAInventoryId
});
assertDenied(auditForge, "client audit insert rejects forged actor_user_id");

const workflowAudit = await ownerA.client
  .from("audit_logs")
  .select("actor_user_id,action")
  .eq("restaurant_id", tenantA)
  .eq("action", "recommendation_approved")
  .single();
if (workflowAudit.error) throw workflowAudit.error;
assert.equal(workflowAudit.data.actor_user_id, managerA.user.id, "workflow audit actor is derived from auth.uid()");

const directOwnerProfileUpdate = await ownerA.client
  .from("restaurants")
  .update({ cuisine_type: "Direct profile bypass" })
  .eq("id", tenantA)
  .select("id,cuisine_type");
assertDenied(directOwnerProfileUpdate, "owner profile writes are guarded RPC-only");

const ownerProfileUpdate = await ownerA.client.rpc("update_restaurant_profile", {
  p_restaurant_id: tenantA,
  p_patch: { cuisine_type: "Fast casual Mediterranean - staging verified" }
});
if (ownerProfileUpdate.error) throw ownerProfileUpdate.error;
assert.match(ownerProfileUpdate.data.cuisine_type, /staging verified/, "owner A can update tenant A restaurant profile");

const crossTenantProfileUpdate = await ownerA.client.rpc("update_restaurant_profile", {
  p_restaurant_id: tenantB,
  p_patch: { cuisine_type: "Cross tenant bypass" }
});
assertDenied(crossTenantProfileUpdate, "owner A cannot update tenant B restaurant profile");

const forgedAiInsert = await managerA.client.from("ai_insights").insert({
  restaurant_id: tenantA,
  source: "openai_structured_output",
  output: {
    title: "Forged model output",
    summary: "Client-authored provenance must fail.",
    recommended_action: "Reject this row.",
    risk_level: "high",
    confidence: 1,
    affected_workflow: "inventory",
    evidence: ["Client payload"]
  },
  risk_level: "high",
  confidence: 1,
  generated_by: "openai"
}).select("id");
assertDenied(forgedAiInsert, "authenticated manager cannot forge OpenAI provenance");

const directAiServiceRpc = await managerA.client.rpc("service_create_rules_engine_ai_insight", {
  p_actor_user_id: managerA.user.id,
  p_restaurant_id: tenantA,
  p_output: {
    title: "Direct service call",
    summary: "Authenticated invocation must fail.",
    recommended_action: "Reject this call.",
    risk_level: "low",
    confidence: 0.1,
    affected_workflow: "inventory",
    evidence: []
  }
});
assertDenied(directAiServiceRpc, "authenticated clients cannot call the service-only AI persistence RPC");

const aiInsightCountBefore = await selectCount(managerA.client, "ai_insights", tenantA);
const aiGenerationAttempt = await managerA.client.functions.invoke("generate-ai-insights", {
  body: { restaurantId: tenantA }
});
const aiUnavailable = await readInvocationHttpFailure("disabled AI insight workflow", aiGenerationAttempt);
assert.ok([501, 503].includes(aiUnavailable.status), "disabled AI insight workflow fails closed with a server status");
assert.ok(
  ["provider_not_enabled", "server_configuration_required"].includes(aiUnavailable.payload?.status),
  "disabled AI insight workflow returns a bounded unavailable status"
);
assert.equal(
  await selectCount(managerA.client, "ai_insights", tenantA),
  aiInsightCountBefore,
  "disabled AI insight workflow creates no placeholder insight"
);

const directOwnerMembershipUpdate = await ownerA.client
  .from("restaurant_memberships")
  .update({ status: "disabled" })
  .eq("restaurant_id", tenantA)
  .eq("user_id", staffA.user.id)
  .select("status");
assertDenied(directOwnerMembershipUpdate, "owner membership writes are guarded RPC-only");

const selfMembershipUpdate = await ownerA.client.rpc("update_restaurant_member", {
  p_restaurant_id: tenantA,
  p_target_user_id: ownerA.user.id,
  p_role: "staff",
  p_status: null
});
assertDenied(selfMembershipUpdate, "owner cannot demote their own membership");

const managerMembershipUpdate = await managerA.client
  .from("restaurant_memberships")
  .update({ status: "disabled" })
  .eq("restaurant_id", tenantA)
  .eq("user_id", staffA.user.id)
  .select("status");
assertDenied(managerMembershipUpdate, "manager cannot manage memberships directly");

const adminDisableStaff = await adminA.client.rpc("update_restaurant_member", {
  p_restaurant_id: tenantA,
  p_target_user_id: staffA.user.id,
  p_role: null,
  p_status: "disabled"
});
if (adminDisableStaff.error) throw adminDisableStaff.error;
assert.equal(adminDisableStaff.data.status, "disabled", "admin can disable staff through the guarded RPC");

await assertTenantCount(staffA.client, "inventory_items", tenantA, 0, "disabled staff token immediately loses tenant Data API access");
const disabledStaffEdge = await invokeOperationalWorkflow(staffA, {
  action: "refresh_signals",
  restaurantId: tenantA
});
assert.notEqual(disabledStaffEdge.error, null, "disabled staff token immediately loses tenant Edge access");

const ownerReactivateStaff = await ownerA.client.rpc("update_restaurant_member", {
  p_restaurant_id: tenantA,
  p_target_user_id: staffA.user.id,
  p_role: null,
  p_status: "active"
});
if (ownerReactivateStaff.error) throw ownerReactivateStaff.error;
assert.equal(ownerReactivateStaff.data.status, "active", "owner can reactivate non-owner staff through the guarded RPC");

const concurrentResults = await Promise.all(
  [0, 1].map(() => invokeOperationalWorkflow(managerA, {
    action: "refresh_signals",
    restaurantId: tenantA
  }))
);
for (const result of concurrentResults) {
  if (result.error) await throwInvocationFailure("concurrent signal refresh", result.error);
}

const finalRecommendation = await managerA.client
  .from("purchase_recommendations")
  .select("recommended_quantity,reason,generation_source,planning_revision")
  .eq("restaurant_id", tenantA)
  .eq("status", "pending")
  .single();
if (finalRecommendation.error) throw finalRecommendation.error;
const finalInsight = await managerA.client
  .from("insights")
  .select("title,generation_source,planning_revision")
  .eq("restaurant_id", tenantA)
  .single();
if (finalInsight.error) throw finalInsight.error;
assert.equal(finalRecommendation.data.generation_source, "mise_rules", "recommendations are server-generated");
assert.equal(finalInsight.data.generation_source, "mise_rules", "insights are server-generated");
assert.equal(
  Number(finalRecommendation.data.planning_revision),
  Number(finalInsight.data.planning_revision),
  "recommendations and insights commit from one planning revision"
);

const failedSignalReplacement = await managerA.client.rpc("replace_operational_signals", {
  p_restaurant_id: tenantA,
  p_recommendations: [
    {
      inventory_item_id: tenantAInventoryId,
      recommended_quantity: 99,
      reason: "Must not partially persist",
      urgency: "high"
    }
  ],
  p_insights: [
    {
      insight_type: "invalid",
      title: "Invalid replacement",
      description: "Must roll back.",
      recommended_action: "Do nothing.",
      severity: "warning"
    }
  ]
});
assertDenied(failedSignalReplacement, "authenticated clients cannot inject replacement signal payloads");
const recommendationAfterFailure = await managerA.client
  .from("purchase_recommendations")
  .select("recommended_quantity,reason")
  .eq("restaurant_id", tenantA)
  .eq("status", "pending")
  .single();
if (recommendationAfterFailure.error) throw recommendationAfterFailure.error;
assert.equal(
  recommendationAfterFailure.data.reason,
  finalRecommendation.data.reason,
  "denied replacement preserves server-generated recommendations"
);

const tenantBInventory = await ownerB.client
  .from("inventory_items")
  .select("current_quantity")
  .eq("restaurant_id", tenantB)
  .eq("id", tenantBInventoryId)
  .single();
if (tenantBInventory.error) throw tenantBInventory.error;
assert.equal(Number(tenantBInventory.data.current_quantity), 10, "tenant B inventory was not mutated");

const tenantBRecommendation = await ownerB.client
  .from("purchase_recommendations")
  .select("status")
  .eq("restaurant_id", tenantB)
  .eq("id", tenantBRecommendationId)
  .single();
if (tenantBRecommendation.error) throw tenantBRecommendation.error;
assert.equal(tenantBRecommendation.data.status, "pending", "tenant B recommendation was not mutated");

const tenantBOrder = await ownerB.client
  .from("supplier_orders")
  .select("status")
  .eq("restaurant_id", tenantB)
  .eq("id", tenantBOrderId)
  .single();
if (tenantBOrder.error) throw tenantBOrder.error;
assert.equal(tenantBOrder.data.status, "draft", "tenant B order was not mutated");

console.log("Mise hosted tenant, workflow-authority, bounds, and atomicity checks passed.");
