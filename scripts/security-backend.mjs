import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildFinalFunctionInventory } from "./sql-function-inventory.mjs";
import {
  buildFinalAuthenticatedTablePrivileges,
  hasAuthenticatedTableDml,
  listAuthenticatedDmlPrivileges
} from "./sql-table-privileges.mjs";
import { minimalChildEnv } from "./safe-env.mjs";

const root = process.cwd();

const restaurantOwnedTables = new Set([
  "pos_sales",
  "inventory_items",
  "inventory_movements",
  "inventory_count_sessions",
  "inventory_count_lines",
  "storage_locations",
  "inventory_location_balances",
  "menu_item_ingredients",
  "purchase_recommendations",
  "supplier_orders",
  "insights",
  "pos_integrations",
  "sales_imports",
  "supplier_items",
  "purchase_orders",
  "ai_insights",
  "audit_logs",
  "restaurant_email_connections",
  "supplier_recipients",
  "setup_attachments"
]);

const tenantAuthorizationTables = new Set(["restaurant_memberships"]);
const publicUserScopedTables = new Set(["users", "account_deletion_requests"]);
const tenantRootTables = new Set(["restaurants"]);
const serviceOnlyPublicTables = new Set([
  "outreach_agent_runs",
  "outreach_campaigns",
  "outreach_enrollments",
  "outreach_events",
  "outreach_leads",
  "outreach_messages",
  "outreach_suppressions",
  "restaurant_member_invites"
]);
const edgeFunctionNames = ["sync-pos-sales", "generate-ai-insights", "link-gmail", "send-supplier-email", "operational-workflows", "export-restaurant-data"];
const userScopedEdgeFunctionNames = ["request-account-deletion"];
const accountOnboardingEdgeFunctionNames = ["account-onboarding"];
const providerCallbackEdgeFunctionNames = ["gmail-oauth-callback"];
const nonTenantEdgeFunctionNames = ["outreach-agent", "outreach-unsubscribe", "outreach-webhook"];
const classifiedEdgeFunctionNames = new Set([
  ...edgeFunctionNames,
  ...userScopedEdgeFunctionNames,
  ...accountOnboardingEdgeFunctionNames,
  ...providerCallbackEdgeFunctionNames,
  ...nonTenantEdgeFunctionNames
]);

const failures = [];

