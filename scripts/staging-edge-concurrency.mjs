import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertStagingPreflight } from "./staging-preflight.mjs";

const url = process.env.SUPABASE_STAGING_URL;
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const password = process.env.MISE_STAGING_SEED_PASSWORD;

if (!url || !anonKey || !password || !process.env.SUPABASE_STAGING_PROJECT_REF || !process.env.MISE_STAGING_MARKER) {
  console.error(
    "Set SUPABASE_STAGING_URL, SUPABASE_STAGING_ANON_KEY, and MISE_STAGING_SEED_PASSWORD before running Edge concurrency checks."
  );
  process.exit(1);
}

await assertStagingPreflight();

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tenantAOrderId = "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa";
const tenantBOrderId = "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb";

function publicClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function sessionFor(email) {
  const client = publicClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  assert.ok(data.session?.access_token, `${email} did not return an access token`);
  return { client, token: data.session.access_token };
}

async function invoke(functionName, token, body) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
}

async function invokeRaw(functionName, token, body, headers = {}, options = {}) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...headers
    },
    body,
    ...options
  });
  return response.status;
}

async function countTenantRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", tenantA);
  if (error) throw error;
  return count ?? 0;
}

const switcher = await sessionFor("switcher@mise-staging.test");
const managerA = await sessionFor("manager-a@mise-staging.test");
const staffA = await sessionFor("staff-a@mise-staging.test");
const ownerA = await sessionFor("owner-a@mise-staging.test");
const salesImportsBefore = await countTenantRows(managerA.client, "sales_imports");
const aiInsightsBefore = await countTenantRows(managerA.client, "ai_insights");

const sameTenantInvocations = [
  {
    functionName: "sync-pos-sales",
    token: managerA.token,
    body: {
      restaurantId: tenantA,
      provider: "manual_csv",
      from: new Date(Date.now() - 86_400_000).toISOString(),
      to: new Date().toISOString()
    },
    allowedStatuses: [501, 503]
  },
  {
    functionName: "generate-ai-insights",
    token: managerA.token,
    body: { restaurantId: tenantA },
    allowedStatuses: [501, 503]
  },
  {
    functionName: "link-gmail",
    token: ownerA.token,
    body: { restaurantId: tenantA },
    allowedStatuses: [501, 503]
  },
  {
    functionName: "send-supplier-email",
    token: managerA.token,
    body: { restaurantId: tenantA, orderId: tenantAOrderId },
    allowedStatuses: [409, 501, 503]
  },
  {
    functionName: "operational-workflows",
    token: managerA.token,
    body: { action: "refresh_signals", restaurantId: tenantA },
    allowedStatuses: [200]
  }
];

for (const invocation of sameTenantInvocations) {
  const response = await invoke(invocation.functionName, invocation.token, invocation.body);
  assert.ok(
    invocation.allowedStatuses.includes(response.status),
    `${invocation.functionName} must pass the source-tenant role boundary before its bounded unavailable result; received ${response.status}`
  );
}

const oversizedBody = JSON.stringify({
  restaurantId: tenantA,
  provider: "manual_csv",
  from: new Date(Date.now() - 86_400_000).toISOString(),
  to: new Date().toISOString(),
  padding: "x".repeat(65_536)
});
assert.equal(
  await invokeRaw("sync-pos-sales", switcher.token, oversizedBody),
  413,
  "oversized Edge JSON is rejected before reservation work"
);

const missingLengthStream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ restaurantId: tenantA })));
    controller.close();
  }
});
const missingLengthStatus = await invokeRaw(
  "sync-pos-sales",
  switcher.token,
  missingLengthStream,
  {},
  { duplex: "half" }
);
assert.ok(
  [400, 411].includes(missingLengthStatus),
  `the hosted gateway or Edge parser rejects chunked JSON without Content-Length; received ${missingLengthStatus}`
);

const auditBefore = await ownerA.client
  .from("audit_logs")
  .select("id", { count: "exact", head: true })
  .eq("restaurant_id", tenantA);
if (auditBefore.error) throw auditBefore.error;

const requests = Array.from({ length: 20 }, (_, index) =>
  invoke("sync-pos-sales", switcher.token, {
    restaurantId: tenantA,
    provider: "manual_csv",
    from: new Date(Date.now() - 86_400_000).toISOString(),
    to: new Date().toISOString(),
    attemptMarker: index,
    authorization: "must-not-enter-security-metadata"
  })
);
const responses = await Promise.all(requests);
const authorizedBlocked = responses.filter((response) => response.status === 501);
const rateLimited = responses.filter((response) => response.status === 429);
const unexpected = responses.filter((response) => response.status !== 501 && response.status !== 429);

assert.equal(unexpected.length, 0, `unexpected Edge statuses: ${unexpected.map((item) => item.status).join(", ")}`);
assert.equal(authorizedBlocked.length, 8, "the serialized 60-second window authorizes exactly 8 unavailable POS requests");
assert.equal(rateLimited.length, 12, "all concurrent requests beyond the policy return 429");
assert.ok(
  authorizedBlocked.every((response) => response.payload?.status === "provider_not_enabled"),
  "authorized POS scaffold requests fail closed without reporting queued work"
);
assert.ok(
  rateLimited.every((response) => response.payload?.status === "rate_limited"),
  "rate-limited responses use the bounded public error contract"
);

const crossTenantInvocations = [
  {
    functionName: "sync-pos-sales",
    token: managerA.token,
    body: {
      restaurantId: tenantB,
      provider: "manual_csv",
      from: new Date(Date.now() - 86_400_000).toISOString(),
      to: new Date().toISOString()
    }
  },
  {
    functionName: "generate-ai-insights",
    token: managerA.token,
    body: { restaurantId: tenantB }
  },
  {
    functionName: "link-gmail",
    token: ownerA.token,
    body: { restaurantId: tenantB }
  },
  {
    functionName: "send-supplier-email",
    token: managerA.token,
    body: { restaurantId: tenantB, orderId: tenantBOrderId }
  },
  {
    functionName: "operational-workflows",
    token: managerA.token,
    body: { action: "refresh_signals", restaurantId: tenantB }
  }
];

for (const invocation of crossTenantInvocations) {
  const response = await invoke(invocation.functionName, invocation.token, invocation.body);
  assert.equal(
    response.status,
    403,
    `a source-tenant-authorized caller cannot forge tenant B through ${invocation.functionName}`
  );
}

const staffGmail = await invoke("link-gmail", staffA.token, { restaurantId: tenantA });
assert.equal(staffGmail.status, 403, "staff cannot reserve an owner-only Gmail workflow");

const auditAfter = await ownerA.client
  .from("audit_logs")
  .select("id", { count: "exact", head: true })
  .eq("restaurant_id", tenantA);
if (auditAfter.error) throw auditAfter.error;
assert.equal(
  auditAfter.count,
  (auditBefore.count ?? 0) + authorizedBlocked.length,
  "only accepted POS requests create tenant audit events"
);
assert.equal(
  await countTenantRows(managerA.client, "sales_imports"),
  salesImportsBefore,
  "unavailable POS sync creates no queued or failed sales import rows"
);
assert.equal(
  await countTenantRows(managerA.client, "ai_insights"),
  aiInsightsBefore,
  "unavailable model generation creates no placeholder AI insight rows"
);

console.log("Mise hosted Edge concurrency, all-function tenant forgery, role, and rate-limit checks passed.");
