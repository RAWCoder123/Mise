import assert from "node:assert/strict";

import pg from "pg";

const { Client } = pg;
const connectionString = process.env.SUPABASE_LOCAL_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const connectionUrl = new URL(connectionString);
if (!["127.0.0.1", "localhost"].includes(connectionUrl.hostname)) {
  throw new Error("Pilot control concurrency proof must run against local Supabase");
}

const restaurants = {
  a: "e5000000-0000-4000-8000-000000000001",
  b: "e5000000-0000-4000-8000-000000000002"
};
const actors = {
  a: "e5111111-1111-4111-8111-111111111111",
  b: "e5222222-2222-4222-8222-222222222222"
};
const requests = {
  concurrentA: "e5000000-0000-4000-8000-000000000101",
  concurrentB: "e5000000-0000-4000-8000-000000000102",
  failedAudit: "e5000000-0000-4000-8000-000000000103",
  duplicate: "e5000000-0000-4000-8000-000000000104",
  disableIsolation: "e5000000-0000-4000-8000-000000000105",
  squareDomain: "e5000000-0000-4000-8000-000000000106",
  gmailDomain: "e5000000-0000-4000-8000-000000000107"
};

function client() {
  return new Client({ connectionString });
}

async function beginService(connection) {
  await connection.query("begin");
  await connection.query("set local statement_timeout = '10s'");
  await connection.query("set local role service_role");
}

async function applyControl(connection, { requestId, restaurantId, action, actorId, reason }) {
  const result = await connection.query(
    `select public.service_apply_pilot_operational_control($1, $2, $3, $4, $5) result`,
    [requestId, restaurantId, action, actorId, reason]
  );
  return result.rows[0].result;
}

async function waitForDatabaseLock(observer, processId, label) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      `select wait_event_type, wait_event from pg_stat_activity where pid = $1`,
      [processId]
    );
    if (result.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`${label} did not reach the PostgreSQL lock boundary`);
}

