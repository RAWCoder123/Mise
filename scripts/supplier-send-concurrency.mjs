import assert from "node:assert/strict";

import pg from "pg";

const { Client } = pg;

const actorId = "fb111111-1111-4111-8111-111111111111";
const restaurantId = "fb000000-0000-4000-8000-000000000001";
const integrationId = "fb000000-0000-4000-8000-000000000002";
const locationId = "fb000000-0000-4000-8000-000000000003";
const credentialId = "fb000000-0000-4000-8000-000000000090";

const scenarios = {
  approvalMutation: {
    itemId: "fb000000-0000-4000-8000-000000000011",
    countId: "fb000000-0000-4000-8000-000000000021",
    recommendationId: "fb000000-0000-4000-8000-000000000031",
    itemName: "Approval mutation apples",
    supplier: "Approval Mutation Supplier",
  },
  claimMutation: {
    itemId: "fb000000-0000-4000-8000-000000000012",
    countId: "fb000000-0000-4000-8000-000000000022",
    recommendationId: "fb000000-0000-4000-8000-000000000032",
    itemName: "Claim mutation beans",
    supplier: "Claim Mutation Supplier",
  },
  actionRejection: {
    itemId: "fb000000-0000-4000-8000-000000000018",
    countId: "fb000000-0000-4000-8000-000000000028",
    recommendationId: "fb000000-0000-4000-8000-000000000038",
    itemName: "Claim rejection herbs",
    supplier: "Claim Rejection Supplier",
  },
  attachA: {
    itemId: "fb000000-0000-4000-8000-000000000013",
    countId: "fb000000-0000-4000-8000-000000000023",
    recommendationId: "fb000000-0000-4000-8000-000000000033",
    itemName: "Attach line carrots",
    supplier: "Attach Supplier",
  },
  attachB: {
    itemId: "fb000000-0000-4000-8000-000000000014",
    countId: "fb000000-0000-4000-8000-000000000024",
    recommendationId: "fb000000-0000-4000-8000-000000000034",
    itemName: "Attach line daikon",
    supplier: "Attach Supplier",
  },
  undo: {
    itemId: "fb000000-0000-4000-8000-000000000015",
    countId: "fb000000-0000-4000-8000-000000000025",
    recommendationId: "fb000000-0000-4000-8000-000000000035",
    itemName: "Undo line eggplant",
    supplier: "Undo Supplier",
  },
  inventory: {
    itemId: "fb000000-0000-4000-8000-000000000016",
    countId: "fb000000-0000-4000-8000-000000000026",
    recommendationId: "fb000000-0000-4000-8000-000000000036",
    itemName: "Inventory race fennel",
    supplier: "Inventory Race Supplier",
  },
  square: {
    itemId: "fb000000-0000-4000-8000-000000000017",
    countId: "fb000000-0000-4000-8000-000000000027",
    recommendationId: "fb000000-0000-4000-8000-000000000037",
    itemName: "Square race grapes",
    supplier: "Square Race Supplier",
  },
};

const supplierIdsByName = new Map(
  [...new Set(Object.values(scenarios).map((scenario) => scenario.supplier))]
    .map((supplier, index) => [
      supplier,
      `fb000000-0000-4000-8000-${String(index + 51).padStart(12, "0")}`,
    ]),
);

function supplierIdForName(supplier) {
  const supplierId = supplierIdsByName.get(supplier);
  assert.ok(supplierId, `durable supplier ID exists for ${supplier}`);
  return supplierId;
}

const connectionString = process.env.SUPABASE_LOCAL_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);

if (connectionUrl.hostname !== "127.0.0.1" && connectionUrl.hostname !== "localhost") {
  throw new Error("Supplier-send concurrency regressions must run against local Supabase");
}

function client() {
  return new Client({ connectionString });
}

async function beginAuthenticated(connection) {
  await connection.query("begin");
  await connection.query("set local statement_timeout = '12s'");
  await connection.query("set local role authenticated");
  await connection.query("select set_config('request.jwt.claim.sub', $1, true)", [actorId]);
}

