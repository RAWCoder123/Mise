import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

import { assertStagingPreflight } from "./staging-preflight.mjs";

const exec = promisify(execFile);
for (const name of [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_ANON_KEY",
  "SUPABASE_STAGING_SECRET_KEY",
  "SUPABASE_STAGING_DB_PASSWORD",
  "MISE_STAGING_MARKER",
  "MISE_STAGING_SEED_PASSWORD"
]) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}
await assertStagingPreflight();

const url = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const secretKey = process.env.SUPABASE_STAGING_SECRET_KEY;
if (secretKey === anonKey) throw new Error("A distinct staging secret key is required.");

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const owner = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
await assertInviteOnlyAuth();

const runId = randomUUID().slice(0, 8);
const email = `account-delete-${runId}@mise-staging.test`;
const restaurantName = `Account Deletion ${runId} ${process.env.MISE_STAGING_MARKER}`
  .slice(0, 120)
  .trim();
const state = {
  userId: null,
  restaurantId: null,
  inventoryItemId: null,
  inventoryEventId: null,
  deleted: false
};

try {
  const sentinel = await loadSentinel();
  const created = await admin.auth.admin.createUser({
    email,
    password: process.env.MISE_STAGING_SEED_PASSWORD,
    email_confirm: true,
    app_metadata: {
      provider: "email",
      providers: ["email"],
      mise_staging_fixture: true,
      mise_staging_account_deletion_check: runId
    }
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("Disposable user was not created.");
  state.userId = created.data.user.id;

  const signedIn = await owner.auth.signInWithPassword({
    email,
    password: process.env.MISE_STAGING_SEED_PASSWORD
  });
  if (signedIn.error) throw signedIn.error;

  const unauthorizedAllocation = await owner.rpc("create_restaurant_with_owner", {
    restaurant_name: `${restaurantName} unauthorized`.slice(0, 120),
    restaurant_cuisine_type: "Must remain blocked"
  });
  assert.ok(
    unauthorizedAllocation.error,
    "a signed-in beta user must not receive self-service restaurant allocation"
  );
  assert.equal(unauthorizedAllocation.data, null);

  const restaurant = await admin.rpc("service_provision_beta_restaurant", {
    p_owner_user_id: state.userId,
    p_restaurant_name: restaurantName,
    p_restaurant_cuisine_type: "Disposable account deletion proof",
    p_idempotency_key: randomUUID()
  });
  if (restaurant.error || !restaurant.data?.id) {
    throw restaurant.error ?? new Error("Disposable restaurant was not created.");
  }
  state.restaurantId = restaurant.data.id;

  state.inventoryItemId = randomUUID();
  const itemInsert = await admin.from("inventory_items").insert({
    id: state.inventoryItemId,
    restaurant_id: state.restaurantId,
    item_name: "Disposable deletion item",
    category: "Test",
    unit: "each",
    current_quantity: 0,
    par_level: 5,
    reorder_threshold: 1,
    estimated_unit_cost: 1,
    supplier_name: "Disposable supplier",
    canonical_unit: "each",
    canonical_quantity_per_unit: 1,
    canonical_unit_verification_status: "verified",
    canonical_unit_verified_at: new Date().toISOString(),
    canonical_unit_verified_by: state.userId
  });
  if (itemInsert.error) throw itemInsert.error;

  state.inventoryEventId = randomUUID();
  const clientEventId = `account-delete-${runId}`;
  const eventInsert = await admin.from("inventory_events").insert({
    id: state.inventoryEventId,
    restaurant_id: state.restaurantId,
    inventory_item_id: state.inventoryItemId,
    event_type: "count",
    quantity: 3,
    canonical_unit: "each",
    effective_at: new Date().toISOString(),
    actor_user_id: state.userId,
    source: "staging_account_deletion_check",
    source_reference: runId,
    reason_code: "account_deletion_proof",
    client_event_id: clientEventId,
    idempotency_key: `inventory:${clientEventId}`,
    metadata: { fixture: true }
  });
  if (eventInsert.error) throw eventInsert.error;

  const before = await boundedCounts();
  const deletion = await owner.functions.invoke("delete-account", {
    body: {
      confirmation: "delete_my_account",
      restaurantId: state.restaurantId
    }
  });
  if (deletion.error) {
    let detail = deletion.error.message;
    if (deletion.error.context instanceof Response) {
      detail = (await deletion.error.context.clone().text()).slice(0, 1000);
    }
    throw new Error(`delete-account failed: ${detail}`);
  }
  assert.equal(deletion.data?.status, "deleted");
  assert.match(deletion.data?.auditId ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(deletion.data?.restaurantsDeleted, 1);
  state.deleted = true;

  const after = await boundedCounts();
  assert.equal(after.restaurants, before.restaurants - 1);
  assert.equal(after.inventory_events, before.inventory_events - 1);

  const deletedUser = await admin.auth.admin.getUserById(state.userId);
  assert.ok(deletedUser.error, "Deleted Auth user must not remain retrievable.");

  const deletedRestaurant = await admin
    .from("restaurants")
    .select("id", { count: "exact", head: true })
    .eq("id", state.restaurantId);
  if (deletedRestaurant.error) throw deletedRestaurant.error;
  assert.equal(deletedRestaurant.count, 0);

  const audit = JSON.parse(
    await databaseQuery(`
      select json_build_object(
        'phase', metadata->>'phase',
        'planned_user_id', planned_user_id,
        'restaurants_deleted', coalesce((metadata->>'restaurants_deleted')::integer, 0)
      )::text
      from private.account_deletion_audit
      where id = '${deletion.data.auditId}'::uuid;
    `)
  );
  assert.equal(audit.phase, "tenant_cleanup_completed");
  assert.equal(audit.planned_user_id, state.userId);
  assert.equal(Number(audit.restaurants_deleted), 1);

  assert.deepEqual(await loadSentinel(), sentinel);
  console.log(
    `Mise hosted account-deletion proof passed: disposable Auth user and sole-owner tenant deleted, durable audit ${deletion.data.auditId} completed, sentinel tenant unchanged.`
  );
} finally {
  if (!state.deleted) await cleanupDisposableFixture();
}

async function boundedCounts() {
  const [restaurants, events] = await Promise.all([
    admin.from("restaurants").select("id", { count: "exact", head: true }),
    admin.from("inventory_events").select("id", { count: "exact", head: true })
  ]);
  if (restaurants.error) throw restaurants.error;
  if (events.error) throw events.error;
  return {
    restaurants: restaurants.count ?? 0,
    inventory_events: events.count ?? 0
  };
}

async function assertInviteOnlyAuth() {
  const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anonKey }
  });
  assert.equal(settingsResponse.ok, true, "Hosted Auth settings must be readable.");
  const settings = await settingsResponse.json();
  assert.equal(settings.disable_signup, true, "Hosted Auth must reject all public signup.");
  assert.equal(settings.external?.email, true, "Hosted email login must remain available.");
  assert.equal(
    settings.external?.anonymous_users,
    false,
    "Hosted anonymous signup must remain disabled."
  );

  const signupResponse = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email: `blocked-signup-${randomUUID()}@mise-staging.test`,
      password: "Not-A-Real-Beta-Password-123!"
    })
  });
  const signupBody = await signupResponse.json();
  assert.equal(signupResponse.status, 422);
  assert.match(
    signupBody.msg ?? signupBody.message ?? "",
    /signups not allowed/i,
    "Hosted Auth must fail closed instead of creating an unprovisioned user."
  );
}