async function setup(admin) {
  for (const [id, email] of [
    [actors.a, "pilot-control-concurrency-a@mise.test"],
    [actors.b, "pilot-control-concurrency-b@mise.test"]
  ]) {
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
      ($1, 'Pilot Control Concurrency A', 'Cafe', 'UTC'),
      ($2, 'Pilot Control Concurrency B', 'Cafe', 'UTC')`,
    [restaurants.a, restaurants.b]
  );
  await admin.query(
    `insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
      ($1, $2, 'owner', 'active'), ($3, $4, 'owner', 'active')`,
    [restaurants.a, actors.a, restaurants.b, actors.b]
  );
  await admin.query(
    `insert into public.pos_integrations (id, restaurant_id, provider, status) values
      ('e5000000-0000-4000-8000-000000000011', $1, 'square', 'connected'),
      ('e5000000-0000-4000-8000-000000000012', $2, 'square', 'connected')`,
    [restaurants.a, restaurants.b]
  );
  await admin.query(
    `insert into public.pos_locations (
      id, restaurant_id, pos_integration_id, external_location_id, display_name, timezone, status
    ) values
      ('e5000000-0000-4000-8000-000000000021', $1,
       'e5000000-0000-4000-8000-000000000011', 'pilot-race-a', 'Pilot Race A', 'UTC', 'active'),
      ('e5000000-0000-4000-8000-000000000022', $2,
       'e5000000-0000-4000-8000-000000000012', 'pilot-race-b', 'Pilot Race B', 'UTC', 'active')`,
    [restaurants.a, restaurants.b]
  );
  await admin.query(
    `insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
      ('e5000000-0000-4000-8000-000000000031', $1, 'Pilot Race Supplier A', 'pilot race supplier a'),
      ('e5000000-0000-4000-8000-000000000032', $2, 'Pilot Race Supplier B', 'pilot race supplier b')`,
    [restaurants.a, restaurants.b]
  );
  await admin.query(
    `insert into public.restaurant_email_connections (
      id, restaurant_id, provider, status, sender_email, last_verified_at
    ) values
      ('e5000000-0000-4000-8000-000000000041', $1, 'gmail', 'connected', 'pilot-race-a@mise.test', now()),
      ('e5000000-0000-4000-8000-000000000042', $2, 'gmail', 'connected', 'pilot-race-b@mise.test', now())`,
    [restaurants.a, restaurants.b]
  );
  await admin.query(
    `insert into public.supplier_recipients (
      id, restaurant_id, supplier_id, supplier_name, email
    ) values
      ('e5000000-0000-4000-8000-000000000051', $1,
       'e5000000-0000-4000-8000-000000000031', 'Pilot Race Supplier A', 'recipient-race-a@mise.test'),
      ('e5000000-0000-4000-8000-000000000052', $2,
       'e5000000-0000-4000-8000-000000000032', 'Pilot Race Supplier B', 'recipient-race-b@mise.test')`,
    [restaurants.a, restaurants.b]
  );
}

async function resetDomains(admin) {
  await admin.query(
    `update public.system_operational_controls
     set operational_mode = 'normal',
         square_sync_enabled = false,
         square_webhooks_enabled = false,
         gmail_delivery_enabled = false,
         ordering_policy = 'off',
         order_drafting_enabled = false,
         updated_by = null
     where singleton`
  );
  await admin.query(
    `update public.restaurant_operational_controls
     set square_sync_enabled = false,
         square_webhooks_enabled = false,
         gmail_delivery_enabled = false,
         ordering_policy = 'off',
         order_drafting_enabled = false,
         updated_by = null
     where restaurant_id = any($1::uuid[])`,
    [[restaurants.a, restaurants.b]]
  );
}

const admin = client();
const first = client();
const second = client();
let originalSystemControls;

try {
  await Promise.all([admin.connect(), first.connect(), second.connect()]);
  originalSystemControls = (await admin.query(
    `select operational_mode, square_sync_enabled, square_webhooks_enabled,
       gmail_delivery_enabled, ordering_policy, order_drafting_enabled, updated_by
     from public.system_operational_controls where singleton`
  )).rows[0];
  await setup(admin);
  await resetDomains(admin);

  // Shared gate starts closed. A applies but holds its transaction while B
  // reaches the singleton lock. After A commits, B must re-read the occupied
  // Square domain and fail instead of passing a stale other-tenant check.
  await beginService(first);
  const firstEnable = await applyControl(first, {
    requestId: requests.concurrentA,
    restaurantId: restaurants.a,
    action: "enable-square-sync",
    actorId: actors.a,
    reason: "concurrency_square_a"
  });
  assert.equal(firstEnable.outcome, "applied");

  await beginService(second);
  const secondEnablePromise = applyControl(second, {
    requestId: requests.concurrentB,
    restaurantId: restaurants.b,
    action: "enable-square-sync",
    actorId: actors.b,
    reason: "concurrency_square_b"
  });
  await waitForDatabaseLock(admin, second.processID, "concurrent restaurant enable");

  const beforeCommit = await admin.query(
    `select
      (select square_sync_enabled from public.system_operational_controls where singleton) system_enabled,
      (select count(*) from private.pilot_operational_control_changes
       where request_id in ($1, $2)) audit_count`,
    [requests.concurrentA, requests.concurrentB]
  );
  assert.equal(beforeCommit.rows[0].system_enabled, false, "uncommitted control state stays invisible");
  assert.equal(Number(beforeCommit.rows[0].audit_count), 0, "uncommitted audit stays invisible with state");

  await first.query("commit");
  let secondEnableError;
  try {
    await secondEnablePromise;
  } catch (error) {
    secondEnableError = error;
  }
  assert.equal(secondEnableError?.code, "55000", "only one concurrent restaurant acquires the shared Square domain");
  await second.query("rollback");

  const sharedGateResult = await admin.query(
    `select
      (select square_sync_enabled from public.system_operational_controls where singleton) system_enabled,
      (select count(*) from public.restaurant_operational_controls
       where restaurant_id = any($1::uuid[]) and square_sync_enabled) enabled_restaurants,
      (select count(*) from private.pilot_operational_control_changes
       where request_id in ($2, $3)) audit_count`,
    [[restaurants.a, restaurants.b], requests.concurrentA, requests.concurrentB]
  );
  assert.equal(sharedGateResult.rows[0].system_enabled, true);
  assert.equal(Number(sharedGateResult.rows[0].enabled_restaurants), 1);
  assert.equal(Number(sharedGateResult.rows[0].audit_count), 1);

  // A forced audit failure occurs after the function has issued both updates.
  // PostgreSQL must roll the whole statement back, including both control rows.
  await resetDomains(admin);
  await admin.query(
    `create function private.test_fail_pilot_control_concurrency_audit()
     returns trigger language plpgsql security invoker set search_path = '' as $$
     begin
       if new.reason_code = 'force_concurrency_audit_failure' then
         raise exception using errcode = '55000', message = 'forced pilot concurrency audit failure';
       end if;
       return new;
     end;
     $$`
  );
  await admin.query(
    `create trigger test_fail_pilot_control_concurrency_audit
     before insert on private.pilot_operational_control_changes
     for each row execute function private.test_fail_pilot_control_concurrency_audit()`
  );
  await first.query("set role service_role");
  await assert.rejects(
    applyControl(first, {
      requestId: requests.failedAudit,
      restaurantId: restaurants.a,
      action: "enable-order-drafting",
      actorId: actors.a,
      reason: "force_concurrency_audit_failure"
    }),
    (error) => error?.code === "55000"
  );
  await first.query("reset role");
  await admin.query("drop trigger test_fail_pilot_control_concurrency_audit on private.pilot_operational_control_changes");
  await admin.query("drop function private.test_fail_pilot_control_concurrency_audit()");
  const rollbackResult = await admin.query(
    `select
      (select order_drafting_enabled from public.system_operational_controls where singleton) system_enabled,
      (select order_drafting_enabled from public.restaurant_operational_controls where restaurant_id = $1) restaurant_enabled,
      (select count(*) from private.pilot_operational_control_changes where request_id = $2) audit_count`,
    [restaurants.a, requests.failedAudit]
  );
  assert.equal(rollbackResult.rows[0].system_enabled, false);
  assert.equal(rollbackResult.rows[0].restaurant_enabled, false);
  assert.equal(Number(rollbackResult.rows[0].audit_count), 0);

  // Exact concurrent retry request: one applied response, one immutable replay,
  // and one audit row.
  await admin.query(
    "update public.system_operational_controls set square_sync_enabled = true where singleton"
  );
  await admin.query(
    `update public.restaurant_operational_controls set square_sync_enabled = true
     where restaurant_id = $1`,
    [restaurants.a]
  );
  await beginService(first);
  const firstDuplicate = await applyControl(first, {
    requestId: requests.duplicate,
    restaurantId: restaurants.a,
    action: "disable-square",
    actorId: actors.a,
    reason: "concurrent_exact_retry"
  });
  await beginService(second);
  const secondDuplicatePromise = applyControl(second, {
    requestId: requests.duplicate,
    restaurantId: restaurants.a,
    action: "disable-square",
    actorId: actors.a,
    reason: "concurrent_exact_retry"
  });
  await waitForDatabaseLock(admin, second.processID, "exact request replay");
  await first.query("commit");
  const secondDuplicate = await secondDuplicatePromise;
  await second.query("commit");
  assert.deepEqual(
    [firstDuplicate.outcome, secondDuplicate.outcome].sort(),
    ["already_applied", "applied"]
  );
  assert.equal(firstDuplicate.auditId, secondDuplicate.auditId);
  assert.equal(Number((await admin.query(
    "select count(*) count from private.pilot_operational_control_changes where request_id = $1",
    [requests.duplicate]
  )).rows[0].count), 1);

  // Narrow disable remains isolated even if another restaurant's same-domain
  // tenant gate is already on.
  await admin.query("update public.system_operational_controls set gmail_delivery_enabled = true where singleton");
  await admin.query(
    `update public.restaurant_operational_controls set gmail_delivery_enabled = true
     where restaurant_id = any($1::uuid[])`,
    [[restaurants.a, restaurants.b]]
  );
  await first.query("set role service_role");
  const isolatedDisable = await applyControl(first, {
    requestId: requests.disableIsolation,
    restaurantId: restaurants.a,
    action: "disable-gmail-delivery",
    actorId: actors.a,
    reason: "isolated_tenant_disable"
  });
  await first.query("reset role");
  assert.equal(isolatedDisable.outcome, "applied");
  const isolatedState = await admin.query(
    `select restaurant_id, gmail_delivery_enabled
     from public.restaurant_operational_controls
     where restaurant_id = any($1::uuid[]) order by restaurant_id`,
    [[restaurants.a, restaurants.b]]
  );
  assert.deepEqual(isolatedState.rows, [
    { restaurant_id: restaurants.a, gmail_delivery_enabled: false },
    { restaurant_id: restaurants.b, gmail_delivery_enabled: true }
  ]);

  // Different domains share only the short system-row transaction boundary;
  // the waiting Gmail command must succeed after the Square command commits.
  await resetDomains(admin);
  await beginService(first);
  const squareDomain = await applyControl(first, {
    requestId: requests.squareDomain,
    restaurantId: restaurants.a,
    action: "enable-square-sync",
    actorId: actors.a,
    reason: "independent_square_domain"
  });
  await beginService(second);
  const gmailDomainPromise = applyControl(second, {
    requestId: requests.gmailDomain,
    restaurantId: restaurants.b,
    action: "enable-gmail-delivery",
    actorId: actors.b,
    reason: "independent_gmail_domain"
  });
  await waitForDatabaseLock(admin, second.processID, "different control domain");
  await first.query("commit");
  const gmailDomain = await gmailDomainPromise;
  await second.query("commit");
  assert.equal(squareDomain.outcome, "applied");
  assert.equal(gmailDomain.outcome, "applied");
  const independentState = await admin.query(
    `select
      (select square_sync_enabled from public.restaurant_operational_controls where restaurant_id = $1) square_a,
      (select gmail_delivery_enabled from public.restaurant_operational_controls where restaurant_id = $2) gmail_b,
      (select count(*) from private.pilot_operational_control_changes where request_id in ($3, $4)) audit_count`,
    [restaurants.a, restaurants.b, requests.squareDomain, requests.gmailDomain]
  );
  assert.equal(independentState.rows[0].square_a, true);
  assert.equal(independentState.rows[0].gmail_b, true);
  assert.equal(Number(independentState.rows[0].audit_count), 2);

  console.log("Atomic pilot operational control concurrency regressions passed (22 assertions).");
} finally {
  for (const connection of [first, second]) {
    try { await connection.query("rollback"); } catch {}
    try { await connection.query("reset role"); } catch {}
  }
  try {
    await admin.query("drop trigger if exists test_fail_pilot_control_concurrency_audit on private.pilot_operational_control_changes");
    await admin.query("drop function if exists private.test_fail_pilot_control_concurrency_audit()");
  } catch {}
  if (originalSystemControls) {
    try {
      await admin.query(
        `update public.system_operational_controls
         set operational_mode = $1,
             square_sync_enabled = $2,
             square_webhooks_enabled = $3,
             gmail_delivery_enabled = $4,
             ordering_policy = $5,
             order_drafting_enabled = $6,
             updated_by = $7
         where singleton`,
        [
          originalSystemControls.operational_mode,
          originalSystemControls.square_sync_enabled,
          originalSystemControls.square_webhooks_enabled,
          originalSystemControls.gmail_delivery_enabled,
          originalSystemControls.ordering_policy,
          originalSystemControls.order_drafting_enabled,
          originalSystemControls.updated_by
        ]
      );
    } catch {}
  }
  try { await admin.query("delete from public.restaurants where id = any($1::uuid[])", [[restaurants.a, restaurants.b]]); } catch {}
  try { await admin.query("delete from auth.users where id = any($1::uuid[])", [[actors.a, actors.b]]); } catch {}
  await Promise.allSettled([first.end(), second.end(), admin.end()]);
}