async function beginService(connection) {
  await connection.query("begin");
  await connection.query("set local statement_timeout = '12s'");
  await connection.query("set local role service_role");
}

async function waitForDatabaseLock(observer, processId, label) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [processId],
    );
    if (result.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`${label} did not reach its database lock boundary`);
}

async function setup(admin, cleanupState) {
  await admin.query(
    `insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'supplier-send-concurrency@mise.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    )`,
    [actorId],
  );
  await admin.query(
    "insert into public.restaurants (id, name, cuisine_type, timezone) values ($1, 'Supplier Send Concurrency Kitchen', 'Cafe', 'UTC')",
    [restaurantId],
  );
  await admin.query(
    "insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values ($1, $2, 'manager', 'active')",
    [restaurantId, actorId],
  );
  const systemControls = await admin.query(
    `select operational_mode, ordering_policy,
       order_drafting_enabled, gmail_delivery_enabled
     from public.system_operational_controls
     where singleton`,
  );
  assert.equal(systemControls.rowCount, 1, "system operational controls singleton exists");
  cleanupState.systemControls = systemControls.rows[0];
  await admin.query(
    `update public.system_operational_controls
     set operational_mode = 'normal', ordering_policy = 'draft_only',
       order_drafting_enabled = true, gmail_delivery_enabled = true
     where singleton`,
  );
  await admin.query(
    `update public.restaurant_operational_controls
     set ordering_policy = 'draft_only', order_drafting_enabled = true,
       gmail_delivery_enabled = true
     where restaurant_id = $1`,
    [restaurantId],
  );
  await admin.query(
    `insert into public.restaurant_email_connections (
      restaurant_id, provider, status, sender_email, last_verified_at
    ) values ($1, 'gmail', 'connected', 'orders@supplier-send-race.test', clock_timestamp())`,
    [restaurantId],
  );

  const suppliers = [...new Set(Object.values(scenarios).map((scenario) => scenario.supplier))];
  for (const [index, supplier] of suppliers.entries()) {
    const supplierId = supplierIdForName(supplier);
    await admin.query(
      `insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
       values ($1, $2, $3, lower($3))`,
      [supplierId, restaurantId, supplier],
    );
    await admin.query(
      `insert into public.supplier_recipients (
        restaurant_id, supplier_id, supplier_name, email
      ) values ($1, $2, $3, $4)`,
      [restaurantId, supplierId, supplier, `supplier-${index + 1}@supplier-send-race.test`],
    );
  }

  const vaultSecret = await admin.query(
    `select vault.create_secret(
      'supplier-send-concurrency-refresh-token',
      'supplier-send-concurrency-' || gen_random_uuid()::text,
      'MISE-003B direct PostgreSQL concurrency credential'
    ) as id`,
  );
  cleanupState.vaultSecretId = vaultSecret.rows[0].id;

  await admin.query(
    `insert into private.gmail_credentials (
      id, restaurant_id, provider_subject, sender_email,
      refresh_token_secret_id, granted_scopes, connected_by_user_id,
      credential_generation, last_refreshed_at
    ) values (
      $1, $2, 'supplier-send-concurrency-subject',
      'orders@supplier-send-race.test',
      $4,
      array['https://www.googleapis.com/auth/gmail.send']::text[],
      $3, 1, clock_timestamp()
    )`,
    [credentialId, restaurantId, actorId, cleanupState.vaultSecretId],
  );

  for (const scenario of Object.values(scenarios)) {
    await admin.query(
      `insert into public.inventory_items (
        id, restaurant_id, item_name, category, unit, current_quantity,
        par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
        canonical_unit, canonical_quantity_per_unit,
        canonical_unit_verification_status, canonical_unit_verified_at,
        canonical_unit_verified_by
      ) values (
        $1, $2, $3, 'Produce', 'each', 0, 8, 2, 1, $4, $5,
        'each', 1, 'verified', now(), $6
      )`,
      [
        scenario.itemId,
        restaurantId,
        scenario.itemName,
        supplierIdForName(scenario.supplier),
        scenario.supplier,
        actorId,
      ],
    );
    await admin.query(
      `insert into public.inventory_events (
        id, restaurant_id, inventory_item_id, event_type, quantity,
        canonical_unit, effective_at, actor_user_id, source,
        client_event_id, idempotency_key
      ) values (
        $1, $2, $3, 'count', 1, 'each', clock_timestamp(), $4,
        'supplier-send-concurrency', $5, $5
      )`,
      [scenario.countId, restaurantId, scenario.itemId, actorId, `initial-${scenario.recommendationId}`],
    );
  }

  await admin.query(
    `insert into public.pos_integrations (
      id, restaurant_id, provider, status, last_sync_at,
      authority_window_from, authority_window_to, authority_window_completed_at
    ) values (
      $1, $2, 'square', 'connected', clock_timestamp(),
      current_date - 27, current_date, clock_timestamp()
    )`,
    [integrationId, restaurantId],
  );
  await admin.query(
    `insert into public.pos_locations (
      id, restaurant_id, pos_integration_id, external_location_id,
      display_name, timezone, status
    ) values ($1, $2, $3, 'supplier-send-race-location', 'Race Location', 'UTC', 'active')`,
    [locationId, restaurantId, integrationId],
  );

  for (const scenario of Object.values(scenarios)) {
    await admin.query(
      `insert into public.purchase_recommendations (
        id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
        recommended_quantity, unit, reason, urgency, status, generation_source
      ) values (
        $1, $2, $3, $4, $5, $6, 2, 'each',
        'MISE-003B concurrency fixture', 'high', 'pending', 'manual'
      )`,
      [
        scenario.recommendationId,
        restaurantId,
        scenario.itemId,
        scenario.itemName,
        supplierIdForName(scenario.supplier),
        scenario.supplier,
      ],
    );
  }
}

