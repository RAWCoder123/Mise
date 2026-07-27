import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

import { assertStagingPreflight } from "./staging-preflight.mjs";

for (const name of [
  "SUPABASE_STAGING_URL",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_ANON_KEY",
  "MISE_STAGING_MARKER",
  "MISE_STAGING_SEED_PASSWORD"
]) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}
await assertStagingPreflight();

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const anonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const url = process.env.SUPABASE_STAGING_URL;
const password = process.env.MISE_STAGING_SEED_PASSWORD;
const protectedKeyPattern =
  /(?:^|_)(?:access_token|refresh_token|oauth_token|client_secret|api_key|password|authorization|pkce_verifier|claim_token|credential_id|secret_id)(?:$|_)/i;

const requiredDatasets = [
  "pos_sales",
  "inventory_items",
  "inventory_events",
  "menu_item_ingredients",
  "purchase_recommendations",
  "supplier_orders",
  "pos_integrations",
  "sales_imports",
  "insights",
  "supplier_items",
  "purchase_orders",
  "ai_insights",
  "restaurant_email_connections",
  "supplier_recipients",
  "setup_attachments",
  "restaurant_operational_controls",
  "pos_locations",
  "pos_catalog_item_mappings",
  "menu_items",
  "recipe_versions",
  "recipe_ingredients",
  "modifier_recipe_adjustments",
  "ingredient_substitutions",
  "audit_logs"
];

function client() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function signedClient(email) {
  const signed = client();
  const { data, error } = await signed.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error ?? new Error(`${email} could not sign in.`);
  return signed;
}

async function invoke(signed, restaurantId) {
  return signed.functions.invoke("export-restaurant-data", {
    body: { restaurantId }
  });
}

async function responseStatus(error) {
  if (!error || typeof error !== "object") return null;
  const response = error.context;
  return response instanceof Response ? response.status : null;
}

async function functionErrorDetail(error) {
  if (!error || typeof error !== "object") return "unknown function error";
  const response = error.context;
  if (!(response instanceof Response)) return String(error.message ?? "unknown function error").slice(0, 500);
  try {
    const payload = await response.clone().json();
    return String(payload?.error ?? payload?.message ?? "unknown function error").slice(0, 500);
  } catch {
    return `HTTP ${response.status}`;
  }
}

function assertTenantBound(value, path = "export") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertTenantBound(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assert.equal(protectedKeyPattern.test(key), false, `${path}.${key} must not expose protected provider data`);
    if (key === "restaurant_id") {
      assert.equal(nested, tenantA, `${path}.${key} must remain tenant A`);
    }
    assertTenantBound(nested, `${path}.${key}`);
  }
}

const ownerA = await signedClient("owner-a@mise-staging.test");
const managerA = await signedClient("manager-a@mise-staging.test");
const ownerB = await signedClient("owner-b@mise-staging.test");

const valid = await invoke(ownerA, tenantA);
if (valid.error) {
  throw new Error(`restaurant export failed: ${await functionErrorDetail(valid.error)}`);
}
const payload = valid.data;
assert.equal(payload?.schemaVersion, 1);
assert.equal(payload?.restaurantId, tenantA);
assert.equal(payload?.restaurant?.id, tenantA);
assert.equal(payload?.restaurant?.name, "Luna Bistro");
assert.equal(payload?.retention?.credentialsExcluded, true);
assert.equal(payload?.retention?.privateSecurityLogsExcluded, true);
assert.ok(Array.isArray(payload?.team) && payload.team.length >= 4);

for (const dataset of requiredDatasets) {
  assert.ok(Array.isArray(payload?.datasets?.[dataset]), `${dataset} must be present as an array`);
  assert.equal(
    payload.counts?.[dataset],
    payload.datasets[dataset].length,
    `${dataset} count must describe the complete dataset`
  );
}
assert.ok(
  payload.datasets.inventory_items.some((row) => row.id === "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"),
  "tenant A inventory must be represented"
);
assert.equal(
  JSON.stringify(payload).includes("bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb"),
  false,
  "tenant B inventory identity must not appear"
);
assertTenantBound(payload);

const managerDenied = await invoke(managerA, tenantA);
assert.ok(managerDenied.error, "manager export must be denied");
assert.equal(await responseStatus(managerDenied.error), 403);

const crossTenantDenied = await invoke(ownerB, tenantA);
assert.ok(crossTenantDenied.error, "tenant B owner cannot export tenant A");
assert.equal(await responseStatus(crossTenantDenied.error), 403);

const audit = await ownerA
  .from("audit_logs")
  .select("id,action,entity_id,metadata")
  .eq("restaurant_id", tenantA)
  .eq("action", "restaurant_data_export_completed")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (audit.error || !audit.data) throw audit.error ?? new Error("Export audit was not recorded.");
assert.equal(audit.data.entity_id, tenantA);
assert.equal(audit.data.metadata?.schema_version, 1);
assert.ok(Number(audit.data.metadata?.total_rows) > 0);

console.log(
  `Mise hosted restaurant export passed: ${requiredDatasets.length} tenant-scoped datasets, owner/admin authority, cross-tenant denial, bounded counts, and secret-free audit evidence.`
);
