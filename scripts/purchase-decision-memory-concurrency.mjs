import assert from "node:assert/strict";

import pg from "pg";

const { Client } = pg;
const connectionString = process.env.SUPABASE_LOCAL_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);
if (!["127.0.0.1", "localhost"].includes(connectionUrl.hostname)) {
  throw new Error("Purchase decision concurrency proof must run against local Supabase");
}

const actorId = "f4000000-0000-4000-8000-000000000001";
const otherActorId = "f4000000-0000-4000-8000-000000000002";
const restaurantId = "f4000000-0000-4000-8000-000000000010";
const otherRestaurantId = "f4000000-0000-4000-8000-000000000011";
const supplierIds = [
  "f4000000-0000-4000-8000-000000000101",
  "f4000000-0000-4000-8000-000000000102",
  "f4000000-0000-4000-8000-000000000103"
];
const itemIds = [
  "f4000000-0000-4000-8000-000000000201",
  "f4000000-0000-4000-8000-000000000202",
  "f4000000-0000-4000-8000-000000000203"
];
const recommendationIds = [
  "f4000000-0000-4000-8000-000000000301",
  "f4000000-0000-4000-8000-000000000302"
];

function client() {
  return new Client({ connectionString });
}

async function beginAuthenticated(connection, userId = actorId) {
  await connection.query("begin");
  await connection.query("set local statement_timeout = '5s'");
  await connection.query("set local role authenticated");
  await connection.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
}

async function authenticateSession(connection, userId = actorId) {
  await connection.query("set role authenticated");
  await connection.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
}

async function resetCurrentPlanning(admin, recommendationId) {
  await admin.query(
    `update private.restaurant_signal_state
     set signals_revision = planning_revision, status = 'current'
     where restaurant_id = $1`,
    [restaurantId]
  );
  await admin.query(
    `update public.purchase_recommendations
     set planning_revision = (
       select signals_revision from private.restaurant_signal_state where restaurant_id = $1
     ) where restaurant_id = $1 and id = $2`,
    [restaurantId, recommendationId]
  );
}

async function setup(admin) {
  for (const [id, email] of [[actorId, "memory-race@mise.test"], [otherActorId, "memory-race-other@mise.test"]]) {
    await admin.query(
      `insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', $2, crypt('password', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())`,
      [id, email]
    );
  }
  await admin.query(
    `insert into public.restaurants (id, name, cuisine_type, timezone) values
      ($1, 'Purchase Memory Race Kitchen', 'Cafe', 'UTC'),
      ($2, 'Other Purchase Memory Kitchen', 'Cafe', 'UTC')`,
    [restaurantId, otherRestaurantId]
  );
  await admin.query(
    `insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
      ($1, $2, 'manager', 'active'), ($3, $4, 'owner', 'active')`,
    [restaurantId, actorId, otherRestaurantId, otherActorId]
  );
  await admin.query(
    "update public.system_operational_controls set ordering_policy = 'draft_only', order_drafting_enabled = true where singleton"
  );
  await admin.query(
    `update public.restaurant_operational_controls
     set ordering_policy = 'draft_only', order_drafting_enabled = true
     where restaurant_id = $1`,
    [restaurantId]
  );
  for (let index = 0; index < 3; index += 1) {
    await admin.query(
      `insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
       values ($1, $2, $3, $4)`,
      [supplierIds[index], restaurantId, `Memory Race Supplier ${index + 1}`, `memory race supplier ${index + 1}`]
    );
    await admin.query(
      `insert into public.inventory_items (
        id, restaurant_id, item_name, category, unit, current_quantity, par_level,
        reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
        canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
        canonical_unit_verified_at, canonical_unit_verified_by
      ) values ($1, $2, $3, 'Produce', 'each', 1, 10, 3, 2, $4, $5,
        'each', 1, 'verified', now(), $6)`,
      [itemIds[index], restaurantId, `Memory Race Item ${index + 1}`, supplierIds[index], `Memory Race Supplier ${index + 1}`, actorId]
    );
    await admin.query(
      `insert into public.inventory_events (
        restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
        effective_at, actor_user_id, source, client_event_id, idempotency_key
      ) values ($1, $2, 'count', 1, 'each', now(), $3, 'memory-race', $4, $4)`,
      [restaurantId, itemIds[index], actorId, `memory-race-count-${index + 1}`]
    );
  }
  await admin.query(
    `update private.restaurant_signal_state
     set signals_revision = planning_revision, status = 'current'
     where restaurant_id = $1`,
    [restaurantId]
  );
  for (let index = 0; index < 2; index += 1) {
    await admin.query(
      `insert into public.purchase_recommendations (
        id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
        recommended_quantity, unit, reason, urgency, status, generation_source,
        planning_revision
      ) values ($1, $2, $3, $4, $5, $6, 10, 'each', 'Race proof', 'medium',
        'pending', 'mise_rules', (
          select signals_revision from private.restaurant_signal_state where restaurant_id = $2
        ))`,
      [recommendationIds[index], restaurantId, itemIds[index], `Memory Race Item ${index + 1}`, supplierIds[index], `Memory Race Supplier ${index + 1}`]
    );
  }
}

const admin = client();
const first = client();
const second = client();
const reader = client();
const otherReader = client();
const writer = client();
let originalSystemControls = null;

