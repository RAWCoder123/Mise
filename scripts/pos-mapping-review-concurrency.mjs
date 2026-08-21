import assert from "node:assert/strict";

import pg from "pg";

const { Client } = pg;
const actorId = "f2000000-0000-4000-8000-000000000001";
const restaurantId = "f2000000-0000-4000-8000-000000000002";
const integrationId = "f2000000-0000-4000-8000-000000000003";
const locationId = "f2000000-0000-4000-8000-000000000004";
const firstMenuItemId = "f2000000-0000-4000-8000-000000000005";
const secondMenuItemId = "f2000000-0000-4000-8000-000000000006";
const firstMappingId = "f2000000-0000-4000-8000-000000000007";
const secondMappingId = "f2000000-0000-4000-8000-000000000008";

const connectionString = process.env.SUPABASE_LOCAL_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);

if (connectionUrl.hostname !== "127.0.0.1" && connectionUrl.hostname !== "localhost") {
  throw new Error("POS mapping concurrency regression must run against a local Supabase database");
}

function client() {
  return new Client({ connectionString });
}

async function waitForIdentityLock(observer, processId) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [processId]
    );
    if (result.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Sibling mapping review did not wait for the provider identity lock");
}

async function beginAuthenticated(connection) {
  await connection.query("begin");
  await connection.query("set local statement_timeout = '5s'");
  await connection.query("set local role authenticated");
  await connection.query("select set_config('request.jwt.claim.sub', $1, true)", [actorId]);
}

async function review(connection, mappingId, menuItemId) {
  return connection.query(
    "select public.review_pos_catalog_mapping($1, $2, $3, 'verify') as result",
    [restaurantId, mappingId, menuItemId]
  );
}

async function setup(admin) {
  await admin.query(
    `insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'mapping-concurrency@mise.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    )`,
    [actorId]
  );
  await admin.query(
    "insert into public.restaurants (id, name, cuisine_type) values ($1, 'Mapping Concurrency Kitchen', 'Cafe')",
    [restaurantId]
  );
  await admin.query(
    "insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values ($1, $2, 'manager', 'active')",
    [restaurantId, actorId]
  );
  await admin.query(
    "insert into public.pos_integrations (id, restaurant_id, provider, status) values ($1, $2, 'square', 'connected')",
    [integrationId, restaurantId]
  );
  await admin.query(
    `insert into public.pos_locations (
      id, restaurant_id, pos_integration_id, external_location_id,
      display_name, timezone, status
    ) values ($1, $2, $3, 'square-concurrent-location', 'Concurrent Location', 'UTC', 'active')`,
    [locationId, restaurantId, integrationId]
  );
  await admin.query(
    `insert into public.menu_items (id, restaurant_id, name, category, active)
     values ($1, $3, 'First Menu Item', 'Test', true), ($2, $3, 'Second Menu Item', 'Test', true)`,
    [firstMenuItemId, secondMenuItemId, restaurantId]
  );
  await admin.query(
    `insert into public.pos_catalog_item_mappings (
      id, restaurant_id, pos_location_id, external_catalog_item_id,
      external_variation_id, external_name, menu_item_id,
      verification_status, confidence, effective_from
    ) values
      ($1, $3, $4, 'CONCURRENT-ITEM', 'CONCURRENT-VARIATION', 'Concurrent Item', $5, 'draft', 0.7, now() - interval '2 days'),
      ($2, $3, $4, 'CONCURRENT-ITEM', 'CONCURRENT-VARIATION', 'Concurrent Item Duplicate', $6, 'draft', 0.6, now() - interval '1 day')`,
    [firstMappingId, secondMappingId, restaurantId, locationId, firstMenuItemId, secondMenuItemId]
  );
}

const admin = client();
const firstReviewer = client();
const secondReviewer = client();
await Promise.all([admin.connect(), firstReviewer.connect(), secondReviewer.connect()]);

try {
  await setup(admin);
  await beginAuthenticated(firstReviewer);
  await beginAuthenticated(secondReviewer);

  const firstResult = await review(firstReviewer, firstMappingId, firstMenuItemId);
  assert.equal(firstResult.rows[0].result.outcome, "verified");

  const secondAttempt = review(secondReviewer, secondMappingId, secondMenuItemId);
  await waitForIdentityLock(admin, secondReviewer.processID);
  await firstReviewer.query("commit");

  let secondError;
  try {
    await secondAttempt;
  } catch (error) {
    secondError = error;
  }
  assert.equal(secondError?.code, "55000", "the serialized sibling review fails closed");
  await secondReviewer.query("rollback");

  const authority = await admin.query(
    `select id, menu_item_id
     from public.pos_catalog_item_mappings
     where restaurant_id = $1
       and pos_location_id = $2
       and external_catalog_item_id = 'CONCURRENT-ITEM'
       and external_variation_id = 'CONCURRENT-VARIATION'
       and verification_status = 'verified'
       and effective_from <= now()
       and (effective_to is null or effective_to > now())`,
    [restaurantId, locationId]
  );
  assert.deepEqual(
    authority.rows,
    [{ id: firstMappingId, menu_item_id: firstMenuItemId }],
    "concurrent sibling reviews create exactly one verified authority"
  );

  const planning = await admin.query(
    "select public.service_fetch_operational_planning_snapshot($1, $2) as snapshot",
    [actorId, restaurantId]
  );
  assert.equal(
    planning.rows[0].snapshot.providerMappings.length,
    1,
    "MISE-002A planning receives one unambiguous provider mapping"
  );

  await beginAuthenticated(firstReviewer);
  const replay = await review(firstReviewer, firstMappingId, firstMenuItemId);
  assert.equal(replay.rows[0].result.outcome, "already_verified", "the winning review remains idempotent");
  await firstReviewer.query("commit");

  await beginAuthenticated(firstReviewer);
  const queue = await firstReviewer.query(
    "select public.list_pos_catalog_mapping_reviews($1) as queue",
    [restaurantId]
  );
  assert.equal(queue.rows[0].queue.pendingCount, 0, "the verified identity hides its draft sibling");
  assert.equal(queue.rows[0].queue.mappings.length, 0, "no sibling remains independently reviewable");
  await firstReviewer.query("commit");

  console.log("POS mapping identity concurrency regression passed");
} finally {
  await firstReviewer.query("rollback").catch(() => undefined);
  await secondReviewer.query("rollback").catch(() => undefined);
  await admin.query("delete from public.restaurants where id = $1", [restaurantId]).catch(() => undefined);
  await admin.query("delete from auth.users where id = $1", [actorId]).catch(() => undefined);
  await Promise.all([admin.end(), firstReviewer.end(), secondReviewer.end()]);
}