function listFiles(path) {
  const absolute = join(root, path);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return [];
  }

  if (stats.isFile()) return [path];
  return readdirSync(absolute).flatMap((entry) => {
    const next = join(path, entry);
    if (next.includes("node_modules") || next.includes(".expo")) return [];
    const nextStats = statSync(join(root, next));
    return nextStats.isDirectory() ? listFiles(next) : [next];
  });
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runRequired(label, command, args) {
  console.log(`\n${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: minimalChildEnv({ CI: "1" }),
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildFinalAuthenticatedPolicies(sql) {
  const policies = new Map();
  const statementPattern =
    /(?:create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-z_]+)([\s\S]*?);|drop\s+policy\s+if\s+exists\s+"([^"]+)"\s+on\s+public\.([a-z_]+)\s*;)/gi;

  for (const match of sql.matchAll(statementPattern)) {
    if (match[1]) {
      const name = match[1];
      const table = match[2];
      const body = match[3] ?? "";
      const cmd = (body.match(/\bfor\s+(select|insert|update|delete|all)\b/i)?.[1] ?? "all").toUpperCase();
      policies.set(`${table}\0${name}`, {
        table,
        name,
        cmd,
        block: match[0]
      });
      continue;
    }

    policies.delete(`${match[5]}\0${match[4]}`);
  }

  return [...policies.values()];
}

runRequired("Running existing static security checks...", process.execPath, ["scripts/security-static.mjs"]);

const sqlFiles = ["supabase/schema.sql", ...listFiles("supabase/migrations").filter((path) => path.endsWith(".sql"))];
const combinedSql = sqlFiles.map(read).join("\n");

const config = read("supabase/config.toml");
const postgresMajor = Number(config.match(/major_version\s*=\s*(\d+)/)?.[1] ?? 0);
if (!postgresMajor || postgresMajor < 15) {
  failures.push("supabase/config.toml: Supabase local Postgres major_version must be 15+ for supported private-beta testing.");
}

const configuredEdgeFunctionNames = [
  ...config.matchAll(/\[functions\.([a-z0-9-]+)\]/gi)
].map((match) => match[1]);
for (const functionName of configuredEdgeFunctionNames) {
  if (!classifiedEdgeFunctionNames.has(functionName)) {
    failures.push(
      `supabase/config.toml: Edge Function ${functionName} must be classified in security-backend as tenant, user-scoped, account-onboarding, provider-callback, or non-tenant.`
    );
  }
}
for (const functionName of classifiedEdgeFunctionNames) {
  if (!configuredEdgeFunctionNames.includes(functionName)) {
    failures.push(
      `scripts/security-backend.mjs: classified Edge Function ${functionName} is missing from supabase/config.toml.`
    );
  }
}

if (/\bauth\.role\s*\(/i.test(combinedSql)) {
  failures.push("supabase: RLS policies must not use deprecated auth.role(); use TO authenticated plus row predicates.");
}

const publicTables = [...combinedSql.matchAll(/create\s+table\s+if\s+not\s+exists\s+public\.([a-z_]+)\s*\(([\s\S]*?)\);/gi)];
const publicTableNames = [...new Set(publicTables.map((match) => match[1]))];

for (const table of publicTableNames) {
  const escapedTable = escapeRegExp(table);
  if (!new RegExp(`alter\\s+table\\s+public\\.${escapedTable}\\s+enable\\s+row\\s+level\\s+security`, "i").test(combinedSql)) {
    failures.push(`supabase: public.${table} is in an exposed schema but does not enable RLS.`);
  }
  if (serviceOnlyPublicTables.has(table)) {
    if (!new RegExp(`revoke\\s+all\\s+on\\s+public\\.${escapedTable}\\s+from\\s+anon\\s*,\\s*authenticated`, "i").test(combinedSql)) {
      failures.push(`supabase: service-only public.${table} must explicitly revoke anon and authenticated access.`);
    }
    continue;
  }
  if (!new RegExp(`grant\\s+[^;]+\\s+on\\s+public\\.${escapedTable}\\s+to\\s+authenticated`, "i").test(combinedSql)) {
    failures.push(`supabase: public.${table} is missing an explicit authenticated Data API grant.`);
  }
}

for (const table of restaurantOwnedTables) {
  const definitions = publicTables.filter((match) => match[1] === table);
  if (definitions.length === 0) {
    failures.push(`supabase: expected restaurant-owned table public.${table} is not defined in schema/migrations.`);
    continue;
  }
  if (!definitions.some((match) => /\brestaurant_id\s+uuid\s+not\s+null\b/i.test(match[2]))) {
    failures.push(`supabase: restaurant-owned table public.${table} must have restaurant_id uuid not null.`);
  }
}

const finalAuthenticatedPolicies = buildFinalAuthenticatedPolicies(combinedSql);
const selectOnlyTenantTables = new Set([
  ...restaurantOwnedTables,
  ...tenantAuthorizationTables,
  ...tenantRootTables,
  ...publicUserScopedTables
]);

for (const { table, name, cmd, block } of finalAuthenticatedPolicies) {
  if (!/\bto\s+authenticated\b/i.test(block)) {
    failures.push(`supabase: public.${table} policy "${name}" must target TO authenticated explicitly.`);
  }

  const requiresTenantPredicate =
    restaurantOwnedTables.has(table) || tenantAuthorizationTables.has(table) || tenantRootTables.has(table);
  if (requiresTenantPredicate && !/private\.(is_restaurant_member|has_restaurant_role)\s*\(/i.test(block)) {
    failures.push(`supabase: public.${table} policy "${name}" is missing a private membership/role predicate.`);
  }

  if (
    publicUserScopedTables.has(table) &&
    !/\b(id|user_id|subject_user_id)\s*=\s*auth\.uid\(\)/i.test(block)
  ) {
    failures.push(`supabase: public.${table} policy "${name}" must be scoped to auth.uid().`);
  }

  if (selectOnlyTenantTables.has(table) && cmd !== "SELECT") {
    failures.push(
      `supabase: public.${table} must not retain authenticated write policies after service/Edge ownership (found "${name}" for ${cmd}).`
    );
  }
}

const migrationSqlFiles = listFiles("supabase/migrations").filter((path) => path.endsWith(".sql")).sort();
const tablePrivilegeInventory = buildFinalAuthenticatedTablePrivileges(
  migrationSqlFiles.map((path) => ({ path, sql: read(path) }))
);
for (const unrecognized of tablePrivilegeInventory.unrecognizedPrivilegeStatements) {
  failures.push(
    `supabase: unrecognized authenticated table privilege DDL in ${unrecognized.source}; final DML mode cannot be proven.`
  );
}
for (const table of selectOnlyTenantTables) {
  const privileges = tablePrivilegeInventory.tables.get(table);
  if (!privileges) {
    failures.push(
      `supabase: expected Data API table public.${table} is missing from the final authenticated privilege inventory.`
    );
    continue;
  }
  if (!privileges.select) {
    failures.push(
      `supabase: public.${table} must retain authenticated SELECT for RLS-backed Data API reads after service/Edge ownership.`
    );
  }
  if (hasAuthenticatedTableDml(privileges)) {
    failures.push(
      `supabase: public.${table} must not retain authenticated DML grants after service/Edge ownership (found ${listAuthenticatedDmlPrivileges(privileges).join(", ")}).`
    );
  }
}
for (const table of serviceOnlyPublicTables) {
  const privileges = tablePrivilegeInventory.tables.get(table);
  if (!privileges) continue;
  if (privileges.select || hasAuthenticatedTableDml(privileges)) {
    failures.push(
      `supabase: service-only public.${table} must not retain authenticated table privileges after final migrations.`
    );
  }
}

const functionInventory = buildFinalFunctionInventory(sqlFiles.map((path) => ({ path, sql: read(path) })));
for (const privileged of functionInventory.unrecognizedPrivilegedStatements) {
  failures.push(`supabase: unrecognized privileged-function DDL in ${privileged.source}; final security mode cannot be proven.`);
}

const serviceOnlyPublicFunctions = new Set([
  "public.reserve_edge_function_invocation",
  "public.record_edge_function_security_event",
  "public.reserve_user_scoped_edge_function_invocation",
  "public.record_user_scoped_edge_function_security_event",
  "public.service_create_rules_engine_ai_insight"
]);
const globalServiceOnlyPublicFunctions = new Set([
  "public.service_claim_outreach_enrollment",
  "public.service_release_stale_outreach_claims",
  "public.service_unsubscribe_outreach",
  "public.service_rollback_failed_account_deletion"
]);
// Legacy auth.uid() wrappers kept for SQL compatibility but must stay
// unexecutable by authenticated clients after Edge ownership migrations.
const revokedAuthenticatedMutators = [
  "public.create_restaurant_with_owner",
  "public.claim_restaurant_member_invite",
  "public.request_my_account_deletion",
  "public.save_restaurant_setup",
  "public.record_setup_completion_audit",
  "public.update_restaurant_profile",
  "public.update_my_profile",
  "public.update_my_preferred_locale",
  "public.update_my_notification_preferences",
  "public.approve_purchase_recommendation",
  "public.dismiss_purchase_recommendation",
  "public.create_pending_purchase_recommendation",
  "public.undo_purchase_recommendation_action",
  "public.update_supplier_order_draft",
  "public.mark_supplier_order_sent",
  "public.replace_pending_purchase_recommendations",
  "public.replace_operational_insights",
  "public.replace_operational_signals",
  "public.update_inventory_item_and_signals",
  "public.save_recipe_mapping_and_signals",
  "public.create_storage_location",
  "public.confirm_supplier_order_placed",
  "public.add_restaurant_member",
  "public.add_restaurant_member_by_email",
  "public.update_restaurant_member",
  "public.remove_restaurant_member",
  "public.create_restaurant_member_invite",
  "public.revoke_restaurant_member_invite",
  "public.upsert_supplier_recipient",
  "public.ensure_restaurant_storage_locations"
];
const edgeOwnedServicePublicFunctions = [
  "public.service_create_restaurant_with_owner",
  "public.service_claim_restaurant_member_invite",
  "public.service_request_my_account_deletion",
  "public.service_save_restaurant_setup",
  "public.service_record_setup_completion_audit",
  "public.service_update_restaurant_profile",
  "public.service_update_my_profile",
  "public.service_update_my_preferred_locale",
  "public.service_update_my_notification_preferences",
  "public.service_approve_purchase_recommendation",
  "public.service_dismiss_purchase_recommendation",
  "public.service_create_pending_purchase_recommendation",
  "public.service_undo_purchase_recommendation_action",
  "public.service_update_supplier_order_draft",
  "public.service_mark_supplier_order_sent",
  "public.service_create_storage_location",
  "public.service_confirm_supplier_order_placed",
  "public.service_add_restaurant_member",
  "public.service_add_restaurant_member_by_email",
  "public.service_update_restaurant_member",
  "public.service_remove_restaurant_member",
  "public.service_create_restaurant_member_invite",
  "public.service_revoke_restaurant_member_invite",
  "public.service_upsert_supplier_recipient",
  "public.service_transfer_inventory"
];
for (const fn of functionInventory.functions.values()) {
  if (fn.securityMode !== "definer") continue;
  if (!fn.hasEmptySearchPath) {
    failures.push(`supabase: ${fn.identity} is SECURITY DEFINER without SET search_path = ''.`);
  }
  if (fn.executeRoles.has("public") || fn.executeRoles.has("anon")) {
    if (fn.identity !== "public.verify_staging_identity") {
      failures.push(`supabase: ${fn.identity} exposes SECURITY DEFINER execution to public/anon.`);
    }
  }

  if (fn.schema === "public") {
    if (fn.executeRoles.size === 0) continue;
    if (fn.identity === "public.verify_staging_identity") {
      if (!fn.executeRoles.has("anon") || !fn.executeRoles.has("authenticated") || fn.executeRoles.has("service_role")) {
        failures.push("supabase: public.verify_staging_identity must be limited to anon/authenticated marker comparison.");
      }
    } else if (serviceOnlyPublicFunctions.has(fn.identity)) {
      if (!/p_actor_user_id/i.test(fn.definition) || !fn.executeRoles.has("service_role") || fn.executeRoles.has("authenticated")) {
        failures.push(`supabase: ${fn.identity} must be actor-bound and executable only by service_role.`);
      }
    } else if (globalServiceOnlyPublicFunctions.has(fn.identity)) {
      if (!fn.executeRoles.has("service_role") || fn.executeRoles.has("authenticated")) {
        failures.push(`supabase: ${fn.identity} must be executable only by service_role.`);
      }
    } else {
      if (!/auth\.uid\(\)|private\.(?:has_restaurant_role|is_restaurant_member)\s*\(/i.test(fn.definition)) {
        failures.push(`supabase: ${fn.identity} must explicitly derive authority from auth.uid().`);
      }
      if (!fn.executeRoles.has("authenticated") || fn.executeRoles.has("service_role")) {
        failures.push(`supabase: ${fn.identity} must grant EXECUTE only to authenticated.`);
      }
    }
  }
}

for (const identity of revokedAuthenticatedMutators) {
  const fn = functionInventory.functions.get(identity);
  if (!fn) {
    failures.push(`supabase: expected revoked mutator ${identity} is missing from the final function inventory.`);
    continue;
  }
  if (fn.executeRoles.has("authenticated") || fn.executeRoles.has("anon") || fn.executeRoles.has("public")) {
    failures.push(`supabase: ${identity} must remain revoked from authenticated/anon/public after Edge ownership.`);
  }
}

for (const identity of edgeOwnedServicePublicFunctions) {
  const fn = functionInventory.functions.get(identity);
  if (!fn) {
    failures.push(`supabase: expected Edge-owned service RPC ${identity} is missing from the final function inventory.`);
    continue;
  }
  if (!fn.executeRoles.has("service_role") || fn.executeRoles.has("authenticated") || fn.executeRoles.has("anon") || fn.executeRoles.has("public")) {
    failures.push(`supabase: ${identity} must grant EXECUTE only to service_role.`);
  }
  if (!/p_actor_user_id/i.test(fn.definition)) {
    failures.push(`supabase: ${identity} must be actor-bound via p_actor_user_id.`);
  }
}

for (const functionName of edgeFunctionNames) {
  const functionPath = `supabase/functions/${functionName}/index.ts`;
  const source = read(functionPath);
  const escapedFunctionName = escapeRegExp(functionName);
  const configBlock = config.match(new RegExp(`\\[functions\\.${escapedFunctionName}\\]([\\s\\S]*?)(?=\\n\\[|$)`, "i"))?.[1] ?? "";

  if (!/verify_jwt\s*=\s*true/i.test(configBlock)) {
    failures.push(`supabase/config.toml: ${functionName} must set verify_jwt = true.`);
  }

  for (const requiredCall of [
    "requireAuthenticatedContext",
    "requireRestaurantRole",
    "reserveFunctionInvocation",
    "recordFunctionAuditLog",
    "recordFunctionSecurityEvent"
  ]) {
    if (!new RegExp(`${requiredCall}\\s*\\(`).test(source)) {
      failures.push(`${functionPath}: missing ${requiredCall} guard/audit call.`);
    }
  }

  if (/missingSecret|SQUARE_ACCESS_TOKEN|TOAST_CLIENT_SECRET|CLOVER_ACCESS_TOKEN|LIGHTSPEED_ACCESS_TOKEN|GOOGLE_CLIENT_SECRET|GMAIL_REFRESH_TOKEN|GMAIL_ACCESS_TOKEN|OPENAI_API_KEY/.test(source)) {
    const unsafeSecretResponse = source
      .split(/\r?\n/)
      .some((line) =>
        /jsonResponse|message:|error:|status:/.test(line) &&
        /SQUARE_ACCESS_TOKEN|TOAST_CLIENT_SECRET|CLOVER_ACCESS_TOKEN|LIGHTSPEED_ACCESS_TOKEN|GOOGLE_CLIENT_SECRET|GMAIL_REFRESH_TOKEN|GMAIL_ACCESS_TOKEN|OPENAI_API_KEY|missingSecret/.test(line)
      );
    if (unsafeSecretResponse) {
      failures.push(`${functionPath}: response text must not reveal provider secret identifiers.`);
    }
  }
}

for (const functionName of userScopedEdgeFunctionNames) {
  const functionPath = `supabase/functions/${functionName}/index.ts`;
  const source = read(functionPath);
  const escapedFunctionName = escapeRegExp(functionName);
  const configBlock = config.match(new RegExp(`\\[functions\\.${escapedFunctionName}\\]([\\s\\S]*?)(?=\\n\\[|$)`, "i"))?.[1] ?? "";

  if (!/verify_jwt\s*=\s*true/i.test(configBlock)) {
    failures.push(`supabase/config.toml: ${functionName} must set verify_jwt = true.`);
  }
  if (!/requireAuthenticatedContext\s*\(/.test(source)) {
    failures.push(`${functionPath}: missing requireAuthenticatedContext guard.`);
  }
  if (!/reserveUserScopedFunctionInvocation\s*\(/.test(source)) {
    failures.push(`${functionPath}: must reserve a user-scoped firewall invocation before deletion work.`);
  }
  if (!/recordUserScopedFunctionSecurityEvent\s*\(/.test(source)) {
    failures.push(`${functionPath}: must finalize user-scoped firewall security events.`);
  }
  if (!/auth\.admin\.deleteUser/.test(source) || !/service_request_my_account_deletion|request_my_account_deletion/.test(source)) {
    failures.push(`${functionPath}: must revoke memberships and delete or queue Auth account removal.`);
  }
  if (!/service_rollback_failed_account_deletion/.test(source)) {
    failures.push(`${functionPath}: Auth delete failures must roll back membership/restaurant revocation.`);
  }
  if (!/authUserDeleted/.test(source)) {
    failures.push(`${functionPath}: must treat Auth hard-delete as the success boundary so secondary finalize failures do not falsely fail deletion.`);
  }
  if (/requireRestaurantRole\s*\(/.test(source)) {
    failures.push(`${functionPath}: account deletion is user-scoped and must not require a restaurant role.`);
  }
}

if (!/request-account-deletion/.test(read("supabase/migrations/20260801101000_edge_request_account_deletion_firewall.sql"))) {
  failures.push("supabase/migrations/20260801101000_edge_request_account_deletion_firewall.sql: must allowlist request-account-deletion in the user-scoped firewall.");
}

const postDeleteSecurityEventsMigration = read(
  "supabase/migrations/20260802020000_account_deletion_post_delete_security_events.sql"
);
if (!/reserved_actor_user_id/.test(postDeleteSecurityEventsMigration)
  || !/deleted_actor_user_id/.test(postDeleteSecurityEventsMigration)
  || !/actor_user_id is null/.test(postDeleteSecurityEventsMigration)) {
  failures.push(
    "supabase/migrations/20260802020000_account_deletion_post_delete_security_events.sql: must finalize request-account-deletion security events after Auth hard-delete."
  );
}

for (const functionName of accountOnboardingEdgeFunctionNames) {
  const functionPath = `supabase/functions/${functionName}/index.ts`;
  const source = read(functionPath);
  const escapedFunctionName = escapeRegExp(functionName);
  const configBlock = config.match(new RegExp(`\\[functions\\.${escapedFunctionName}\\]([\\s\\S]*?)(?=\\n\\[|$)`, "i"))?.[1] ?? "";

  if (!/verify_jwt\s*=\s*true/i.test(configBlock)) {
    failures.push(`supabase/config.toml: ${functionName} must set verify_jwt = true.`);
  }
  if (!/requireAuthenticatedContext\s*\(/.test(source)) {
    failures.push(`${functionPath}: missing requireAuthenticatedContext guard.`);
  }
  if (!/reserveUserScopedFunctionInvocation\s*\(/.test(source)) {
    failures.push(`${functionPath}: must reserve a user-scoped firewall invocation before onboarding work.`);
  }
  if (!/recordUserScopedFunctionSecurityEvent\s*\(/.test(source)) {
    failures.push(`${functionPath}: must finalize user-scoped firewall security events.`);
  }
  if (!/service_create_restaurant_with_owner/.test(source) || !/service_claim_restaurant_member_invite/.test(source)) {
    failures.push(`${functionPath}: must call service-owned create/claim RPCs.`);
  }
  if (/requireRestaurantRole\s*\(/.test(source)) {
    failures.push(`${functionPath}: pre-membership onboarding must not require a restaurant role.`);
  }
  if (!/create_restaurant_with_owner/.test(source) || !/claim_restaurant_member_invite/.test(source)) {
    failures.push(`${functionPath}: must expose create_restaurant_with_owner and claim_restaurant_member_invite actions.`);
  }
}

for (const functionName of providerCallbackEdgeFunctionNames) {
  const functionPath = `supabase/functions/${functionName}/index.ts`;
  const source = read(functionPath);
  const escapedFunctionName = escapeRegExp(functionName);
  const configBlock = config.match(new RegExp(`\\[functions\\.${escapedFunctionName}\\]([\\s\\S]*?)(?=\\n\\[|$)`, "i"))?.[1] ?? "";

  if (!/verify_jwt\s*=\s*false/i.test(configBlock)) {
    failures.push(`supabase/config.toml: ${functionName} is a provider callback and must set verify_jwt = false.`);
  }
  if (/requireAuthenticatedContext\s*\(/.test(source)) {
    failures.push(`${functionPath}: provider callbacks authenticate via claimed OAuth state, not requireAuthenticatedContext.`);
  }
  if (!/state\.length\s*<\s*32[\s\S]*service_claim_gmail_oauth[\s\S]*googleOAuthConfig\s*\(/i.test(source)) {
    failures.push(
      `${functionPath}: OAuth state must be bounded and atomically claimed before provider credentials are loaded.`
    );
  }
  if (!/service_claim_gmail_oauth[\s\S]*recordFunctionSecurityEvent/i.test(source)) {
    failures.push(`${functionPath}: must finalize reserved firewall security events after claiming OAuth state.`);
  }
  if (!/recordFunctionTerminalError\s*\(/.test(source)) {
    failures.push(`${functionPath}: must record terminal firewall errors when the callback fails.`);
  }
  if (!/service_complete_gmail_oauth/.test(source) || !/service_fail_gmail_oauth/.test(source)) {
    failures.push(`${functionPath}: must complete or fail the claimed Gmail OAuth flow through service-owned RPCs.`);
  }
  if (!new RegExp(`'${escapedFunctionName}'[\\s\\S]*array\\['owner',\\s*'admin'\\]`).test(combinedSql)) {
    failures.push(
      `supabase: firewall policy for ${functionName} must remain owner/admin scoped in migrations.`
    );
  }
}

for (const functionName of nonTenantEdgeFunctionNames) {
  const functionPath = `supabase/functions/${functionName}/index.ts`;
  const source = read(functionPath);
  const escapedFunctionName = escapeRegExp(functionName);
  const configBlock = config.match(new RegExp(`\\[functions\\.${escapedFunctionName}\\]([\\s\\S]*?)(?=\\n\\[|$)`, "i"))?.[1] ?? "";

  if (!/verify_jwt\s*=\s*false/i.test(configBlock)) {
    failures.push(`supabase/config.toml: non-tenant ${functionName} must set verify_jwt = false.`);
  }
  if (/requireAuthenticatedContext\s*\(/.test(source) || /requireRestaurantRole\s*\(/.test(source)) {
    failures.push(`${functionPath}: non-tenant endpoints must not use restaurant JWT membership guards.`);
  }
}

const syncPosSource = read("supabase/functions/sync-pos-sales/index.ts");
if (/\.from\("sales_imports"\)[\s\S]*\.(?:insert|upsert)\(/i.test(syncPosSource)) {
  failures.push("supabase/functions/sync-pos-sales/index.ts: unavailable providers must not create sales_import rows.");
}
if (
  !/recordFunctionSecurityEvent\([\s\S]*"blocked"[\s\S]*"pos_sync_blocked"/i.test(syncPosSource) ||
  !/providerConfigured\s*\?\s*501\s*:\s*503/i.test(syncPosSource) ||
  !/"provider_not_implemented"/i.test(syncPosSource) ||
  /"provider_not_enabled"/i.test(syncPosSource) ||
  (syncPosSource.match(/recordFunctionSecurityEvent\s*\(/g)?.length ?? 0) !== 1
) {
  failures.push(
    "supabase/functions/sync-pos-sales/index.ts: unavailable sync must close once with provider_not_implemented (501) or server_configuration_required (503)."
  );
}

const generateAiSource = read("supabase/functions/generate-ai-insights/index.ts");
if (/service_create_rules_engine_ai_insight|\.from\("ai_insights"\)[\s\S]*\.(?:insert|upsert)\(/i.test(generateAiSource)) {
  failures.push("supabase/functions/generate-ai-insights/index.ts: unavailable model execution must not persist placeholder insights.");
}
if (
  !/recordFunctionSecurityEvent\([\s\S]*"blocked"[\s\S]*"ai_insight_generation_blocked"/i.test(generateAiSource) ||
  !/providerConfigured\s*\?\s*501\s*:\s*503/i.test(generateAiSource) ||
  (generateAiSource.match(/recordFunctionSecurityEvent\s*\(/g)?.length ?? 0) !== 1
) {
  failures.push("supabase/functions/generate-ai-insights/index.ts: unavailable generation must close once with a blocked 501/503 response.");
}

if (failures.length > 0) {
  console.error("\nMise backend security checks failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("\nMise backend security checks passed.");
