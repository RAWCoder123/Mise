import assert from "node:assert/strict";

import pg from "pg";

const { Client } = pg;
const restaurantId = "f1000000-0000-4000-8000-000000000002";
const actorId = "f1000000-0000-4000-8000-000000000001";
const items = {
  sequential: "f1000000-0000-4000-8000-000000000011",
  delayed: "f1000000-0000-4000-8000-000000000012",
  postCount: "f1000000-0000-4000-8000-000000000013",
  backdatedCount: "f1000000-0000-4000-8000-000000000014",
  held: "f1000000-0000-4000-8000-000000000015",
  independent: "f1000000-0000-4000-8000-000000000016",
  replay: "f1000000-0000-4000-8000-000000000017"
};

const connectionString = process.env.SUPABASE_LOCAL_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);

if (connectionUrl.hostname !== "127.0.0.1" && connectionUrl.hostname !== "localhost") {
  throw new Error("Inventory concurrency regression must run against a local Supabase database");
}

function client() {
  return new Client({ connectionString });
}

async function execute(clientConnection, text, values = []) {
  return clientConnection.query(text, values);
}

async function waitForLock(observer, processId) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const result = await execute(
      observer,
      "select wait_event_type, wait_event from pg_stat_activity where pid = $1",
      [processId]
    );
    if (result.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Concurrent inventory event did not wait for the item lock");
}

async function insertEvent(clientConnection, {
  itemId,
  eventType,
  quantity,
  effectiveAt,
  eventId
}) {
  await execute(
    clientConnection,
    `insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values ($1, $2, $3, $4, 'each', $5, $6, 'test_fixture', $7, $7)`,
    [restaurantId, itemId, eventType, quantity, effectiveAt, actorId, eventId]
  );
}

async function currentQuantity(clientConnection, itemId) {
  const result = await execute(
    clientConnection,
    "select current_quantity from public.inventory_items where id = $1",
    [itemId]
  );
  return Number(result.rows[0].current_quantity);
}

async function projectionApplied(clientConnection, eventId) {
  const result = await execute(
    clientConnection,
    "select projection_applied from public.inventory_events where client_event_id = $1",
    [eventId]
  );
  return result.rows[0]?.projection_applied;
}

async function runSameItemRace(observer, input) {
  const countClient = client();
  const delayedClient = client();
  await Promise.all([countClient.connect(), delayedClient.connect()]);
  try {
    await execute(countClient, "begin");
    await insertEvent(countClient, {
      itemId: input.itemId,
      eventType: "count",
      quantity: input.countQuantity,
      effectiveAt: input.countEffectiveAt,
      eventId: `${input.prefix}-count`
    });

    const delayedInsert = insertEvent(delayedClient, {
      itemId: input.itemId,
      eventType: input.delayedEventType,
      quantity: input.delayedQuantity,
      effectiveAt: input.delayedEffectiveAt,
      eventId: `${input.prefix}-delayed`
    });
    await waitForLock(observer, delayedClient.processID);
    await execute(countClient, "commit");
    await delayedInsert;
  } catch (error) {
    await execute(countClient, "rollback").catch(() => undefined);
    throw error;
  } finally {
    await Promise.all([countClient.end(), delayedClient.end()]);
  }
}

async function setup(admin) {
  await execute(
    admin,
    `insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'projection-concurrency@mise.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    )`,
    [actorId]
  );
  await execute(
    admin,
    "insert into public.restaurants (id, name, cuisine_type) values ($1, 'Projection Concurrency Kitchen', 'Cafe')",
    [restaurantId]
  );
  await execute(
    admin,
    "insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values ($1, $2, 'manager', 'active')",
    [restaurantId, actorId]
  );
  for (const [name, id] of Object.entries(items)) {
    await execute(
      admin,
      `insert into public.inventory_items (
        id, restaurant_id, item_name, category, unit, current_quantity,
        par_level, reorder_threshold, estimated_unit_cost, supplier_name,
        canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status
      ) values ($1, $2, $3, 'Test', 'each', 1, 20, 5, 1, 'Test', 'each', 1, 'verified')`,
      [id, restaurantId, name]
    );
  }
}