try {
  await Promise.all([admin.connect(), first.connect(), second.connect(), reader.connect(), otherReader.connect(), writer.connect()]);
  originalSystemControls = (await admin.query(
    "select ordering_policy, order_drafting_enabled from public.system_operational_controls where singleton"
  )).rows[0] ?? null;
  await setup(admin);

  await Promise.all([authenticateSession(first), authenticateSession(second)]);
  const identical = await Promise.all([
    first.query("select public.approve_purchase_recommendation($1, $2, 8) result", [restaurantId, recommendationIds[0]]),
    second.query("select public.approve_purchase_recommendation($1, $2, 8) result", [restaurantId, recommendationIds[0]])
  ]);
  await Promise.all([first.query("reset role"), second.query("reset role")]);
  assert.deepEqual(
    identical.map((result) => result.rows[0].result.outcome).sort(),
    ["already_applied", "applied"],
    "concurrent identical approvals must linearize to applied plus replay"
  );
  assert.equal(
    Number((await admin.query(
      "select count(*) count from public.purchase_decision_events where purchase_recommendation_id = $1",
      [recommendationIds[0]]
    )).rows[0].count),
    1,
    "concurrent identical approval must emit exactly one event"
  );

  await authenticateSession(first);
  const undo = await first.query(
    "select public.undo_purchase_recommendation_action($1, $2) result",
    [restaurantId, recommendationIds[0]]
  );
  await first.query("reset role");
  assert.equal(undo.rows[0].result.outcome, "applied");
  const undoEvidence = await admin.query(
    `select count(*) count,
      count(*) filter (where decision_type = 'undo' and target_event_id is not null) undo_count
     from public.purchase_decision_events where purchase_recommendation_id = $1`,
    [recommendationIds[0]]
  );
  assert.equal(Number(undoEvidence.rows[0].count), 2);
  assert.equal(Number(undoEvidence.rows[0].undo_count), 1);

  await resetCurrentPlanning(admin, recommendationIds[1]);
  await Promise.all([authenticateSession(first), authenticateSession(second)]);
  const race = await Promise.allSettled([
    first.query("select public.approve_purchase_recommendation($1, $2, 10) result", [restaurantId, recommendationIds[1]]),
    second.query("select public.dismiss_purchase_recommendation($1, $2) result", [restaurantId, recommendationIds[1]])
  ]);
  await Promise.allSettled([first.query("reset role"), second.query("reset role")]);
  assert.equal(race.filter((result) => result.status === "fulfilled").length, 1,
    "approval versus dismissal must have exactly one applied winner");
  const racedEvidence = await admin.query(
    `select count(*) count from public.purchase_decision_events
     where purchase_recommendation_id = $1
       and decision_type in ('approve', 'approve_with_override', 'dismiss')`,
    [recommendationIds[1]]
  );
  assert.equal(Number(racedEvidence.rows[0].count), 1,
    "approval versus dismissal must emit only the winner event");

  await writer.query("begin");
  await writer.query(
    `insert into public.purchase_decision_events (
      restaurant_id, actor_user_id, actor_role, decision_type,
      purchase_recommendation_id, inventory_item_id, supplier_id,
      recommendation_source, recommendation_unit, recommended_quantity,
      chosen_quantity, canonical_unit, canonical_quantity_per_unit,
      recommended_canonical_quantity, chosen_canonical_quantity,
      quantity_delta, quantity_ratio, context_evidence, source_event_key, occurred_at
    )
    select $1, $2, 'manager', 'approve_with_override', gen_random_uuid(), $3, $4,
      'mise_rules', 'each', 10, 8, 'each', 1, 10, 8, -2, 0.8,
      '{}'::jsonb, 'memory-race-pattern-' || sample, clock_timestamp()
    from generate_series(1, 5) sample`,
    [restaurantId, actorId, itemIds[2], supplierIds[2]]
  );

  await beginAuthenticated(reader);
  const beforeCommit = await reader.query(
    "select count(*) count from public.list_purchase_decision_patterns($1) where inventory_item_id = $2",
    [restaurantId, itemIds[2]]
  );
  await reader.query("commit");
  assert.equal(Number(beforeCommit.rows[0].count), 0,
    "aggregate read must not observe uncommitted evidence");
  await writer.query("commit");
  await beginAuthenticated(reader);
  const afterCommit = await reader.query(
    `select sample_count, evidence_strength, dominant_outcome
     from public.list_purchase_decision_patterns($1) where inventory_item_id = $2`,
    [restaurantId, itemIds[2]]
  );
  await reader.query("commit");
  assert.equal(Number(afterCommit.rows[0].sample_count), 5);
  assert.equal(afterCommit.rows[0].evidence_strength, "established");
  assert.equal(afterCommit.rows[0].dominant_outcome, "downward");

  await beginAuthenticated(otherReader, otherActorId);
  const crossTenant = await otherReader.query(
    "select count(*) count from public.list_purchase_decision_patterns($1)",
    [restaurantId]
  );
  await otherReader.query("commit");
  assert.equal(Number(crossTenant.rows[0].count), 0,
    "cross-tenant reader must see no purchase memory patterns");

  console.log("Purchase decision memory concurrency checks passed (12 assertions).");
} finally {
  for (const connection of [first, second, reader, otherReader, writer]) {
    try { await connection.query("rollback"); } catch {}
  }
  try {
    await admin.query("delete from public.restaurants where id = any($1::uuid[])", [[restaurantId, otherRestaurantId]]);
    await admin.query("delete from auth.users where id = any($1::uuid[])", [[actorId, otherActorId]]);
    if (originalSystemControls) {
      await admin.query(
        `update public.system_operational_controls
         set ordering_policy = $1, order_drafting_enabled = $2
         where singleton`,
        [originalSystemControls.ordering_policy, originalSystemControls.order_drafting_enabled]
      );
    }
  } catch {}
  await Promise.allSettled([admin.end(), first.end(), second.end(), reader.end(), otherReader.end(), writer.end()]);
}
