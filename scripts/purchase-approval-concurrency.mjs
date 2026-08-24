import assert from "node:assert/strict";

import pg from "pg";

const { Client } = pg;
const actorId = "f3000000-0000-4000-8000-000000000001";
const restaurantId = "f3000000-0000-4000-8000-000000000002";
const inventoryItemId = "f3000000-0000-4000-8000-000000000003";
const countEventId = "f3000000-0000-4000-8000-000000000004";
const recommendationId = "f3000000-0000-4000-8000-000000000005";
const supplierId = "f3000000-0000-4000-8000-000000000006";

const connectionString = process.env.SUPABASE_LOCAL_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);

if (connectionUrl.hostname !== "127.0.0.1" && connectionUrl.hostname !== "localhost") {
  throw new Error("Purchase approval concurrency regression must run against local Supabase");
}

function client() {
  return new Client({ connectionString });
}

async function beginAuthenticated(connection) {
  await connection.query("begin");
  await connection.query("set local statement_timeout = '5s'");
  await connection.query("set local role authenticated");
  await connection.query("select set_config('request.jwt.claim.sub', $1, true)", [actorId]);
}

async function approve(connection) {
  return connection.query(
    "select public.approve_purchase_recommendation($1, $2, 6) as result",
    [restaurantId, recommendationId]
  );
}

async function waitForRecommendationLock(observer, processId) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [processId]
    );
    if (result.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Concurrent approval did not wait for the recommendation lock");
}

async function setup(admin) {
  await admin.query(
    `insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'approval-concurrency@mise.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    )`,
    [actorId]
  );
  await admin.query(
    "insert into public.restaurants (id, name, cuisine_type) values ($1, 'Approval Concurrency Kitchen', 'Cafe')",
    [restaurantId]
  );
  await admin.query(
    "insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values ($1, $2, 'manager', 'active')",
    [restaurantId, actorId]
  );
  await admin.query(
    "update public.system_operational_controls set ordering_policy = 'draft_only', order_drafting_enabled = true where singleton"
  );
  await admin.query(
    "update public.restaurant_operational_controls set ordering_policy = 'draft_only', order_drafting_enabled = true where restaurant_id = $1",
    [restaurantId]
  );
  await admin.query(
    `insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
     values ($1, $2, 'Concurrent Supplier', 'concurrent supplier')`,
    [supplierId, restaurantId]
  );
  await admin.query(
    `insert into public.inventory_items (
      id, restaurant_id, item_name, category, unit, current_quantity, par_level,
      reorder_threshold, estimated_unit_cost, supplier_id, supplier_name, canonical_unit,
      canonical_quantity_per_unit, canonical_unit_verification_status,
      canonical_unit_verified_at, canonical_unit_verified_by
    ) values ($1, $2, 'Concurrent chicken', 'Protein', 'each', 1, 10, 3, 2,
      $4, 'Concurrent Supplier', 'each', 1, 'verified', now(), $3)`,
    [inventoryItemId, restaurantId, actorId, supplierId]
  );
  await admin.query(
    `insert into public.inventory_events (
      id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values ($1, $2, $3, 'count', 1, 'each', clock_timestamp(), $4,
      'approval-concurrency-test', 'approval-count', 'approval-count')`,
    [countEventId, restaurantId, inventoryItemId, actorId]
  );
  await admin.query(
    `insert into public.purchase_recommendations (
      id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
      recommended_quantity, unit, reason, urgency, status, generation_source
    ) values ($1, $2, $3, 'Concurrent chicken', $4, 'Concurrent Supplier', 4, 'each',
      'Concurrent approval fixture', 'high', 'pending', 'manual')`,
    [recommendationId, restaurantId, inventoryItemId, supplierId]
  );
}

const admin = client();
const firstApprover = client();
const secondApprover = client();
await Promise.all([admin.connect(), firstApprover.connect(), secondApprover.connect()]);

try {
  await setup(admin);
  await beginAuthenticated(firstApprover);
  await beginAuthenticated(secondApprover);

  const firstResult = await approve(firstApprover);
  assert.equal(firstResult.rows[0].result.outcome, "applied");

  const secondAttempt = approve(secondApprover);
  await waitForRecommendationLock(admin, secondApprover.processID);
  await firstApprover.query("commit");

  const secondResult = await secondAttempt;
  assert.equal(secondResult.rows[0].result.outcome, "already_applied");
  await secondApprover.query("commit");

  const persisted = await admin.query(
    `select
      (select count(*)::integer from public.supplier_orders
        where restaurant_id = $1 and supplier_id = $3) as order_count,
      (select count(*)::integer from public.audit_logs
        where restaurant_id = $1 and entity_id = $2 and action = 'recommendation_approved') as audit_count,
      (select recommended_quantity from public.purchase_recommendations where id = $2) as quantity`,
    [restaurantId, recommendationId, supplierId]
  );
  assert.deepEqual(
    persisted.rows[0],
    { order_count: 1, audit_count: 1, quantity: "6" },
    "concurrent approval creates one draft, one applied audit, and preserves the override"
  );

  console.log("Purchase approval concurrency regression passed");
} finally {
  await firstApprover.query("rollback").catch(() => undefined);
  await secondApprover.query("rollback").catch(() => undefined);
  await admin.query(
    "update public.system_operational_controls set ordering_policy = 'off', order_drafting_enabled = false where singleton"
  ).catch(() => undefined);
  await admin.query("delete from public.restaurants where id = $1", [restaurantId]).catch(() => undefined);
  await admin.query("delete from auth.users where id = $1", [actorId]).catch(() => undefined);
  await Promise.all([admin.end(), firstApprover.end(), secondApprover.end()]);
}
