import assert from "node:assert/strict";

import pg from "pg";

const { Client } = pg;

const actorId = "3caa1111-1111-4111-8111-111111111111";
const restaurantId = "3caa0000-0000-4000-8000-000000000001";
const credentialId = "3caa0000-0000-4000-8000-000000000090";

const suppliers = {
  approval: {
    id: "3caa0000-0000-4000-8000-000000000010",
    name: "Approval Race Supplier",
    renamed: "Approval Race Supplier Renamed",
  },
  claim: {
    id: "3caa0000-0000-4000-8000-000000000020",
    name: "Claim Race Supplier",
    renamed: "Claim Race Supplier Renamed",
  },
  reassignmentOld: {
    id: "3caa0000-0000-4000-8000-000000000030",
    name: "Reassignment Old Supplier",
  },
  reassignmentNew: {
    id: "3caa0000-0000-4000-8000-000000000040",
    name: "Reassignment New Supplier",
    renamed: "Independent Supplier Renamed",
  },
};

const scenarios = {
  approval: {
    itemId: "3caa0000-0000-4000-8000-000000000101",
    countId: "3caa0000-0000-4000-8000-000000000201",
    recommendationId: "3caa0000-0000-4000-8000-000000000301",
    itemName: "Approval race apples",
    supplier: suppliers.approval,
  },
  claim: {
    itemId: "3caa0000-0000-4000-8000-000000000102",
    countId: "3caa0000-0000-4000-8000-000000000202",
    recommendationId: "3caa0000-0000-4000-8000-000000000302",
    itemName: "Claim race beans",
    supplier: suppliers.claim,
  },
  reassignment: {
    itemId: "3caa0000-0000-4000-8000-000000000103",
    countId: "3caa0000-0000-4000-8000-000000000203",
    recommendationId: "3caa0000-0000-4000-8000-000000000303",
    itemName: "Reassignment race carrots",
    supplier: suppliers.reassignmentOld,
  },
};

const connectionString = process.env.SUPABASE_LOCAL_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);

if (connectionUrl.hostname !== "127.0.0.1" && connectionUrl.hostname !== "localhost") {
  throw new Error("Supplier identity concurrency proof must run against local Supabase");
}

function client() {
  return new Client({ connectionString });
}

async function beginAuthenticated(connection, timeout = "12s") {
  await connection.query("begin");
  await connection.query(`set local statement_timeout = '${timeout}'`);
  await connection.query("set local role authenticated");
  await connection.query("select set_config('request.jwt.claim.sub', $1, true)", [actorId]);
  await connection.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
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
      `select wait_event_type, wait_event
       from pg_stat_activity
       where pid = $1`,
      [processId],
    );
    if (result.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`${label} did not reach the durable supplier lock boundary`);
}

