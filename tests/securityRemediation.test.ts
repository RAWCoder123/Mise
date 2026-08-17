import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { HttpError, MAX_JSON_BODY_BYTES, readJsonObject } from "../supabase/functions/_shared/http";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import {
  EXTERNAL_ERROR_MESSAGE,
  TELEMETRY_MAX_PAYLOAD_BYTES,
  safeExternalError,
  sanitizeTelemetryRecord
} from "../services/domain/telemetrySecurity";
import { ORDER_MESSAGE_MAX_BYTES, utf8ByteLength } from "../services/domain/securityLimits";
import { buildSupplierOrderMessage } from "../services/domain/miseDomain";
import {
  requireRestaurantName,
  requireRestaurantProfilePatch,
  requireSupplierOperatorNote
} from "../services/miseValidation";
import { captureMiseError } from "../services/telemetry";
import { buildSupplierDraftPresentation } from "../utils/orderPresentation";

test("Edge JSON reader accepts exactly 64 KiB and rejects oversized or missing lengths", async () => {
  const prefix = '{"value":"';
  const suffix = '"}';
  const exact = `${prefix}${"a".repeat(MAX_JSON_BODY_BYTES - prefix.length - suffix.length)}${suffix}`;
  const accepted = new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": String(MAX_JSON_BODY_BYTES) },
    body: exact
  });
  assert.equal((await readJsonObject(accepted)).value, "a".repeat(MAX_JSON_BODY_BYTES - prefix.length - suffix.length));

  const oversized = new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": String(MAX_JSON_BODY_BYTES + 1) },
    body: `${exact}x`
  });
  await assert.rejects(() => readJsonObject(oversized), (error: unknown) => error instanceof HttpError && error.status === 413);

  const missingLength = new Request("https://example.test", { method: "POST", body: "{}" });
  await assert.rejects(() => readJsonObject(missingLength), (error: unknown) => error instanceof HttpError && error.status === 411);

  const oneByteBody = new TextEncoder().encode('{"value":"micro-chunks"}');
  const microChunks = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of oneByteBody) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    }
  });
  const microChunkRequest = new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": String(oneByteBody.byteLength) },
    body: microChunks,
    // Node requires this for a streaming request body; Edge Request ignores it.
    duplex: "half"
  } as RequestInit & { duplex: "half" });
  assert.deepEqual(await readJsonObject(microChunkRequest), { value: "micro-chunks" });
});

test("every Edge handler authenticates before body processing and closes accepted reservations", () => {
  const sharedSecurity = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  assert.match(sharedSecurity, /authorizationMatch/);
  assert.match(sharedSecurity, /securitySupabase\.auth\.getUser\(accessToken\)/);

  for (const name of [
    "generate-ai-insights",
    "link-gmail",
    "send-supplier-email",
    "sync-pos-sales",
    "operational-workflows",
    "delete-account",
    "export-restaurant-data"
  ]) {
    const source = readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
    assert.ok(
      source.indexOf("requireAuthenticatedContext(req)") < source.indexOf("readJsonObject(req)"),
      `${name} authenticates before reading the request body`
    );
    assert.match(source, /recordFunctionTerminalError\(terminalContext\)/);
  }
  const parser = readFileSync("supabase/functions/_shared/http.ts", "utf8");
  assert.doesNotMatch(parser, /req\.json\(\)/);
  assert.doesNotMatch(parser, /Uint8Array\[\]/);
  assert.match(parser, /new Uint8Array\(contentLength\)/);
  assert.match(parser, /nextReceivedBytes\s*>\s*maximumBytes/);
});

