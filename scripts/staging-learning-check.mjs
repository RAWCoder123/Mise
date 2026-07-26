import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertStagingPreflight } from "./staging-preflight.mjs";

// Hosted-staging proof of the deterministic learning loop on a fresh tenant:
// seeded sales/inventory/recipes -> refresh_signals generates recommendations
// and insights -> three adjusted approvals -> the next generated
// recommendation adopts the approved median (operationalSignals.ts
// learnedQuantities/boundedLearnedQuantity, >= 3 approved samples in 180 days).

const url = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const secretKey = process.env.SUPABASE_STAGING_SECRET_KEY;
const password = process.env.MISE_STAGING_SEED_PASSWORD;
const marker = process.env.MISE_STAGING_MARKER;

const requiredEnvironment = [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_ANON_KEY",
  "SUPABASE_STAGING_SECRET_KEY",
  "SUPABASE_STAGING_PROJECT_REF",
  "MISE_STAGING_MARKER",
  "MISE_STAGING_SEED_PASSWORD"
];
const missing = requiredEnvironment.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Staging learning-loop verification requires local secret-backed environment values: ${missing.join(", ")}.`);
  console.error("Load them from the trusted staging secret store; do not paste them into chat or commit them.");
  process.exit(1);
}

await assertStagingPreflight();
if (secretKey === anonKey) {
  console.error("Staging learning-loop verification requires a server-only staging secret distinct from the public anon key.");
  process.exit(1);
}

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const runId = randomUUID().slice(0, 8);
const ownerEmail = `learning-check-owner-${runId}@mise-staging.test`;
const tenantName = `Learning Check ${runId} ${marker}`.slice(0, 120).trim();
const supplierName = "Fresh Produce Co.";
const timezone = "America/New_York";

// Deterministic fixture math (mirrors calculateOperationalSignals):
// projected = current_quantity (no sales on the operating date), so the
// baseline recommendation is ceil(par - current) = 30 lb. The adjusted
// approval quantity of 40 stays inside the learned-median acceptance window
// [max(1, 30 * 0.5), max(30 * 1.75, par 40 * 1.25)] = [15, 52.5].
const chicken = {
  item_name: "Chicken Breast",
  category: "Protein",
  unit: "lb",
  current_quantity: 10,
  par_level: 40,
  reorder_threshold: 15,
  estimated_unit_cost: 4.25,
  supplier_name: supplierName
};
const tomatoes = {
  item_name: "Roma Tomatoes",
  category: "Produce",
  unit: "lb",
  current_quantity: 30,
  par_level: 30,
  reorder_threshold: 8,
  estimated_unit_cost: 2.1,
  supplier_name: supplierName
};
const expectedBaselineQuantity = Math.max(1, Math.ceil(chicken.par_level - chicken.current_quantity));
const chickenBowlDaily = [12, 14, 11, 13, 12, 15, 10, 13, 12, 14, 11, 12, 13, 12];
const tomatoSaladDaily = [7, 8, 6, 7, 9, 6, 8, 7, 6, 8, 7, 9, 6, 7];

function operatingDayString(daysAgo) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000));
}

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function throwInvocationFailure(label, error) {
  let responseDetail = "";
  try {
    if (error?.context instanceof Response) {
      responseDetail = (await error.context.clone().text()).slice(0, 1000);
    }
  } catch {
    // The response body may already be consumed. The status and label remain actionable.
  }
  const status = error?.context instanceof Response ? ` HTTP ${error.context.status}` : "";
  throw new Error(`${label} failed${status}: ${responseDetail || error?.message || "unknown Edge error"}`);
}

async function invokeOperationalWorkflow(client, label, body) {
  const result = await client.functions.invoke("operational-workflows", { body });
  if (result.error) await throwInvocationFailure(label, result.error);
  assert.equal(result.data?.status, "completed", `${label} reports a completed workflow`);
  return result.data;
}

async function adminInsert(table, rows) {
  const { error } = await admin.from(table).insert(rows);
  if (error) throw new Error(`${table} seed insert: ${error.message}`);
}

async function fetchPendingRecommendations(client, restaurantId, inventoryItemId) {
  const { data, error } = await client
    .from("purchase_recommendations")
    .select("id,recommended_quantity,unit,status,generation_source,reason")
    .eq("restaurant_id", restaurantId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("status", "pending");
  if (error) throw error;
  return data ?? [];
}

const state = { ownerUserId: null, restaurantId: null };
const proven = [];
let ownerClient = null;

try {
  // 1. Fresh disposable owner + tenant through the real client provisioning RPC.
  const createdUser = await admin.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
    app_metadata: { provider: "email", providers: ["email"], mise_staging_fixture: true, mise_staging_learning_check: runId }
  });
  if (createdUser.error) throw createdUser.error;
  assert.ok(createdUser.data.user, `Auth Admin API did not return ${ownerEmail}`);
  state.ownerUserId = createdUser.data.user.id;

  ownerClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const signIn = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password });
  if (signIn.error) throw signIn.error;
  assert.equal(signIn.data.user?.id, state.ownerUserId, "owner sign-in returns the seeded auth user");

  const createdRestaurant = await ownerClient.rpc("create_restaurant_with_owner", {
    restaurant_name: tenantName,
    restaurant_cuisine_type: "Staging learning-loop fixture"
  });
  if (createdRestaurant.error) throw createdRestaurant.error;
  state.restaurantId = createdRestaurant.data.id;
  assert.ok(state.restaurantId, "create_restaurant_with_owner returns the new tenant id");

  // Timezone pins the operating date used by the planning snapshot so the
  // seeded sale dates stay strictly in the past. Profile fields are set with
  // the service key exactly like staging-seed provisions fixture tenants.
  const profileUpdate = await admin
    .from("restaurants")
    .update({
      timezone,
      currency: "USD",
      service_style: "fast_casual",
      operational_profile: { notes: `Disposable staging learning-loop tenant ${runId}. Marker: ${marker}` }
    })
    .eq("id", state.restaurantId);
  if (profileUpdate.error) throw new Error(`restaurant profile seed: ${profileUpdate.error.message}`);
  proven.push(`Provisioned disposable tenant "${tenantName}" (${state.restaurantId}) with owner ${ownerEmail}.`);

  // 2. Inventory, recipes, and 14 prior days of POS sales. historicalDailyDemand
  // needs >= 7 distinct prior sale days and >= 3 days per menu item.
  const chickenId = randomUUID();
  const tomatoId = randomUUID();
  await adminInsert("inventory_items", [
    { id: chickenId, restaurant_id: state.restaurantId, ...chicken },
    { id: tomatoId, restaurant_id: state.restaurantId, ...tomatoes }
  ]);
  await adminInsert("menu_item_ingredients", [
    {
      restaurant_id: state.restaurantId,
      menu_item_name: "Chicken Bowl",
      inventory_item_id: chickenId,
      quantity_used_per_sale: 0.5,
      unit: "lb"
    },
    {
      restaurant_id: state.restaurantId,
      menu_item_name: "Tomato Salad",
      inventory_item_id: tomatoId,
      quantity_used_per_sale: 0.3,
      unit: "lb"
    }
  ]);
  const salesRows = [];
  for (let daysAgo = 1; daysAgo <= 14; daysAgo += 1) {
    const saleDate = operatingDayString(daysAgo);
    const bowls = chickenBowlDaily[daysAgo - 1];
    const salads = tomatoSaladDaily[daysAgo - 1];
    salesRows.push(
      {
        restaurant_id: state.restaurantId,
        source_record_id: `staging-learning-${runId}-bowl-${daysAgo}`,
        sale_date: saleDate,
        item_name: "Chicken Bowl",
        category: "Entree",
        quantity_sold: bowls,
        gross_sales: Math.round(bowls * 13.5 * 100) / 100,
        net_sales: Math.round(bowls * 12.42 * 100) / 100,
        source_pos: "Staging POS"
      },
      {
        restaurant_id: state.restaurantId,
        source_record_id: `staging-learning-${runId}-salad-${daysAgo}`,
        sale_date: saleDate,
        item_name: "Tomato Salad",
        category: "Salad",
        quantity_sold: salads,
        gross_sales: Math.round(salads * 9 * 100) / 100,
        net_sales: Math.round(salads * 8.28 * 100) / 100,
        source_pos: "Staging POS"
      }
    );
  }
  await adminInsert("pos_sales", salesRows);
  proven.push("Seeded 2 costed inventory items, 2 recipe mappings, and 14 prior days of POS sales.");

  // 3. First refresh through the authenticated owner (real client path).
  const preexisting = await fetchPendingRecommendations(ownerClient, state.restaurantId, chickenId);
  assert.equal(preexisting.length, 0, "fresh tenant starts without pending recommendations");

  await invokeOperationalWorkflow(ownerClient, "initial refresh_signals", {
    action: "refresh_signals",
    restaurantId: state.restaurantId
  });
  const baselinePending = await fetchPendingRecommendations(ownerClient, state.restaurantId, chickenId);
  assert.equal(baselinePending.length, 1, "refresh_signals generates exactly one pending recommendation for the low item");
  assert.equal(baselinePending[0].generation_source, "mise_rules", "the recommendation is server-generated");
  const baselineQuantity = Number(baselinePending[0].recommended_quantity);
  assert.equal(
    baselineQuantity,
    expectedBaselineQuantity,
    `the unbiased recommendation restores the item to par (${expectedBaselineQuantity} ${chicken.unit})`
  );

  const insightsRead = await ownerClient
    .from("insights")
    .select("insight_type,title,generation_source")
    .eq("restaurant_id", state.restaurantId);
  if (insightsRead.error) throw insightsRead.error;
  assert.ok((insightsRead.data?.length ?? 0) >= 1, "refresh_signals persists insights for the tenant");
  assert.ok(
    insightsRead.data.every((insight) => insight.generation_source === "mise_rules"),
    "all insights are server-generated"
  );
  assert.ok(
    insightsRead.data.some((insight) => insight.insight_type === "inventory" && insight.title.includes(chicken.item_name)),
    "the low-stock insight names the depleted item"
  );
  proven.push(
    `refresh_signals produced a pending ${baselineQuantity} ${chicken.unit} recommendation plus ${insightsRead.data.length} insight(s).`
  );

  // 4. Three approvals at an adjusted quantity. The signal engine suppresses a
  // new recommendation for an item whose latest handled recommendation is
  // newer than the item's last_updated, so each cycle recounts the item
  // through the update_inventory workflow (same on-hand value; bumps
  // last_updated server-side) before regenerating with refresh_signals.
  const adjustedQuantity = Math.ceil(baselineQuantity * 4 / 3);
  const learnedMinimum = Math.max(1, baselineQuantity * 0.5);
  const learnedMaximum = Math.max(baselineQuantity * 1.75, chicken.par_level * 1.25, 1);
  assert.ok(
    adjustedQuantity >= learnedMinimum && adjustedQuantity <= learnedMaximum,
    "the adjusted approval quantity sits inside the learned-median acceptance window"
  );

  for (let approval = 1; approval <= 3; approval += 1) {
    const pending = await fetchPendingRecommendations(ownerClient, state.restaurantId, chickenId);
    assert.equal(pending.length, 1, `approval cycle ${approval} starts from one regenerated pending recommendation`);
    if (approval > 1) {
      assert.equal(
        Number(pending[0].recommended_quantity),
        baselineQuantity,
        `with fewer than 3 approved samples the regenerated quantity stays at the unbiased ${baselineQuantity}`
      );
    }

    const approved = await ownerClient.rpc("approve_purchase_recommendation", {
      p_restaurant_id: state.restaurantId,
      p_recommendation_id: pending[0].id,
      p_recommended_quantity: adjustedQuantity
    });
    if (approved.error) throw approved.error;
    assert.equal(approved.data.outcome, "applied", `approval ${approval} applies cleanly`);
    assert.equal(approved.data.recommendation.status, "approved", `approval ${approval} marks the recommendation approved`);
    assert.equal(
      Number(approved.data.recommendation.recommended_quantity),
      adjustedQuantity,
      `approval ${approval} persists the adjusted quantity of ${adjustedQuantity}`
    );
    assert.equal(approved.data.order.status, "draft", `approval ${approval} lands on a draft supplier order`);

    await invokeOperationalWorkflow(ownerClient, `inventory recount after approval ${approval}`, {
      action: "update_inventory",
      restaurantId: state.restaurantId,
      itemId: chickenId,
      patch: { current_quantity: chicken.current_quantity }
    });
    await invokeOperationalWorkflow(ownerClient, `refresh_signals after approval ${approval}`, {
      action: "refresh_signals",
      restaurantId: state.restaurantId
    });
  }
  proven.push(`Approved the recommendation 3 times at an adjusted ${adjustedQuantity} ${chicken.unit}, regenerating between approvals.`);

  // 5. The next generated recommendation adopts the approved median.
  const approvedHistory = await ownerClient
    .from("purchase_recommendations")
    .select("recommended_quantity")
    .eq("restaurant_id", state.restaurantId)
    .eq("inventory_item_id", chickenId)
    .eq("status", "approved");
  if (approvedHistory.error) throw approvedHistory.error;
  assert.equal(approvedHistory.data.length, 3, "three approved recommendations remain as learning history");
  const approvedMedian = medianOf(approvedHistory.data.map((row) => Number(row.recommended_quantity)));

  const learnedPending = await fetchPendingRecommendations(ownerClient, state.restaurantId, chickenId);
  assert.equal(learnedPending.length, 1, "the final refresh regenerates one pending recommendation");
  const learnedQuantity = Number(learnedPending[0].recommended_quantity);
  assert.notEqual(learnedQuantity, baselineQuantity, "the learned quantity moved off the unbiased baseline");
  assert.ok(
    Math.sign(learnedQuantity - baselineQuantity) === Math.sign(approvedMedian - baselineQuantity),
    `the learned quantity ${learnedQuantity} moved toward the approved median ${approvedMedian} (baseline ${baselineQuantity})`
  );
  assert.ok(
    Math.abs(learnedQuantity - approvedMedian) <= 1,
    `the learned quantity ${learnedQuantity} lands within ceil-rounding of the approved median ${approvedMedian}`
  );
  proven.push(
    `The regenerated recommendation shifted from ${baselineQuantity} to ${learnedQuantity} ${chicken.unit}, matching the approved median ${approvedMedian}.`
  );

  console.log("PASS: Mise hosted staging learning-loop verification proved:");
  for (const [index, step] of proven.entries()) console.log(`  ${index + 1}. ${step}`);
} finally {
  const cleanupFailures = [];
  if (ownerClient) {
    await ownerClient.auth.signOut().catch(() => {});
  }
  if (state.restaurantId) {
    // Explicit child-table deletes mirror staging-seed's marker-scoped
    // cleanup order; the restaurant delete then cascades memberships and
    // private planning state. Memberships are never deleted directly because
    // the last-active-owner guard only yields to restaurant/user cascades.
    for (const table of [
      "audit_logs",
      "insights",
      "purchase_recommendations",
      "supplier_orders",
      "menu_item_ingredients",
      "pos_sales",
      "inventory_items"
    ]) {
      const { error } = await admin.from(table).delete().eq("restaurant_id", state.restaurantId);
      if (error) cleanupFailures.push(`${table}: ${error.message}`);
    }
    const { error: restaurantError } = await admin.from("restaurants").delete().eq("id", state.restaurantId);
    if (restaurantError) cleanupFailures.push(`restaurants: ${restaurantError.message}`);
  }
  if (state.ownerUserId) {
    const { error } = await admin.auth.admin.deleteUser(state.ownerUserId);
    if (error) cleanupFailures.push(`auth user ${ownerEmail}: ${error.message}`);
  }
  if (cleanupFailures.length > 0) {
    process.exitCode = 1;
    console.error(`Disposable tenant cleanup left staging residue: ${cleanupFailures.join("; ")}`);
  } else if (state.restaurantId || state.ownerUserId) {
    console.log("Cleaned up the disposable learning-check tenant and owner user.");
  }
}
