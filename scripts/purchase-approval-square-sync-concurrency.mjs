import assert from "node:assert/strict";

import pg from "pg";

const { Client } = pg;
const actorId = "f4111111-1111-4111-8111-111111111111";
const restaurantId = "f4000000-0000-4000-8000-000000000001";
const integrationId = "f4000000-0000-4000-8000-000000000002";
const locationId = "f4000000-0000-4000-8000-000000000003";
const firstItemId = "f4000000-0000-4000-8000-000000000011";
const secondItemId = "f4000000-0000-4000-8000-000000000012";
const gapItemId = "f4000000-0000-4000-8000-000000000013";
const firstCountId = "f4000000-0000-4000-8000-000000000021";
const secondCountId = "f4000000-0000-4000-8000-000000000022";
const gapCountId = "f4000000-0000-4000-8000-000000000023";
const firstRecommendationId = "f4000000-0000-4000-8000-000000000031";
const secondRecommendationId = "f4000000-0000-4000-8000-000000000032";
const gapRecommendationId = "f4000000-0000-4000-8000-000000000033";
const raceSupplierId = "f4000000-0000-4000-8000-000000000041";
const gapSupplierId = "f4000000-0000-4000-8000-000000000042";

const connectionString = process.env.SUPABASE_LOCAL_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);

if (connectionUrl.hostname !== "127.0.0.1" && connectionUrl.hostname !== "localhost") {
  throw new Error("Approval-vs-Square-sync regression must run against local Supabase");
}

function client() {
  return new Client({ connectionString });
}

async function beginAuthenticated(connection) {
  await connection.query("begin");
  await connection.query("set local statement_timeout = '8s'");
  await connection.query("set local role authenticated");
  await connection.query("select set_config('request.jwt.claim.sub', $1, true)", [actorId]);
}

async function approve(connection, recommendationId) {
  return connection.query(
    "select public.approve_purchase_recommendation($1, $2, 2) as result",
    [restaurantId, recommendationId],
  );
}

async function beginFullSync(connection) {
  const result = await connection.query(
    `select public.service_begin_square_authority_sync(
      $1, $2, $3, 'full', current_date - 27, current_date
    ) as boundary`,
    [actorId, restaurantId, integrationId],
  );
  const token = result.rows[0]?.boundary?.syncToken;
  assert.match(token ?? "", /^[0-9a-f-]{36}$/u);
  return token;
}

async function applyFullSync(connection, token, sales, catalogItems) {
  return connection.query(
    `select public.service_apply_square_sync_result_scoped(
      $1, $2, $3, $4, 'full', $5::jsonb, $6::jsonb, null,
      current_date - 27, current_date
    ) as result`,
    [actorId, restaurantId, integrationId, token, JSON.stringify(sales), JSON.stringify(catalogItems)],
  );
}

async function waitForDatabaseLock(observer, processId) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [processId],
    );
    if (result.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Approval did not wait at the Square evidence linearization boundary");
}