test("supplier notes, restaurant names, and generated messages stop at their authoritative limits", () => {
  assert.equal(requireSupplierOperatorNote("x".repeat(2000))?.length, 2000);
  assert.throws(() => requireSupplierOperatorNote("x".repeat(2001)), /2,000 characters/);
  assert.equal(requireRestaurantName("R".repeat(120)).length, 120);
  assert.throws(() => requireRestaurantName("R".repeat(121)), /between 1 and 120/);

  const recommendation = {
    id: "rec-1",
    restaurant_id: "restaurant-1",
    inventory_item_id: "item-1",
    item_name: "Tomatoes",
    supplier_name: "Fresh Produce",
    recommended_quantity: 10,
    unit: "lb",
    reason: "Low",
    urgency: "high" as const,
    status: "approved" as const,
    supplier_order_id: null,
    created_at: new Date().toISOString()
  };
  const message = buildSupplierOrderMessage("Fresh Produce", [recommendation], "🍅".repeat(2000));
  assert.ok(utf8ByteLength(message) <= ORDER_MESSAGE_MAX_BYTES);
});

test("restaurant profile validation enforces exact private-beta boundaries", () => {
  const validProfile = {
    serviceStyle: "fast_casual" as const,
    orderCadence: ["Monday"],
    prepWindows: ["Before lunch"],
    primarySuppliers: ["Fresh Produce"],
    inventoryReviewDays: ["Friday"],
    notes: "Count before ordering"
  };
  const exactLogoPrefix = "https://example.test/";
  const exactLogo = `${exactLogoPrefix}${"a".repeat(2048 - exactLogoPrefix.length)}`;
  assert.equal(
    requireRestaurantProfilePatch({
      name: "R".repeat(120),
      address: "A".repeat(500),
      cuisine_type: "C".repeat(120),
      brand_color: "#EF3F27",
      accent_color: "#1E7A46",
      logo_url: exactLogo,
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD",
      operational_profile: validProfile
    }).logo_url,
    exactLogo
  );

  assert.throws(() => requireRestaurantProfilePatch({ address: "A".repeat(501) }), /500 characters/);
  assert.throws(() => requireRestaurantProfilePatch({ cuisine_type: "C".repeat(121) }), /120 characters/);
  assert.throws(() => requireRestaurantProfilePatch({ logo_url: "http://example.test/logo.png" }), /HTTPS/);
  assert.throws(() => requireRestaurantProfilePatch({ timezone: "Mars/Olympus_Mons" }), /IANA timezone/);
  assert.throws(() => requireRestaurantProfilePatch({ currency: "usd" }), /three-letter uppercase/);
  assert.throws(
    () => requireRestaurantProfilePatch({ operational_profile: { ...validProfile, orderCadence: Array(21).fill("Daily") } }),
    /20 entries/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ operational_profile: { ...validProfile, orderCadence: ["x".repeat(161)] } }),
    /160 characters/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ operational_profile: { ...validProfile, notes: "n".repeat(2001) } }),
    /2000 characters/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({
      operational_profile: {
        ...validProfile,
        orderCadence: Array(20).fill("é".repeat(160)),
        prepWindows: Array(20).fill("é".repeat(160)),
        primarySuppliers: Array(20).fill("é".repeat(160)),
        inventoryReviewDays: Array(20).fill("é".repeat(160))
      }
    }),
    /16384 bytes/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ service_style: "cafe", operational_profile: validProfile }),
    /must match/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ unexpected: "field" } as never),
    /not supported/
  );
  assert.throws(
    () => requireRestaurantProfilePatch({
      operational_profile: { ...validProfile, unexpected: "field" } as never
    }),
    /not supported/
  );
});