async function verifyIdempotentReplay(admin) {
  await execute(admin, "select set_config('request.jwt.claim.sub', $1, false)", [actorId]);
  await execute(admin, "select set_config('request.jwt.claim.role', 'authenticated', false)");
  const eventArguments = [
    restaurantId, items.replay, "count", 10, "each", "2020-01-01T13:00:00Z",
    "manual_count", "concurrent-replay", "concurrent-replay"
  ];
  const first = await execute(
    admin,
    "select (public.record_inventory_event($1, $2, $3, $4, $5, $6, $7, $8, $9)).id as id",
    eventArguments
  );
  const replay = await execute(
    admin,
    "select (public.record_inventory_event($1, $2, $3, $4, $5, $6, $7, $8, $9)).id as id",
    eventArguments
  );
  assert.equal(replay.rows[0].id, first.rows[0].id, "idempotent replay returns the original event");
  await execute(admin, "select set_config('request.jwt.claim.sub', '', false)");
  await execute(admin, "select set_config('request.jwt.claim.role', '', false)");
}

async function verifyIndependentItems(admin) {
  const heldClient = client();
  const independentClient = client();
  await Promise.all([heldClient.connect(), independentClient.connect()]);
  try {
    await execute(heldClient, "begin");
    await insertEvent(heldClient, {
      itemId: items.held,
      eventType: "count",
      quantity: 10,
      effectiveAt: "2020-01-01T13:00:00Z",
      eventId: "independent-held-count"
    });
    const independentInsert = insertEvent(independentClient, {
      itemId: items.independent,
      eventType: "receipt",
      quantity: 5,
      effectiveAt: "2020-01-01T12:00:00Z",
      eventId: "independent-receipt"
    });
    await execute(heldClient, "commit");
    await independentInsert;
    assert.equal(await currentQuantity(admin, items.independent), 6, "different items do not share a global lock");
  } finally {
    await execute(heldClient, "rollback").catch(() => undefined);
    await Promise.all([heldClient.end(), independentClient.end()]);
  }
}

const admin = client();
await admin.connect();
try {
  await setup(admin);

  await insertEvent(admin, {
    itemId: items.sequential,
    eventType: "count",
    quantity: 10,
    effectiveAt: "2020-01-01T13:00:00Z",
    eventId: "sequential-count"
  });
  await insertEvent(admin, {
    itemId: items.sequential,
    eventType: "receipt",
    quantity: 5,
    effectiveAt: "2020-01-01T12:00:00Z",
    eventId: "sequential-delayed"
  });
  assert.equal(await currentQuantity(admin, items.sequential), 10, "sequential delayed receipt stays outside count boundary");
  assert.equal(await projectionApplied(admin, "sequential-delayed"), false, "sequential delayed receipt is retained as unapplied");

  await runSameItemRace(admin, {
    itemId: items.delayed,
    delayedEventType: "receipt",
    delayedQuantity: 5,
    delayedEffectiveAt: "2020-01-01T12:00:00Z",
    countQuantity: 10,
    countEffectiveAt: "2020-01-01T13:00:00Z",
    prefix: "concurrent-delayed"
  });
  assert.equal(await currentQuantity(admin, items.delayed), 10, "concurrent delayed receipt cannot apply on top of count");
  assert.equal(await projectionApplied(admin, "concurrent-delayed-delayed"), false, "concurrent delayed receipt is stored as unapplied");

  await runSameItemRace(admin, {
    itemId: items.postCount,
    delayedEventType: "receipt",
    delayedQuantity: 5,
    delayedEffectiveAt: "2020-01-01T14:00:00Z",
    countQuantity: 10,
    countEffectiveAt: "2020-01-01T13:00:00Z",
    prefix: "concurrent-post-count"
  });
  assert.equal(await currentQuantity(admin, items.postCount), 15, "concurrent post-count receipt applies exactly once");
  assert.equal(await projectionApplied(admin, "concurrent-post-count-delayed"), true, "post-count receipt is stored as applied");

  await runSameItemRace(admin, {
    itemId: items.backdatedCount,
    delayedEventType: "count",
    delayedQuantity: 7,
    delayedEffectiveAt: "2020-01-01T12:00:00Z",
    countQuantity: 10,
    countEffectiveAt: "2020-01-01T13:00:00Z",
    prefix: "concurrent-counts"
  });
  assert.equal(await currentQuantity(admin, items.backdatedCount), 10, "newer concurrent count remains authoritative");
  assert.equal(await projectionApplied(admin, "concurrent-counts-delayed"), false, "backdated concurrent count is stored as unapplied");

  await verifyIndependentItems(admin);
  await verifyIdempotentReplay(admin);
  console.log("Inventory projection concurrency regression passed");
} finally {
  await execute(admin, "delete from public.restaurants where id = $1", [restaurantId]).catch(() => undefined);
  await execute(admin, "delete from auth.users where id = $1", [actorId]).catch(() => undefined);
  await admin.end();
}