async function cleanupStep(cleanupErrors, label, operation) {
  try {
    await operation();
  } catch (error) {
    cleanupErrors.push(new Error(
      `${label}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    ));
  }
}

async function approveRecommendation(connection, recommendationId) {
  await beginAuthenticated(connection);
  try {
    const approved = await connection.query(
      "select public.approve_purchase_recommendation($1, $2, 2) as result",
      [restaurantId, recommendationId],
    );
    assert.equal(approved.rows[0].result.outcome, "applied");
    await connection.query("commit");
    return approved.rows[0].result;
  } catch (error) {
    await connection.query("rollback").catch(() => undefined);
    throw error;
  }
}

async function orderForSupplier(admin, supplier) {
  const result = await admin.query(
    `select id, operator_note, delivery_date, send_content_revision
     from public.supplier_orders
     where restaurant_id = $1 and supplier_id = $2 and status = 'draft'`,
    [restaurantId, supplierIdForName(supplier)],
  );
  assert.equal(result.rowCount, 1, `one draft exists for ${supplier}`);
  return result.rows[0];
}

async function sendActionId(connection, orderId) {
  const result = await connection.query(
    `select id from public.mise_actions
     where restaurant_id = $1
       and idempotency_key = format('send_supplier_order:%s', $2::uuid)`,
    [restaurantId, orderId],
  );
  assert.equal(result.rowCount, 1);
  return result.rows[0].id;
}

async function preview(connection, orderId) {
  const result = await connection.query(
    "select public.preview_supplier_send_content($1, $2) as result",
    [restaurantId, orderId],
  );
  assert.equal(result.rows[0].result.ready, true);
  assert.match(result.rows[0].result.contentFingerprint, /^[a-f0-9]{64}$/u);
  return result.rows[0].result;
}

async function approveCurrentContent(connection, orderId) {
  await beginAuthenticated(connection);
  try {
    const actionId = await sendActionId(connection, orderId);
    const current = await preview(connection, orderId);
    const approved = await connection.query(
      "select public.approve_supplier_send_content($1, $2, $3, $4) as result",
      [restaurantId, actionId, orderId, current.contentFingerprint],
    );
    assert.ok(["applied", "already_applied"].includes(approved.rows[0].result.outcome));
    await connection.query("commit");
    return { actionId, fingerprint: current.contentFingerprint };
  } catch (error) {
    await connection.query("rollback").catch(() => undefined);
    throw error;
  }
}

async function currentPreview(connection, orderId) {
  await beginAuthenticated(connection);
  try {
    const current = await preview(connection, orderId);
    await connection.query("commit");
    return current;
  } catch (error) {
    await connection.query("rollback").catch(() => undefined);
    throw error;
  }
}

async function claim(connection, orderId, label) {
  return connection.query(
    `select public.service_claim_supplier_email_send(
      $1, $2, $3, $3, $4
    ) as result`,
    [actorId, restaurantId, orderId, `<mise-003b-${label}@mise.test>`],
  );
}

async function rejectClaim(connection, orderId, claimToken) {
  await beginService(connection);
  try {
    const failed = await connection.query(
      `select public.service_fail_supplier_email_send(
        $1, $2, $3, $4, 'rejected', 'concurrency_fixture_rejected'
      ) as result`,
      [actorId, restaurantId, orderId, claimToken],
    );
    assert.equal(failed.rows[0].result.outcome, "failed");
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback").catch(() => undefined);
    throw error;
  }
}

function assertSendInProgress(error, label) {
  assert.ok(error, `${label} must reject`);
  assert.equal(error.code, "55000");
  assert.match(error.message, /send_in_progress/u);
}

function blockerCodes(approval) {
  return (approval.authority?.blockers ?? []).map((blocker) => blocker.code);
}

async function beginFullSquareSync(connection) {
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

const admin = client();
const primary = client();
const racer = client();
const observer = client();
const syncWriter = client();
const cleanupState = {
  systemControls: undefined,
  vaultSecretId: undefined,
};

await Promise.all([
  admin.connect(),
  primary.connect(),
  racer.connect(),
  observer.connect(),
  syncWriter.connect(),
]);

let harnessError;
try {
  await setup(admin, cleanupState);

  for (const scenario of [
    scenarios.approvalMutation,
    scenarios.claimMutation,
    scenarios.actionRejection,
    scenarios.attachA,
    scenarios.undo,
    scenarios.inventory,
    scenarios.square,
  ]) {
    await approveRecommendation(primary, scenario.recommendationId);
  }

  const approvalMutationOrder = await orderForSupplier(admin, scenarios.approvalMutation.supplier);
  const claimMutationOrder = await orderForSupplier(admin, scenarios.claimMutation.supplier);
  const actionRejectionOrder = await orderForSupplier(admin, scenarios.actionRejection.supplier);
  const attachOrder = await orderForSupplier(admin, scenarios.attachA.supplier);
  const undoOrder = await orderForSupplier(admin, scenarios.undo.supplier);
  const inventoryOrder = await orderForSupplier(admin, scenarios.inventory.supplier);
  const squareOrder = await orderForSupplier(admin, scenarios.square.supplier);

  // Full-content approval and a concurrent note mutation serialize on the
  // supplier boundary. The later mutation wins and invalidates the reviewed
  // hash; it can never be mistaken for the content the manager approved.
  await beginAuthenticated(primary);
  const approvalMutationActionId = await sendActionId(primary, approvalMutationOrder.id);
  const approvalMutationPreview = await preview(primary, approvalMutationOrder.id);
  const approvalResult = await primary.query(
    "select public.approve_supplier_send_content($1, $2, $3, $4) as result",
    [
      restaurantId,
      approvalMutationActionId,
      approvalMutationOrder.id,
      approvalMutationPreview.contentFingerprint,
    ],
  );
  assert.equal(approvalResult.rows[0].result.outcome, "applied");

  await beginAuthenticated(racer);
  const postApprovalMutation = racer.query(
    `select public.update_supplier_order_draft(
      $1, $2, 'note committed after content approval', true, null, false
    ) as result`,
    [restaurantId, approvalMutationOrder.id],
  );
  await waitForDatabaseLock(observer, racer.processID, "approval-vs-note mutation");
  await primary.query("commit");
  await postApprovalMutation;
  await racer.query("commit");

  const changedPreview = await currentPreview(primary, approvalMutationOrder.id);
  assert.notEqual(changedPreview.contentFingerprint, approvalMutationPreview.contentFingerprint);
  await beginService(primary);
  const changedClaim = await claim(primary, approvalMutationOrder.id, "approval-mutation");
  assert.equal(changedClaim.rows[0].result.outcome, "send_content_changed");
  assert.equal(changedClaim.rows[0].result.refreshToken, undefined);
  await primary.query("commit");
  const changedDelivery = await admin.query(
    "select count(*)::integer as count from private.supplier_email_deliveries where supplier_order_id = $1",
    [approvalMutationOrder.id],
  );
  assert.equal(changedDelivery.rows[0].count, 0);
  console.log("Supplier content approval vs note mutation concurrency regression passed");

  // Once a claim exists, material order content is frozen. A waiting note/date
  // edit observes the committed claim and rejects without advancing revision.
  await approveCurrentContent(primary, claimMutationOrder.id);
  const claimMutationBefore = await admin.query(
    `select operator_note, delivery_date, send_content_revision
     from public.supplier_orders where id = $1`,
    [claimMutationOrder.id],
  );
  await beginService(primary);
  const mutationClaim = await claim(primary, claimMutationOrder.id, "claim-mutation");
  assert.equal(mutationClaim.rows[0].result.outcome, "claimed");
  await beginAuthenticated(racer);
  const frozenMutation = racer.query(
    `select public.update_supplier_order_draft(
      $1, $2, 'must not commit while sending', true, current_date + 9, true
    ) as result`,
    [restaurantId, claimMutationOrder.id],
  ).then((result) => ({ result }), (error) => ({ error }));
  await waitForDatabaseLock(observer, racer.processID, "claim-vs-order mutation");
  await primary.query("commit");
  const frozenMutationResult = await frozenMutation;
  assertSendInProgress(frozenMutationResult.error, "claim-vs-order mutation");
  await racer.query("rollback");
  const claimMutationAfter = await admin.query(
    `select operator_note, delivery_date, send_content_revision
     from public.supplier_orders where id = $1`,
    [claimMutationOrder.id],
  );
  assert.deepEqual(claimMutationAfter.rows[0], claimMutationBefore.rows[0]);
  await rejectClaim(primary, claimMutationOrder.id, mutationClaim.rows[0].result.claimToken);
  console.log("Supplier claim vs note/date mutation concurrency regression passed");

  // Claim and manager rejection serialize on the action row. If claim owns the
  // boundary first, the waiting rejection must observe the committed in-flight
  // delivery and cannot revoke the action that authorized the provider call.
  await approveCurrentContent(primary, actionRejectionOrder.id);
  await beginService(primary);
  const rejectionClaim = await claim(primary, actionRejectionOrder.id, "claim-rejection");
  assert.equal(rejectionClaim.rows[0].result.outcome, "claimed");
  await beginAuthenticated(racer);
  const actionRejectionId = await sendActionId(racer, actionRejectionOrder.id);
  const concurrentRejection = racer.query(
    "select public.decide_mise_action($1, $2, 'rejected') as result",
    [restaurantId, actionRejectionId],
  ).then((result) => ({ result }), (error) => ({ error }));
  await waitForDatabaseLock(observer, racer.processID, "claim-vs-action rejection");
  await primary.query("commit");
  const blockedRejection = await concurrentRejection;
  assertSendInProgress(blockedRejection.error, "claim-vs-action rejection");
  await racer.query("rollback");
  const rejectionPersistence = await admin.query(
    `select
      (select status from public.mise_actions where id = $1) as action_status,
      (select status from private.supplier_email_deliveries
        where supplier_order_id = $2) as delivery_status`,
    [actionRejectionId, actionRejectionOrder.id],
  );
  assert.equal(rejectionPersistence.rows[0].action_status, "approved");
  assert.equal(rejectionPersistence.rows[0].delivery_status, "sending");
  await rejectClaim(primary, actionRejectionOrder.id, rejectionClaim.rows[0].result.claimToken);
  console.log("Supplier claim vs action-rejection concurrency regression passed");

  // A purchase approval that would attach a new line waits for the claim's
  // supplier lock, then sees sending and returns a structured blocker.
  await approveCurrentContent(primary, attachOrder.id);
  const attachOrderBefore = await admin.query(
    `select order_message, send_content_revision, purchase_authority
     from public.supplier_orders where id = $1`,
    [attachOrder.id],
  );
  await beginService(primary);
  const attachClaim = await claim(primary, attachOrder.id, "claim-attach");
  assert.equal(attachClaim.rows[0].result.outcome, "claimed");
  await beginAuthenticated(racer);
  const attachApproval = racer.query(
    "select public.approve_purchase_recommendation($1, $2, 2) as result",
    [restaurantId, scenarios.attachB.recommendationId],
  );
  await waitForDatabaseLock(observer, racer.processID, "claim-vs-purchase attachment");
  await primary.query("commit");
  const blockedAttach = (await attachApproval).rows[0].result;
  assert.equal(blockedAttach.outcome, "blocked");
  assert.ok(blockerCodes(blockedAttach).includes("send_in_progress"));
  await racer.query("commit");
  const attachPersistence = await admin.query(
    `select
      (select status from public.purchase_recommendations where id = $1) as status,
      (select supplier_order_id from public.purchase_recommendations where id = $1) as order_id,
      (select claimed_recommendation_ids from private.supplier_email_deliveries
        where supplier_order_id = $2) as claimed_ids,
      (select order_message from public.supplier_orders where id = $2) as order_message,
      (select send_content_revision from public.supplier_orders where id = $2) as revision,
      (select purchase_authority from public.supplier_orders where id = $2) as authority`,
    [scenarios.attachB.recommendationId, attachOrder.id],
  );
  assert.equal(attachPersistence.rows[0].status, "pending");
  assert.equal(attachPersistence.rows[0].order_id, null);
  assert.deepEqual(attachPersistence.rows[0].claimed_ids, [scenarios.attachA.recommendationId]);
  assert.equal(attachPersistence.rows[0].order_message, attachOrderBefore.rows[0].order_message);
  assert.equal(attachPersistence.rows[0].revision, attachOrderBefore.rows[0].send_content_revision);
  assert.deepEqual(attachPersistence.rows[0].authority, attachOrderBefore.rows[0].purchase_authority);
  await rejectClaim(primary, attachOrder.id, attachClaim.rows[0].result.claimToken);
  console.log("Supplier claim vs purchase-line attachment concurrency regression passed");

  // Undo uses the same boundary and cannot remove a line from an in-flight
  // claim after the exact claimed recommendation set has been persisted.
  await approveCurrentContent(primary, undoOrder.id);
  const undoOrderBefore = await admin.query(
    `select order_message, send_content_revision, purchase_authority
     from public.supplier_orders where id = $1`,
    [undoOrder.id],
  );
  await beginService(primary);
  const undoClaim = await claim(primary, undoOrder.id, "claim-undo");
  assert.equal(undoClaim.rows[0].result.outcome, "claimed");
  await beginAuthenticated(racer);
  const undoAttempt = racer.query(
    "select public.undo_purchase_recommendation_action($1, $2) as result",
    [restaurantId, scenarios.undo.recommendationId],
  ).then((result) => ({ result }), (error) => ({ error }));
  await waitForDatabaseLock(observer, racer.processID, "claim-vs-undo");
  await primary.query("commit");
  const blockedUndo = await undoAttempt;
  assertSendInProgress(blockedUndo.error, "claim-vs-undo");
  await racer.query("rollback");
  const undoPersistence = await admin.query(
    `select
      (select status from public.purchase_recommendations where id = $1) as status,
      (select supplier_order_id from public.purchase_recommendations where id = $1) as order_id,
      (select claimed_recommendation_ids from private.supplier_email_deliveries
        where supplier_order_id = $2) as claimed_ids,
      (select order_message from public.supplier_orders where id = $2) as order_message,
      (select send_content_revision from public.supplier_orders where id = $2) as revision,
      (select purchase_authority from public.supplier_orders where id = $2) as authority`,
    [scenarios.undo.recommendationId, undoOrder.id],
  );
  assert.equal(undoPersistence.rows[0].status, "approved");
  assert.equal(undoPersistence.rows[0].order_id, undoOrder.id);
  assert.deepEqual(undoPersistence.rows[0].claimed_ids, [scenarios.undo.recommendationId]);
  assert.equal(undoPersistence.rows[0].order_message, undoOrderBefore.rows[0].order_message);
  assert.equal(undoPersistence.rows[0].revision, undoOrderBefore.rows[0].send_content_revision);
  assert.deepEqual(undoPersistence.rows[0].authority, undoOrderBefore.rows[0].purchase_authority);
  await rejectClaim(primary, undoOrder.id, undoClaim.rows[0].result.claimToken);
  console.log("Supplier claim vs recommendation undo concurrency regression passed");

  // Inventory evidence commits first at the inventory-item row lock. The
  // waiting claim re-evaluates the now non-actionable line and creates no claim.
  await approveCurrentContent(primary, inventoryOrder.id);
  await beginAuthenticated(racer);
  const inventoryEvent = await racer.query(
    `select public.record_inventory_event(
      $1, $2, 'count', 100, 'each', clock_timestamp(),
      'supplier-send-concurrency', 'inventory-race-high-count',
      'inventory-race-high-count', null, null, null, '{}'::jsonb
    ) as result`,
    [restaurantId, scenarios.inventory.itemId],
  );
  assert.equal(inventoryEvent.rowCount, 1);
  await beginService(primary);
  const inventoryClaimPromise = claim(primary, inventoryOrder.id, "claim-inventory");
  await waitForDatabaseLock(observer, primary.processID, "claim-vs-inventory event");
  await racer.query("commit");
  const inventoryClaim = (await inventoryClaimPromise).rows[0].result;
  assert.equal(inventoryClaim.outcome, "purchase_authority_stale");
  assert.ok((inventoryClaim.blockerCodes ?? []).includes("recommendation_no_longer_actionable"));
  assert.equal(inventoryClaim.refreshToken, undefined);
  await primary.query("commit");
  const inventoryDelivery = await admin.query(
    "select count(*)::integer as count from private.supplier_email_deliveries where supplier_order_id = $1",
    [inventoryOrder.id],
  );
  assert.equal(inventoryDelivery.rows[0].count, 0);
  console.log("Supplier claim vs inventory-event concurrency regression passed");

  // A full Square sync commits an unmapped provider identity while claim is
  // waiting on the integration snapshot. Claim linearizes afterwards and must
  // re-evaluate the new evidence instead of sending from the old snapshot.
  await approveCurrentContent(primary, squareOrder.id);
  const syncToken = await beginFullSquareSync(admin);
  const operatingDate = (await admin.query("select current_date::text as operating_date"))
    .rows[0].operating_date;
  await syncWriter.query("begin");
  await syncWriter.query("set local statement_timeout = '12s'");
  const appliedSync = await syncWriter.query(
    `select public.service_apply_square_sync_result_scoped(
      $1, $2, $3, $4, 'full', $5::jsonb, $6::jsonb, null,
      current_date - 27, current_date
    ) as result`,
    [
      actorId,
      restaurantId,
      integrationId,
      syncToken,
      JSON.stringify([{
        source_record_id: "supplier-send-square-race",
        sale_date: operatingDate,
        item_name: "Unmapped concurrency entrée",
        category: "Square",
        quantity_sold: 1,
        gross_sales: 14,
        net_sales: 14,
        provider_location_id: "supplier-send-race-location",
        provider_variation_id: "VAR-SUPPLIER-SEND-RACE",
      }]),
      JSON.stringify([{
        external_catalog_item_id: "ITEM-SUPPLIER-SEND-RACE",
        external_variation_id: "VAR-SUPPLIER-SEND-RACE",
        external_name: "Unmapped concurrency entrée",
        category: "Square",
      }]),
    ],
  );
  assert.equal(appliedSync.rows[0].result.authorityWindowAttested, true);
  await beginService(primary);
  const squareClaimPromise = claim(primary, squareOrder.id, "claim-square");
  await waitForDatabaseLock(observer, primary.processID, "claim-vs-Square sync");
  await syncWriter.query("commit");
  const squareClaim = (await squareClaimPromise).rows[0].result;
  assert.equal(squareClaim.outcome, "purchase_authority_stale");
  assert.ok((squareClaim.blockerCodes ?? []).includes("provider_mapping_missing"));
  assert.equal(squareClaim.refreshToken, undefined);
  await primary.query("commit");
  const squarePersistence = await admin.query(
    `select
      (select count(*)::integer from private.supplier_email_deliveries
        where supplier_order_id = $1) as delivery_count,
      (select authority_sync_token is null from public.pos_integrations
        where id = $2) as sync_released`,
    [squareOrder.id, integrationId],
  );
  assert.equal(squarePersistence.rows[0].delivery_count, 0);
  assert.equal(squarePersistence.rows[0].sync_released, true);
  console.log("Supplier claim vs Square-sync concurrency regression passed");

  const auditSummary = await admin.query(
    `select
      (select count(*)::integer from public.audit_logs
        where restaurant_id = $1 and action = 'supplier_email_claimed') as claim_count,
      (select count(*)::integer from private.supplier_email_deliveries
        where restaurant_id = $1) as delivery_count,
      (select count(*)::integer from public.purchase_recommendations
        where restaurant_id = $1 and status = 'pending') as pending_count`,
    [restaurantId],
  );
  assert.equal(auditSummary.rows[0].claim_count, 4);
  assert.equal(auditSummary.rows[0].delivery_count, 4);
  assert.equal(auditSummary.rows[0].pending_count, 1);
  console.log("All supplier-send direct PostgreSQL concurrency regressions passed");
} catch (error) {
  harnessError = error;
}

const cleanupErrors = [];
await cleanupStep(cleanupErrors, "primary transaction rollback", () => primary.query("rollback"));
await cleanupStep(cleanupErrors, "racer transaction rollback", () => racer.query("rollback"));
await cleanupStep(cleanupErrors, "Square-sync transaction rollback", () => syncWriter.query("rollback"));
if (cleanupState.systemControls) {
  await cleanupStep(cleanupErrors, "system controls restore", () => admin.query(
    `update public.system_operational_controls
     set operational_mode = $1,
       ordering_policy = $2,
       order_drafting_enabled = $3,
       gmail_delivery_enabled = $4
     where singleton`,
    [
      cleanupState.systemControls.operational_mode,
      cleanupState.systemControls.ordering_policy,
      cleanupState.systemControls.order_drafting_enabled,
      cleanupState.systemControls.gmail_delivery_enabled,
    ],
  ));
}
await cleanupStep(cleanupErrors, "restaurant fixture removal", () => (
  admin.query("delete from public.restaurants where id = $1", [restaurantId])
));
await cleanupStep(cleanupErrors, "auth fixture removal", () => (
  admin.query("delete from auth.users where id = $1", [actorId])
));
if (cleanupState.vaultSecretId) {
  await cleanupStep(cleanupErrors, "Vault secret removal", () => (
    admin.query("delete from vault.secrets where id = $1", [cleanupState.vaultSecretId])
  ));
}
await cleanupStep(cleanupErrors, "admin connection close", () => admin.end());
await cleanupStep(cleanupErrors, "primary connection close", () => primary.end());
await cleanupStep(cleanupErrors, "racer connection close", () => racer.end());
await cleanupStep(cleanupErrors, "observer connection close", () => observer.end());
await cleanupStep(cleanupErrors, "Square-sync connection close", () => syncWriter.end());

if (harnessError && cleanupErrors.length > 0) {
  throw new AggregateError(
    [harnessError, ...cleanupErrors],
    "Supplier-send concurrency harness and cleanup both failed",
  );
}
if (harnessError) {
  throw harnessError;
}
if (cleanupErrors.length > 0) {
  throw new AggregateError(cleanupErrors, "Supplier-send concurrency cleanup failed");
}