async function setup(admin) {
  await admin.query(
    `insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'approval-square-sync@mise.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    )`,
    [actorId],
  );
  await admin.query(
    "insert into public.restaurants (id, name, cuisine_type, timezone) values ($1, 'Approval Square Race Kitchen', 'Cafe', 'UTC')",
    [restaurantId],
  );
  await admin.query(
    "insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values ($1, $2, 'manager', 'active')",
    [restaurantId, actorId],
  );
  await admin.query(
    "update public.system_operational_controls set ordering_policy = 'draft_only', order_drafting_enabled = true where singleton",
  );
  await admin.query(
    "update public.restaurant_operational_controls set ordering_policy = 'draft_only', order_drafting_enabled = true where restaurant_id = $1",
    [restaurantId],
  );
  await admin.query(
    `insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
     values ($1, $3, 'Race Supplier', 'race supplier'),
       ($2, $3, 'Fetch Gap Supplier', 'fetch gap supplier')`,
    [raceSupplierId, gapSupplierId, restaurantId],
  );
  await admin.query(
    `insert into public.inventory_items (
      id, restaurant_id, item_name, category, unit, current_quantity, par_level,
      reorder_threshold, estimated_unit_cost, supplier_id, supplier_name, canonical_unit,
      canonical_quantity_per_unit, canonical_unit_verification_status,
      canonical_unit_verified_at, canonical_unit_verified_by
    ) values
      ($1, $4, 'Race line A', 'Produce', 'each', 1, 10, 3, 1, $6, 'Race Supplier',
        'each', 1, 'verified', now(), $5),
      ($2, $4, 'Race line B', 'Produce', 'each', 1, 10, 3, 1, $6, 'Race Supplier',
        'each', 1, 'verified', now(), $5),
      ($3, $4, 'Fetch gap line', 'Produce', 'each', 1, 10, 3, 1, $7, 'Fetch Gap Supplier',
        'each', 1, 'verified', now(), $5)`,
    [firstItemId, secondItemId, gapItemId, restaurantId, actorId, raceSupplierId, gapSupplierId],
  );
  await admin.query(
    `insert into public.inventory_events (
      id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values
      ($1, $4, $6, 'count', 1, 'each', clock_timestamp(), $5,
        'approval-square-sync-test', 'race-count-a', 'race-count-a'),
      ($2, $4, $7, 'count', 1, 'each', clock_timestamp(), $5,
        'approval-square-sync-test', 'race-count-b', 'race-count-b'),
      ($3, $4, $8, 'count', 1, 'each', clock_timestamp(), $5,
        'approval-square-sync-test', 'race-count-gap', 'race-count-gap')`,
    [firstCountId, secondCountId, gapCountId, restaurantId, actorId, firstItemId, secondItemId, gapItemId],
  );
  await admin.query(
    `insert into public.pos_integrations (
      id, restaurant_id, provider, status, last_sync_at,
      authority_window_from, authority_window_to, authority_window_completed_at
    ) values ($1, $2, 'square', 'connected', clock_timestamp(),
      current_date - 27, current_date, clock_timestamp())`,
    [integrationId, restaurantId],
  );
  await admin.query(
    `insert into public.pos_locations (
      id, restaurant_id, pos_integration_id, external_location_id,
      display_name, timezone, status
    ) values ($1, $2, $3, 'race-location', 'Race Location', 'UTC', 'active')`,
    [locationId, restaurantId, integrationId],
  );
  await admin.query(
    `insert into public.purchase_recommendations (
      id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
      recommended_quantity, unit, reason, urgency, status, generation_source
    ) values
      ($1, $4, $5, 'Race line A', $8, 'Race Supplier', 2, 'each', 'Race line A', 'high', 'pending', 'manual'),
      ($2, $4, $6, 'Race line B', $8, 'Race Supplier', 2, 'each', 'Race line B', 'high', 'pending', 'manual'),
      ($3, $4, $7, 'Fetch gap line', $9, 'Fetch Gap Supplier', 2, 'each', 'Fetch gap line', 'high', 'pending', 'manual')`,
    [firstRecommendationId, secondRecommendationId, gapRecommendationId, restaurantId, firstItemId, secondItemId, gapItemId, raceSupplierId, gapSupplierId],
  );
}

const admin = client();
const syncWriter = client();
const approver = client();
const observer = client();
await Promise.all([admin.connect(), syncWriter.connect(), approver.connect(), observer.connect()]);