async function setup(admin, cleanupState) {
  await admin.query(
    `insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'supplier-identity-concurrency@mise.test', crypt('password', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    )`,
    [actorId],
  );
  await admin.query(
    `insert into public.restaurants (id, name, cuisine_type, timezone)
     values ($1, 'Supplier Identity Concurrency Kitchen', 'Cafe', 'UTC')`,
    [restaurantId],
  );
  await admin.query(
    `insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
     values ($1, $2, 'manager', 'active')`,
    [restaurantId, actorId],
  );

  const systemControls = await admin.query(
    `select operational_mode, ordering_policy, order_drafting_enabled,
       gmail_delivery_enabled
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

  for (const supplier of Object.values(suppliers)) {
    await admin.query(
      `insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
       values ($1, $2, $3, lower($3))`,
      [supplier.id, restaurantId, supplier.name],
    );
    await admin.query(
      `insert into public.supplier_recipients (
        restaurant_id, supplier_id, supplier_name, email
      ) values ($1, $2, $3, $4)`,
      [
        restaurantId,
        supplier.id,
        supplier.name,
        `${supplier.id.slice(-2)}@supplier-identity-race.test`,
      ],
    );
  }

  await admin.query(
    `insert into public.restaurant_email_connections (
      restaurant_id, provider, status, sender_email, last_verified_at
    ) values ($1, 'gmail', 'connected', 'orders@supplier-identity-race.test', clock_timestamp())`,
    [restaurantId],
  );

  const vaultSecret = await admin.query(
    `select vault.create_secret(
      'supplier-identity-concurrency-refresh-token',
      'supplier-identity-concurrency-' || gen_random_uuid()::text,
      'MISE-003C direct PostgreSQL concurrency credential'
    ) as id`,
  );
  cleanupState.vaultSecretId = vaultSecret.rows[0].id;
  await admin.query(
    `insert into private.gmail_credentials (
      id, restaurant_id, provider_subject, sender_email,
      refresh_token_secret_id, granted_scopes, connected_by_user_id,
      credential_generation, last_refreshed_at
    ) values (
      $1, $2, 'supplier-identity-concurrency-subject',
      'orders@supplier-identity-race.test', $4,
      array['https://www.googleapis.com/auth/gmail.send']::text[],
      $3, 1, clock_timestamp()
    )`,
    [credentialId, restaurantId, actorId, cleanupState.vaultSecretId],
  );

  for (const scenario of Object.values(scenarios)) {
    await admin.query(
      `insert into public.inventory_items (
        id, restaurant_id, item_name, category, unit, current_quantity,
        par_level, reorder_threshold, estimated_unit_cost,
        supplier_id, supplier_name, canonical_unit,
        canonical_quantity_per_unit, canonical_unit_verification_status,
        canonical_unit_verified_at, canonical_unit_verified_by
      ) values (
        $1, $2, $3, 'Produce', 'each', 0, 8, 2, 1,
        $4, $5, 'each', 1, 'verified', now(), $6
      )`,
      [
        scenario.itemId,
        restaurantId,
        scenario.itemName,
        scenario.supplier.id,
        scenario.supplier.name,
        actorId,
      ],
    );
    await admin.query(
      `insert into public.inventory_events (
        id, restaurant_id, inventory_item_id, event_type, quantity,
        canonical_unit, effective_at, actor_user_id, source,
        client_event_id, idempotency_key
      ) values (
        $1, $2, $3, 'count', 0, 'each', clock_timestamp(), $4,
        'supplier-identity-concurrency', $5, $5
      )`,
      [
        scenario.countId,
        restaurantId,
        scenario.itemId,
        actorId,
        `identity-count-${scenario.recommendationId}`,
      ],
    );
    await admin.query(
      `insert into public.purchase_recommendations (
        id, restaurant_id, inventory_item_id, item_name,
        supplier_id, supplier_name, recommended_quantity, unit,
        reason, urgency, status, generation_source
      ) values (
        $1, $2, $3, $4, $5, $6, 3, 'each',
        'MISE-003C direct concurrency fixture', 'high', 'pending', 'manual'
      )`,
      [
        scenario.recommendationId,
        restaurantId,
        scenario.itemId,
        scenario.itemName,
        scenario.supplier.id,
        scenario.supplier.name,
      ],
    );
  }
}

async function prepareClaimableOrder(connection) {
  await beginAuthenticated(connection);
  const approval = await connection.query(
    `select public.approve_purchase_recommendation($1, $2, 3) as result`,
    [restaurantId, scenarios.claim.recommendationId],
  );
  assert.equal(approval.rows[0].result.outcome, "applied", "claim fixture approval applies");

  const order = await connection.query(
    `select id from public.supplier_orders
     where restaurant_id = $1 and supplier_id = $2 and status = 'draft'`,
    [restaurantId, suppliers.claim.id],
  );
  assert.equal(order.rowCount, 1, "claim fixture has one durable supplier draft");
  const orderId = order.rows[0].id;

  const action = await connection.query(
    `select id from public.mise_actions
     where restaurant_id = $1
       and idempotency_key = format('send_supplier_order:%s', $2::uuid)`,
    [restaurantId, orderId],
  );
  assert.equal(action.rowCount, 1, "claim fixture has one send action");

  const preview = await connection.query(
    `select public.preview_supplier_send_content($1, $2) as result`,
    [restaurantId, orderId],
  );
  assert.equal(preview.rows[0].result.ready, true, "claim fixture content is ready");
  assert.equal(
    preview.rows[0].result.contentVersion,
    "mise.supplier_send.v2",
    "claim fixture uses supplier-send v2",
  );
  assert.equal(
    preview.rows[0].result.supplierId,
    suppliers.claim.id,
    "claim fixture preview binds supplier ID",
  );

  const contentApproval = await connection.query(
    `select public.approve_supplier_send_content($1, $2, $3, $4) as result`,
    [restaurantId, action.rows[0].id, orderId, preview.rows[0].result.contentFingerprint],
  );
  assert.equal(contentApproval.rows[0].result.outcome, "applied", "content approval applies");
  await connection.query("commit");

  return {
    actionId: action.rows[0].id,
    contentFingerprint: preview.rows[0].result.contentFingerprint,
    orderId,
    subject: preview.rows[0].result.subject,
  };
}

async function cleanupStep(cleanupErrors, label, operation) {
  try {
    await operation();
  } catch (error) {
    cleanupErrors.push(new Error(
      `${label}: ${error instanceof Error ? error.message : String(error)}`,
    ));
  }
}

const admin = client();
const setupActor = client();
const renameActor = client();
const approvalActor = client();
const claimActor = client();
const reassignmentActor = client();
const independentActor = client();
const connections = [
  admin,
  setupActor,
  renameActor,
  approvalActor,
  claimActor,
  reassignmentActor,
  independentActor,
];
const cleanupState = {};

await Promise.all(connections.map((connection) => connection.connect()));

let primaryError;
try {
  await setup(admin, cleanupState);
  const claimFixture = await prepareClaimableOrder(setupActor);

  // Rename linearizes first. Approval must wait on the same durable S1 lock,
  // then approve against the unchanged supplier ID rather than the old name.
  await beginAuthenticated(renameActor);
  const renameResult = await renameActor.query(
    `select pg_catalog.to_jsonb(public.rename_supplier($1, $2, $3)) as result`,
    [restaurantId, suppliers.approval.id, suppliers.approval.renamed],
  );
  assert.equal(renameResult.rows[0].result.id, suppliers.approval.id);

  await beginAuthenticated(approvalActor);
  const approvalAttempt = approvalActor.query(
    `select public.approve_purchase_recommendation($1, $2, 3) as result`,
    [restaurantId, scenarios.approval.recommendationId],
  );
  await waitForDatabaseLock(
    admin,
    approvalActor.processID,
    "rename versus purchase approval",
  );
  await renameActor.query("commit");
  const approvalResult = await approvalAttempt;
  assert.equal(approvalResult.rows[0].result.outcome, "applied");
  await approvalActor.query("commit");

  const approvalPersisted = await admin.query(
    `select recommendation.status, recommendation.supplier_id,
       orders.supplier_id as order_supplier_id,
       supplier.display_name
     from public.purchase_recommendations recommendation
     join public.supplier_orders orders
       on orders.restaurant_id = recommendation.restaurant_id
      and orders.id = recommendation.supplier_order_id
     join public.suppliers supplier
       on supplier.restaurant_id = recommendation.restaurant_id
      and supplier.id = recommendation.supplier_id
     where recommendation.restaurant_id = $1 and recommendation.id = $2`,
    [restaurantId, scenarios.approval.recommendationId],
  );
  assert.deepEqual(
    approvalPersisted.rows[0],
    {
      status: "approved",
      supplier_id: suppliers.approval.id,
      order_supplier_id: suppliers.approval.id,
      display_name: suppliers.approval.renamed,
    },
    "rename and approval serialize without splitting supplier authority",
  );
  console.log("Supplier rename vs purchase approval concurrency regression passed");

  // Claim linearizes first and holds the durable S2 lock until commit. Rename
  // then preserves the exact old reviewed claim while changing presentation
  // only for later review cycles.
  await beginService(claimActor);
  const claim = await claimActor.query(
    `select private.service_claim_supplier_email_send($1, $2, $3, $3, $4) as result`,
    [actorId, restaurantId, claimFixture.orderId, "<mise-003c-claim-race@mise.test>"],
  );
  assert.equal(claim.rows[0].result.outcome, "claimed");
  assert.equal(claim.rows[0].result.contentVersion, "mise.supplier_send.v2");
  assert.equal(claim.rows[0].result.contentFingerprint, claimFixture.contentFingerprint);
  cleanupState.claimOrderId = claimFixture.orderId;
  cleanupState.claimToken = claim.rows[0].result.claimToken;

  await beginAuthenticated(renameActor);
  const claimedRenameAttempt = renameActor.query(
    `select pg_catalog.to_jsonb(public.rename_supplier($1, $2, $3)) as result`,
    [restaurantId, suppliers.claim.id, suppliers.claim.renamed],
  );
  await waitForDatabaseLock(admin, renameActor.processID, "rename versus send claim");
  await claimActor.query("commit");
  const claimedRename = await claimedRenameAttempt;
  assert.equal(claimedRename.rows[0].result.id, suppliers.claim.id);
  await renameActor.query("commit");

  const immutableClaim = await admin.query(
    `select supplier_id, status, content_version, content_fingerprint,
       claimed_subject, external_identity_changed_during_claim
     from private.supplier_email_deliveries
     where restaurant_id = $1 and supplier_order_id = $2`,
    [restaurantId, claimFixture.orderId],
  );
  assert.equal(immutableClaim.rows[0].supplier_id, suppliers.claim.id);
  assert.equal(immutableClaim.rows[0].status, "sending");
  assert.equal(immutableClaim.rows[0].content_version, "mise.supplier_send.v2");
  assert.equal(immutableClaim.rows[0].content_fingerprint, claimFixture.contentFingerprint);
  assert.equal(immutableClaim.rows[0].claimed_subject, claimFixture.subject);
  assert.equal(immutableClaim.rows[0].external_identity_changed_during_claim, true);
  assert.match(immutableClaim.rows[0].claimed_subject, /Claim Race Supplier/);
  assert.doesNotMatch(immutableClaim.rows[0].claimed_subject, /Renamed/);
  console.log("Supplier rename vs send claim concurrency regression passed");

  // Reassignment linearizes first across old and new supplier IDs. The old
  // recommendation may be invalidated/deleted, but can never approve afterward.
  await beginAuthenticated(reassignmentActor);
  const reassignment = await reassignmentActor.query(
    `select pg_catalog.to_jsonb(public.reassign_inventory_item_supplier($1, $2, $3)) as result`,
    [restaurantId, scenarios.reassignment.itemId, suppliers.reassignmentNew.id],
  );
  assert.equal(reassignment.rows[0].result.supplier_id, suppliers.reassignmentNew.id);

  await beginAuthenticated(approvalActor);
  const staleApprovalAttempt = approvalActor.query(
    `select public.approve_purchase_recommendation($1, $2, 3) as result`,
    [restaurantId, scenarios.reassignment.recommendationId],
  ).then(
    (result) => ({ result, error: undefined }),
    (error) => ({ result: undefined, error }),
  );
  await waitForDatabaseLock(
    admin,
    approvalActor.processID,
    "supplier reassignment versus old approval",
  );
  await reassignmentActor.query("commit");
  const staleApproval = await staleApprovalAttempt;
  if (staleApproval.error) {
    await approvalActor.query("rollback");
  } else {
    assert.notEqual(
      staleApproval.result.rows[0].result.outcome,
      "applied",
      "stale old-supplier approval is not applied",
    );
    await approvalActor.query("commit");
  }

  const reassignmentPersisted = await admin.query(
    `select item.supplier_id,
       exists (
         select 1 from public.purchase_recommendations recommendation
         where recommendation.restaurant_id = item.restaurant_id
           and recommendation.id = $3
           and recommendation.status = 'approved'
       ) as stale_approved,
       exists (
         select 1 from public.supplier_orders orders
         where orders.restaurant_id = item.restaurant_id
           and orders.supplier_id = $4
           and exists (
             select 1 from public.purchase_recommendations recommendation
             where recommendation.restaurant_id = orders.restaurant_id
               and recommendation.supplier_order_id = orders.id
               and recommendation.id = $3
           )
       ) as attached_to_old_supplier
     from public.inventory_items item
     where item.restaurant_id = $1 and item.id = $2`,
    [
      restaurantId,
      scenarios.reassignment.itemId,
      scenarios.reassignment.recommendationId,
      suppliers.reassignmentOld.id,
    ],
  );
  assert.deepEqual(
    reassignmentPersisted.rows[0],
    {
      supplier_id: suppliers.reassignmentNew.id,
      stale_approved: false,
      attached_to_old_supplier: false,
    },
    "reassignment wins without allowing stale old-supplier authority",
  );
  console.log("Supplier reassignment vs purchase approval concurrency regression passed");

  // Holding S1 must not serialize a mutation for S4. A one-second statement
  // timeout makes an accidental global/name-wide lock fail deterministically.
  await beginAuthenticated(renameActor);
  await renameActor.query(
    `select pg_catalog.to_jsonb(public.rename_supplier($1, $2, $3))`,
    [restaurantId, suppliers.approval.id, "Approval Race Supplier Held"],
  );
  await beginAuthenticated(independentActor, "1s");
  const independentStartedAt = Date.now();
  const independentRename = await independentActor.query(
    `select pg_catalog.to_jsonb(public.rename_supplier($1, $2, $3)) as result`,
    [restaurantId, suppliers.reassignmentNew.id, suppliers.reassignmentNew.renamed],
  );
  const independentElapsedMs = Date.now() - independentStartedAt;
  assert.equal(independentRename.rows[0].result.id, suppliers.reassignmentNew.id);
  assert.ok(
    independentElapsedMs < 1_000,
    `different supplier mutation should not wait on S1 (elapsed ${independentElapsedMs}ms)`,
  );
  await independentActor.query("commit");
  await renameActor.query("rollback");
  console.log("Different durable suppliers remain independently concurrent");

  console.log("All MISE-003C durable supplier identity concurrency regressions passed");
} catch (error) {
  primaryError = error;
} finally {
  const cleanupErrors = [];
  for (const connection of connections.slice(1)) {
    await cleanupStep(cleanupErrors, "rollback active test transaction", () =>
      connection.query("rollback"));
  }
  if (cleanupState.systemControls) {
    await cleanupStep(cleanupErrors, "restore system operational controls", () => admin.query(
      `update public.system_operational_controls
       set operational_mode = $1, ordering_policy = $2,
         order_drafting_enabled = $3, gmail_delivery_enabled = $4
       where singleton`,
      [
        cleanupState.systemControls.operational_mode,
        cleanupState.systemControls.ordering_policy,
        cleanupState.systemControls.order_drafting_enabled,
        cleanupState.systemControls.gmail_delivery_enabled,
      ],
    ));
  }
  if (cleanupState.claimOrderId && cleanupState.claimToken) {
    await cleanupStep(cleanupErrors, "resolve active concurrency send claim", async () => {
      await admin.query("begin");
      try {
        await admin.query("set local role service_role");
        await admin.query(
          `select private.service_fail_supplier_email_send(
            $1, $2, $3, $4, 'rejected', 'concurrency_fixture_cleanup'
          )`,
          [actorId, restaurantId, cleanupState.claimOrderId, cleanupState.claimToken],
        );
        await admin.query("commit");
      } catch (error) {
        await admin.query("rollback").catch(() => undefined);
        throw error;
      }
    });
  }
  await cleanupStep(cleanupErrors, "delete concurrency restaurant", () =>
    admin.query("delete from public.restaurants where id = $1", [restaurantId]));
  await cleanupStep(cleanupErrors, "delete concurrency actor", () =>
    admin.query("delete from auth.users where id = $1", [actorId]));
  if (cleanupState.vaultSecretId) {
    await cleanupStep(cleanupErrors, "delete concurrency vault secret", () =>
      admin.query("delete from vault.secrets where id = $1", [cleanupState.vaultSecretId]));
  }
  for (const connection of connections) {
    await cleanupStep(cleanupErrors, "close concurrency database connection", () =>
      connection.end());
  }

  if (primaryError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      "Supplier identity concurrency proof and cleanup both failed",
    );
  }
  if (primaryError) throw primaryError;
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Supplier identity concurrency cleanup failed");
  }
}