async function loadSentinel() {
  const result = await admin
    .from("restaurants")
    .select("id,name,created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (result.error || !result.data) throw result.error ?? new Error("No staging sentinel tenant exists.");
  return result.data;
}

async function cleanupDisposableFixture() {
  if (state.restaurantId) {
    const target = await admin
      .from("restaurants")
      .select("id,name")
      .eq("id", state.restaurantId)
      .maybeSingle();
    if (!target.error && target.data?.name === restaurantName) {
      await admin.from("restaurants").delete().eq("id", state.restaurantId);
    }
  }
  if (state.userId) {
    const target = await admin.auth.admin.getUserById(state.userId);
    if (!target.error && target.data.user?.email === email) {
      await admin.auth.admin.deleteUser(state.userId);
    }
  }
}

async function databaseQuery(sql) {
  const postgresBin = [
    "/Applications/Postgres.app/Contents/Versions/latest/bin",
    "/opt/homebrew/opt/postgresql@17/bin"
  ].find((candidate) => existsSync(join(candidate, "psql")));
  if (!postgresBin) throw new Error("psql is required.");
  const result = await exec(join(postgresBin, "psql"), [
    "--no-psqlrc",
    "--quiet",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--host", `db.${process.env.SUPABASE_STAGING_PROJECT_REF}.supabase.co`,
    "--port", "5432",
    "--username", "postgres",
    "--dbname", "postgres",
    "--command", sql
  ], {
    env: {
      ...process.env,
      PGPASSWORD: process.env.SUPABASE_STAGING_DB_PASSWORD,
      PGSSLMODE: "require",
      PGCONNECT_TIMEOUT: "15",
      PGOPTIONS: "-c statement_timeout=30000 -c lock_timeout=10000",
      PGTZ: "UTC"
    },
    maxBuffer: 2 * 1024 * 1024,
    timeout: 60_000
  });
  return result.stdout.trim();
}