test("telemetry removes raw errors and secrets while bounding payload cost", async () => {
  const unsafeError = Object.assign(new Error("raw-message secret-marker password=hunter2"), {
    code: "SAFE_CODE"
  });
  assert.deepEqual(safeExternalError(unsafeError), {
    type: "Error",
    value: EXTERNAL_ERROR_MESSAGE,
    code: "SAFE_CODE"
  });
  const sanitized = sanitizeTelemetryRecord({
    authorization: "Bearer secret-value",
    nested: { password: "hunter2", safe: "x".repeat(400) },
    rows: Array.from({ length: 30 }, (_, index) => index)
  });
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /hunter2|secret-value/);
  assert.equal((sanitized.rows as unknown[]).length, 20);
  assert.equal((sanitized.nested as Record<string, string>).safe!.length, 256);
  assert.ok(utf8ByteLength(serialized) <= TELEMETRY_MAX_PAYLOAD_BYTES);

  const priorDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const priorEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
  const priorFetch = globalThis.fetch;
  let envelope = "";
  try {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.test/42";
    process.env.EXPO_PUBLIC_APP_ENV = "production";
    globalThis.fetch = (async (_input, init) => {
      envelope = String(init?.body ?? "");
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    captureMiseError(unsafeError, {
      restaurant_id: "restaurant-1",
      api_key: "secret-value",
      details: { raw: "safe context" }
    });
    await Promise.resolve();
  } finally {
    if (priorDsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    else process.env.EXPO_PUBLIC_SENTRY_DSN = priorDsn;
    if (priorEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = priorEnvironment;
    globalThis.fetch = priorFetch;
  }
  assert.match(envelope, /Mise operation failed\./);
  assert.match(envelope, /SAFE_CODE/);
  assert.doesNotMatch(envelope, /raw-message|hunter2|secret-value/);
});

test("supplier presentation scans only the bounded message and retains the display cap", () => {
  const orderMessage = `Order draft for Supplier\n\n${"Tomatoes - 1 lb\n".repeat(20_000)}`;
  const presentation = buildSupplierDraftPresentation({
    id: "order-1",
    restaurant_id: "restaurant-1",
    supplier_name: "Supplier",
    order_message: orderMessage,
    operator_note: null,
    status: "draft",
    delivery_date: null,
    created_at: new Date().toISOString()
  });
  assert.equal(presentation.lines.length, 5);
  assert.ok(presentation.itemCount < 20_000);
  assert.equal(presentation.hiddenLineCount, presentation.itemCount - 5);
});

test("server-shared operational rules are deterministic and reject anomalous history as learned authority", () => {
  const snapshot = {
    restaurantId: "restaurant-1",
    operatingDate: "2026-07-14",
    inventoryItems: [{
      id: "item-1",
      restaurant_id: "restaurant-1",
      item_name: "Tomatoes",
      supplier_name: "Fresh Produce",
      unit: "lb",
      current_quantity: 1,
      par_level: 20,
      reorder_threshold: 5,
      last_updated: "2026-07-14T12:00:00.000Z",
      last_counted_at: "2026-07-14T12:00:00.000Z"
    }],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [1, 1, 999_999].map((quantity, index) => ({
      inventory_item_id: "item-1",
      recommended_quantity: quantity,
      unit: "lb",
      status: "approved",
      created_at: `2026-07-1${index + 1}T12:00:00.000Z`
    }))
  };
  const first = calculateOperationalSignals(snapshot);
  const second = calculateOperationalSignals(snapshot);
  assert.deepEqual(
    first.recommendations.map(({ reason: _reason, ...recommendation }) => recommendation),
    second.recommendations.map(({ reason: _reason, ...recommendation }) => recommendation)
  );
  assert.equal(first.recommendations[0]?.recommended_quantity, 19);
  assert.equal(first.recommendations[0]?.urgency, "medium");
});

test("security migrations enforce server authority, quotas, staging identity, and terminal uniqueness", () => {
  const authority = readFileSync("supabase/migrations/20260714183310_secure_operational_workflows.sql", "utf8");
  const bounds = readFileSync("supabase/migrations/20260714183313_bound_resources_and_staging_identity.sql", "utf8");
  const terminal = readFileSync("supabase/migrations/20260713100023_harden_workflow_authority.sql", "utf8");
  const allocation = readFileSync("supabase/migrations/20260715164427_close_workspace_allocation_churn.sql", "utf8");
  const deferred = readFileSync("supabase/migrations/20260715164843_harden_profile_ai_and_order_boundaries.sql", "utf8");
  assert.match(authority, /generation_source[\s\S]*planning_revision[\s\S]*signals_revision/i);
  assert.match(authority, /revoke\s+all[\s\S]*replace_pending_purchase_recommendations[\s\S]*authenticated/i);
  assert.match(authority, /service_update_inventory_and_signals[\s\S]*errcode\s*=\s*'40001'/i);
  assert.match(bounds, /pg_advisory_xact_lock[\s\S]*owner-workspace-quota/i);
  assert.match(bounds, /active_owner_workspace_count\s*>=\s*5/i);
  assert.match(bounds, /operator_note[\s\S]*2000[\s\S]*octet_length\(order_message\)\s*<=\s*65536/i);
  assert.match(bounds, /verify_staging_identity/i);
  assert.match(terminal, /edge_function_security_events_terminal_once_idx/i);
  assert.match(allocation, /restaurant_workspace_allocations[\s\S]*lifetime_workspace_count[\s\S]*>=\s*5/i);
  assert.match(allocation, /guard_last_active_restaurant_owner[\s\S]*pg_advisory_xact_lock/i);
  assert.match(deferred, /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.ai_insights\s+from\s+authenticated/i);
  assert.match(deferred, /service_create_rules_engine_ai_insight[\s\S]*'rules_engine'[\s\S]*'edge_function_scaffold'/i);
  assert.match(deferred, /update_restaurant_profile[\s\S]*revoke\s+update\s+on\s+public\.restaurants/i);
  assert.match(deferred, /bounded_recommendations[\s\S]*limit\s+1000[\s\S]*65536/i);
  const aiFunction = readFileSync("supabase/functions/generate-ai-insights/index.ts", "utf8");
  assert.match(aiFunction, /"blocked"[\s\S]*"ai_insight_generation_blocked"/i);
  assert.doesNotMatch(aiFunction, /service_create_rules_engine_ai_insight/i);
  assert.doesNotMatch(aiFunction, /\.from\("ai_insights"\)[\s\S]*\.insert\(/i);
  const edgeShared = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  assert.doesNotMatch(edgeShared, /console\.error\(error\)/i);
  assert.match(edgeShared, /safeExternalError\(error\)/i);
});

test("tenant reinforcement makes membership and profile authority RPC-only", () => {
  const migration = readFileSync(
    "supabase/migrations/20260716204112_reinforce_tenant_isolation.sql",
    "utf8"
  );
  const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const edgeShared = readFileSync("supabase/functions/_shared/mise.ts", "utf8");

  assert.match(migration, /revoke all on all tables in schema public from public, anon, authenticated, service_role/i);
  assert.match(migration, /drop policy if exists "Owners and admins can invite restaurant members"/i);
  assert.match(migration, /create or replace function public\.add_restaurant_member/i);
  assert.match(migration, /create or replace function public\.update_restaurant_member/i);
  assert.match(migration, /create or replace function public\.remove_restaurant_member/i);
  assert.match(migration, /p_target_user_id\s*=\s*actor_user_id/i);
  assert.match(migration, /target_membership\.role\s*=\s*'owner'[\s\S]*Owners cannot be changed by a client/i);
  assert.match(migration, /Admins may manage only manager and staff memberships/i);
  assert.match(migration, /create or replace function public\.update_my_profile/i);
  assert.match(migration, /edge_function_security_events_reservation_tenant_fkey/i);
  assert.match(migration, /service_record_edge_audit_log[\s\S]*actor_has_restaurant_role/i);
  assert.match(repository, /rpc\("add_restaurant_member"/i);
  assert.match(repository, /rpc\("update_restaurant_member"/i);
  assert.match(repository, /rpc\("remove_restaurant_member"/i);
  assert.match(edgeShared, /rpc\("service_record_edge_audit_log"/i);
  assert.doesNotMatch(edgeShared, /securitySupabase\.from\("audit_logs"\)\.insert/i);
});

test("staging preflight rejects wrong origins before trusted values can be transmitted", async () => {
  // JavaScript harness modules are intentionally outside the Expo TypeScript graph.
  // @ts-ignore
  const { assertStagingPreflight, validateStagingTarget } = await import("../scripts/staging-preflight.mjs");
  const projectRef = "abcdefghijklmnopqrst";
  assert.equal(
    validateStagingTarget(`https://${projectRef}.supabase.co`, projectRef).url,
    `https://${projectRef}.supabase.co`
  );
  assert.throws(() => validateStagingTarget(`http://${projectRef}.supabase.co`, projectRef), /exactly match/);
  assert.throws(() => validateStagingTarget("https://127.0.0.1", projectRef), /exactly match/);
  assert.throws(() => validateStagingTarget("https://wrong.supabase.co", projectRef), /exactly match/);

  let transmitted = "";
  await assertStagingPreflight(
    {
      NODE_ENV: "test",
      SUPABASE_STAGING_URL: `https://${projectRef}.supabase.co`,
      SUPABASE_STAGING_PROJECT_REF: projectRef,
      SUPABASE_STAGING_ANON_KEY: "public-anon-sentinel",
      SUPABASE_STAGING_SECRET_KEY: "must-not-transmit",
      MISE_STAGING_MARKER: "mise-staging-marker-2026",
      MISE_STAGING_SEED_PASSWORD: "must-not-transmit"
    },
    async (_url: URL | RequestInfo, options?: RequestInit) => {
      transmitted = JSON.stringify(options);
      return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
    }
  );
  assert.doesNotMatch(transmitted, /must-not-transmit/);
  assert.match(transmitted, /public-anon-sentinel/);
});

test("QA child environments exclude service keys and passwords", async () => {
  // @ts-ignore
  const { publicQaEnv, trustedHostedChildEnv } = await import("../scripts/safe-env.mjs");
  const source = {
    NODE_ENV: "test" as const,
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    SUPABASE_STAGING_SECRET_KEY: "service-sentinel",
    MISE_STAGING_SEED_PASSWORD: "password-sentinel",
    SUPABASE_STAGING_ANON_KEY: "anon-sentinel"
  };
  const qa = publicQaEnv(
    { EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-sentinel" },
    source
  ) as Record<string, string | undefined>;
  assert.equal(qa.SUPABASE_STAGING_SECRET_KEY, undefined);
  assert.equal(qa.MISE_STAGING_SEED_PASSWORD, undefined);
  assert.equal(qa.EXPO_PUBLIC_SUPABASE_ANON_KEY, "anon-sentinel");
  const trusted = trustedHostedChildEnv({}, source) as Record<string, string | undefined>;
  assert.equal(trusted.SUPABASE_STAGING_SECRET_KEY, "service-sentinel");
});

test("final SQL function inventory handles plain create, replace, alter, and unknown privileged DDL", async () => {
  // @ts-ignore
  const { buildFinalFunctionInventory } = await import("../scripts/sql-function-inventory.mjs");
  const inventory = buildFinalFunctionInventory([{ path: "fixture.sql", sql: `
    create function public.example() returns boolean language sql security definer set search_path = '' as $$ select true $$;
    revoke all on function public.example() from public, anon, authenticated, service_role;
    grant execute on function public.example() to authenticated;
    create or replace function public.example() returns boolean language sql security invoker set search_path = '' as $$ select true $$;
    alter function public.example() security definer;
    create procedure public.unrecognized() language sql security definer as $$ select 1 $$;
  ` }]);
  assert.equal(inventory.functions.get("public.example")?.securityMode, "definer");
  assert.deepEqual([...inventory.functions.get("public.example")!.executeRoles], ["authenticated"]);
  assert.equal(inventory.unrecognizedPrivilegedStatements.length, 1);

  const replaced = buildFinalFunctionInventory([{ path: "fixture.sql", sql: `
    create function public.stale() returns boolean language sql security definer set search_path = '' as $$ select true $$;
    create or replace function public.stale() returns boolean language sql security invoker set search_path = '' as $$ select true $$;
  ` }]);
  assert.equal(replaced.functions.get("public.stale")?.securityMode, "invoker");
});