try {
  await setup(admin);

  const fetchGapToken = await beginFullSync(admin);
  await beginAuthenticated(approver);
  const fetchGapApproval = await approve(approver, gapRecommendationId);
  assert.equal(fetchGapApproval.rows[0].result.outcome, "blocked");
  assert.ok(
    fetchGapApproval.rows[0].result.authority.blockers.some(
      (blocker) => blocker.code === "pos_sync_in_progress",
    ),
    "approval blocks during the provider-fetch gap",
  );
  await approver.query("commit");
  await applyFullSync(admin, fetchGapToken, [], []);

  await beginAuthenticated(approver);
  const firstApproval = await approve(approver, firstRecommendationId);
  assert.equal(firstApproval.rows[0].result.outcome, "applied");
  await approver.query("commit");

  const beforeRace = await admin.query(
    `select id, order_message, purchase_authority
     from public.supplier_orders
     where restaurant_id = $1 and supplier_name = 'Race Supplier'`,
    [restaurantId],
  );
  assert.equal(beforeRace.rowCount, 1);

  const overlappingToken = await beginFullSync(admin);
  const operatingDate = (await admin.query("select current_date::text as operating_date"))
    .rows[0].operating_date;
  await syncWriter.query("begin");
  await syncWriter.query("set local statement_timeout = '8s'");
  const applied = await applyFullSync(
    syncWriter,
    overlappingToken,
    [{
      source_record_id: "square-race-line",
      sale_date: operatingDate,
      item_name: "Unreviewed Square Burger",
      category: "Square",
      quantity_sold: 1,
      gross_sales: 12,
      net_sales: 12,
      provider_location_id: "race-location",
      provider_variation_id: "VAR-RACE",
    }],
    [{
      external_catalog_item_id: "ITEM-RACE",
      external_variation_id: "VAR-RACE",
      external_name: "Unreviewed Square Burger",
      category: "Square",
    }],
  );
  assert.equal(applied.rows[0].result.authorityWindowAttested, true);

  await beginAuthenticated(approver);
  const overlappingApproval = approve(approver, secondRecommendationId);
  await waitForDatabaseLock(observer, approver.processID);
  await syncWriter.query("commit");

  const approvalAfterSync = await overlappingApproval;
  assert.equal(approvalAfterSync.rows[0].result.outcome, "blocked");
  assert.ok(
    approvalAfterSync.rows[0].result.authority.blockers.some(
      (blocker) => blocker.code === "provider_mapping_missing",
    ),
    "approval re-evaluates the newly committed Square evidence",
  );
  await approver.query("commit");

  const persisted = await admin.query(
    `select
      (select count(*)::integer from public.supplier_orders
        where restaurant_id = $1 and supplier_name = 'Race Supplier') as order_count,
      (select status from public.purchase_recommendations where id = $2) as second_status,
      (select approval_authority is null from public.purchase_recommendations where id = $2) as second_authority_absent,
      (select count(*)::integer from public.audit_logs
        where restaurant_id = $1 and action = 'recommendation_approved'
          and entity_id in ($2, $3)) as applied_audit_count,
      (select order_message from public.supplier_orders
        where restaurant_id = $1 and supplier_name = 'Race Supplier') as order_message,
      (select purchase_authority from public.supplier_orders
        where restaurant_id = $1 and supplier_name = 'Race Supplier') as purchase_authority,
      (select authority_sync_token is null from public.pos_integrations where id = $4) as sync_released`,
    [restaurantId, secondRecommendationId, firstRecommendationId, integrationId],
  );
  assert.equal(persisted.rows[0].order_count, 1);
  assert.equal(persisted.rows[0].second_status, "pending");
  assert.equal(persisted.rows[0].second_authority_absent, true);
  assert.equal(persisted.rows[0].applied_audit_count, 1);
  assert.equal(persisted.rows[0].order_message, beforeRace.rows[0].order_message);
  assert.deepEqual(persisted.rows[0].purchase_authority, beforeRace.rows[0].purchase_authority);
  assert.equal(persisted.rows[0].sync_released, true);

  const gapDraft = await admin.query(
    "select count(*)::integer as count from public.supplier_orders where restaurant_id = $1 and supplier_id = $2",
    [restaurantId, gapSupplierId],
  );
  assert.equal(gapDraft.rows[0].count, 0);

  console.log("Purchase approval vs Square sync concurrency regression passed");
} finally {
  await syncWriter.query("rollback").catch(() => undefined);
  await approver.query("rollback").catch(() => undefined);
  await admin.query(
    "update public.system_operational_controls set ordering_policy = 'off', order_drafting_enabled = false where singleton",
  ).catch(() => undefined);
  await admin.query("delete from public.restaurants where id = $1", [restaurantId]).catch(() => undefined);
  await admin.query("delete from auth.users where id = $1", [actorId]).catch(() => undefined);
  await Promise.all([admin.end(), syncWriter.end(), approver.end(), observer.end()]);
}
