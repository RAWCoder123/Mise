import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

import { getInitialLoginCredentials, canUseDemoMode, readPublicAppConfig } from "../lib/appConfig";
import { DEMO_DATASET } from "../services/demoData";
import {
  canApproveInventoryCount,
  canDeleteRestaurantData,
  canDraftInventoryCount,
  canExportRestaurantData,
  canManageRestaurantData,
  canReadRestaurantData,
  canRecordInventoryWaste,
  canUpdateRestaurantProfile
} from "../services/tenantAccess";
import { sanitizeTelemetryProperties } from "../services/telemetry";
import type { RestaurantMembership } from "../types/mise";

function membership(
  restaurantId: string,
  role: RestaurantMembership["role"],
  status: RestaurantMembership["status"] = "active"
): RestaurantMembership {
  return {
    id: `${restaurantId}_${role}`,
    restaurant_id: restaurantId,
    user_id: "user_a",
    role,
    status,
    created_at: "2026-06-21T00:00:00.000Z",
    updated_at: "2026-06-21T00:00:00.000Z"
  };
}

function listFiles(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const next = `${path}/${entry}`;
    return statSync(next).isDirectory() ? listFiles(next) : [next];
  });
}

test("tenant access helper isolates restaurant data by active membership", () => {
  const memberships = [membership("restaurant_a", "owner")];

  assert.equal(canReadRestaurantData(memberships, "restaurant_a"), true);
  assert.equal(canReadRestaurantData(memberships, "restaurant_b"), false);
  assert.equal(canManageRestaurantData(memberships, "restaurant_b"), false);
  assert.equal(canDeleteRestaurantData(memberships, "restaurant_b"), false);
  assert.equal(canReadRestaurantData([], "restaurant_a"), false);
  assert.equal(canReadRestaurantData([membership("restaurant_a", "owner", "disabled")], "restaurant_a"), false);
});

test("tenant role helper keeps staff out of manager edits while allowing count drafts and waste", () => {
  const staff = [membership("restaurant_a", "staff")];
  const manager = [membership("restaurant_a", "manager")];
  const owner = [membership("restaurant_a", "owner")];
  const admin = [membership("restaurant_a", "admin")];

  assert.equal(canReadRestaurantData(staff, "restaurant_a"), true);
  assert.equal(canManageRestaurantData(staff, "restaurant_a"), false);
  assert.equal(canDeleteRestaurantData(staff, "restaurant_a"), false);
  assert.equal(canExportRestaurantData(staff, "restaurant_a"), false);
  assert.equal(canDraftInventoryCount(staff, "restaurant_a"), true);
  assert.equal(canApproveInventoryCount(staff, "restaurant_a"), false);
  assert.equal(canRecordInventoryWaste(staff, "restaurant_a"), true);

  assert.equal(canManageRestaurantData(manager, "restaurant_a"), true);
  assert.equal(canDeleteRestaurantData(manager, "restaurant_a"), false);
  assert.equal(canExportRestaurantData(manager, "restaurant_a"), false);
  assert.equal(canDraftInventoryCount(manager, "restaurant_a"), true);
  assert.equal(canApproveInventoryCount(manager, "restaurant_a"), true);
  assert.equal(canRecordInventoryWaste(manager, "restaurant_a"), true);

  assert.equal(canUpdateRestaurantProfile(owner, "restaurant_a"), true);
  assert.equal(canUpdateRestaurantProfile(admin, "restaurant_a"), true);
  assert.equal(canExportRestaurantData(owner, "restaurant_a"), true);
  assert.equal(canExportRestaurantData(admin, "restaurant_a"), true);
  assert.equal(canApproveInventoryCount(owner, "restaurant_a"), true);
  assert.equal(canRecordInventoryWaste(owner, "restaurant_a"), true);
});

test("production mode does not expose demo credentials or demo access", () => {
  const productionConfig = {
    appEnv: "production" as const,
    enableDemoMode: true,
    privacyPolicyUrl: null,
    supportUrl: null
  };
  const credentials = getInitialLoginCredentials(productionConfig);

  assert.equal(canUseDemoMode(productionConfig), false);
  assert.deepEqual(credentials, { email: "", password: "" });
});

test("development builds default to local demo mode unless explicitly disabled", () => {
  const previousAppEnv = process.env.EXPO_PUBLIC_APP_ENV;
  const previousDemoMode = process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE;

  try {
    delete process.env.EXPO_PUBLIC_APP_ENV;
    delete process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE;
    const defaultConfig = readPublicAppConfig();
    assert.equal(defaultConfig.appEnv, "development");
    assert.equal(defaultConfig.enableDemoMode, true);
    assert.equal(canUseDemoMode(defaultConfig), true);
    assert.equal(getInitialLoginCredentials(defaultConfig).email, DEMO_DATASET.user.email);

    process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE = "false";
    const disabledConfig = readPublicAppConfig();
    assert.equal(disabledConfig.enableDemoMode, false);
    assert.equal(canUseDemoMode(disabledConfig), false);
    assert.deepEqual(getInitialLoginCredentials(disabledConfig), { email: "", password: "" });
  } finally {
    if (previousAppEnv === undefined) {
      delete process.env.EXPO_PUBLIC_APP_ENV;
    } else {
      process.env.EXPO_PUBLIC_APP_ENV = previousAppEnv;
    }
    if (previousDemoMode === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE;
    } else {
      process.env.EXPO_PUBLIC_ENABLE_DEMO_MODE = previousDemoMode;
    }
  }
});

test("demo identity and fixture rows stay behind one replaceable data boundary", () => {
  const compatibilitySurface = readFileSync("services/demoData.ts", "utf8");
  const datasetConfig = readFileSync("services/demo/demoDataset.ts", "utf8");
  const fixture = readFileSync("services/demo/replaceableDemoData.ts", "utf8");
  const replacementGuide = readFileSync("services/demo/README.md", "utf8");

  assert.match(compatibilitySurface, /export \* from "\.\/demo\/demoDataset"/);
  assert.match(compatibilitySurface, /export \* from "\.\/demo\/demoSetupData"/);
  assert.match(compatibilitySurface, /export \* from "\.\/demo\/replaceableDemoData"/);
  assert.doesNotMatch(compatibilitySurface, /Chicken thigh|Jasmine rice|Metro Produce Supply/);
  assert.match(datasetConfig, /restaurant:\s*{/);
  assert.equal(DEMO_DATASET.restaurant.name.trim().length > 0, true);
  assert.match(fixture, /DEMO_DATASET\.restaurant\.name/);
  assert.match(fixture, /DEMO_DATASET\.user\.email/);
  assert.match(replacementGuide, /replace the sample/i);

  const activeSources = ["app", "components", "contexts", "lib", "services", "scripts"]
    .flatMap(listFiles)
    .filter((file) => /\.(?:ts|tsx|mjs)$/.test(file))
    .filter((file) => !file.startsWith("services/demo/"));
  const legacyIdentityFiles = activeSources.filter((file) =>
    /Golden China|golden_china|owner@misedemo\.test/i.test(readFileSync(file, "utf8"))
  );

  assert.deepEqual(legacyIdentityFiles, []);

  const productSources = ["app", "components", "contexts", "lib", "services"]
    .flatMap(listFiles)
    .filter((file) => /\.(?:ts|tsx)$/.test(file))
    .filter((file) => !file.startsWith("services/demo/"));
  const fixtureLeakFiles = productSources.filter((file) =>
    /General Tso Chicken|Jasmine rice|Metro Produce Supply|Regional Protein Co\.|Pantry Wholesale/i.test(
      readFileSync(file, "utf8")
    )
  );

  assert.deepEqual(fixtureLeakFiles, []);
});

test("Supabase schema and migration replace broad RLS with membership-scoped policies", () => {
  const schema = readFileSync("supabase/schema.sql", "utf8");
  const migrations = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"))
    .join("\n");
  const combined = `${schema}\n${migrations}`;

  assert.match(schema, /SCHEMA_SQL_IS_LEGACY_SNAPSHOT=1/);
  assert.match(schema, /DO NOT apply this file/i);
  assert.doesNotMatch(schema, /create\s+table\s+if\s+not\s+exists\s+public\.inventory_movements/i);
  assert.match(migrations, /create\s+table\s+if\s+not\s+exists\s+public\.inventory_movements/i);

  assert.equal(/\busing\s*\(\s*true\s*\)/i.test(combined), false);
  assert.equal(/\bwith\s+check\s*\(\s*true\s*\)/i.test(combined), false);
  assert.match(combined, /create\s+schema\s+if\s+not\s+exists\s+private/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+private\.is_restaurant_member/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+private\.has_restaurant_role/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+private\.create_restaurant_with_owner/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+public\.create_restaurant_with_owner/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+private\.service_create_restaurant_with_owner/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+public\.service_create_restaurant_with_owner/i);
  assert.match(combined, /references\s+auth\.users\(id\)/i);
  assert.match(combined, /private\.is_restaurant_member\(restaurant_id\)/i);
  assert.match(combined, /private\.has_restaurant_role\(restaurant_id,\s*array\['owner',\s*'admin',\s*'manager'\]\)/i);
  assert.match(combined, /revoke\s+all\s+on\s+function\s+private\.is_restaurant_member\(uuid\)\s+from\s+public,\s+anon/i);
  assert.match(
    combined,
    /revoke\s+all\s+on\s+function\s+public\.create_restaurant_with_owner\(text,\s*text\)\s+from\s+public,\s+anon,\s+authenticated,\s+service_role/i
  );
  assert.match(
    combined,
    /grant\s+execute\s+on\s+function\s+public\.service_create_restaurant_with_owner\(uuid,\s*text,\s*text\)\s+to\s+service_role/i
  );
  assert.doesNotMatch(combined, /grant\s+select,\s+update\s+on\s+public\.users\s+to\s+authenticated/i);
  const anonGrants = combined.match(/grant\s+[^;]+\s+to\s+anon[^;]*;/gi) ?? [];
  assert.deepEqual(
    anonGrants.map((statement) => statement.replace(/\s+/g, " ").trim()),
    ["grant execute on function public.verify_staging_identity(text) to anon, authenticated;"]
  );
});

test("restaurant operations backbone tables are tenant-scoped through RLS", () => {
  const migration = readFileSync("supabase/migrations/202606210002_restaurant_ops_backbone.sql", "utf8");
  const restaurantTables = [
    "pos_integrations",
    "sales_imports",
    "supplier_items",
    "purchase_orders",
    "ai_insights",
    "audit_logs"
  ];

  restaurantTables.forEach((table) => {
    assert.match(migration, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`, "i"));
    assert.match(migration, new RegExp(`restaurant_id\\s+uuid\\s+not\\s+null\\s+references\\s+public\\.restaurants`, "i"));
    assert.match(migration, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"));
  });

  assert.match(migration, /private\.is_restaurant_member\(restaurant_id\)/i);
  assert.match(migration, /private\.has_restaurant_role\(restaurant_id,\s*array\['owner',\s*'admin',\s*'manager'\]\)/i);
  assert.match(migration, /grant\s+select,\s+insert\s+on\s+public\.audit_logs\s+to\s+authenticated/i);
});

test("beta hardening migration closes profile, tenant reference, and audit forgery gaps", () => {
  const migration = readFileSync("supabase/migrations/202606220001_security_tenant_integrity.sql", "utf8");

  assert.match(migration, /revoke\s+update\s+on\s+public\.users\s+from\s+authenticated/i);
  assert.match(migration, /grant\s+update\s*\(\s*name\s*\)\s+on\s+public\.users\s+to\s+authenticated/i);
  assert.match(migration, /Do not use for authorization/i);

  assert.match(migration, /inventory_items_restaurant_id_id_key/i);
  assert.match(migration, /pos_integrations_restaurant_id_id_key/i);
  assert.match(
    migration,
    /menu_item_ingredients_inventory_item_tenant_fkey[\s\S]*foreign\s+key\s*\(\s*restaurant_id,\s*inventory_item_id\s*\)[\s\S]*references\s+public\.inventory_items\s*\(\s*restaurant_id,\s*id\s*\)/i
  );
  assert.match(
    migration,
    /purchase_recommendations_inventory_item_tenant_fkey[\s\S]*foreign\s+key\s*\(\s*restaurant_id,\s*inventory_item_id\s*\)[\s\S]*references\s+public\.inventory_items\s*\(\s*restaurant_id,\s*id\s*\)/i
  );
  assert.match(
    migration,
    /sales_imports_pos_integration_tenant_fkey[\s\S]*foreign\s+key\s*\(\s*restaurant_id,\s*pos_integration_id\s*\)[\s\S]*references\s+public\.pos_integrations\s*\(\s*restaurant_id,\s*id\s*\)/i
  );

  assert.match(migration, /Non-secret provider settings only/i);
  assert.match(migration, /alter\s+table\s+public\.audit_logs[\s\S]*alter\s+column\s+actor_user_id\s+set\s+default\s+auth\.uid\(\)/i);
  assert.match(migration, /revoke\s+update,\s+delete\s+on\s+public\.audit_logs\s+from\s+authenticated/i);
  assert.match(migration, /actor_user_id\s+=\s+auth\.uid\(\)/i);
});

test("audit client API rejects hosted writes and does not accept caller-controlled actor_user_id", () => {
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const hostedRecordAudit =
    hostedRepository.match(/async recordAuditLog\([\s\S]*?\n    \},/)?.[0] ?? "";

  assert.match(repository, /export\s+type\s+AuditLogInput\s*=\s*Pick<AuditLog,\s*"restaurant_id"\s*\|\s*"action"\s*\|\s*"entity_table">/i);
  assert.doesNotMatch(repository, /type\s+AuditLogInput\s*=\s*Omit<AuditLog,[^;]*actor_user_id/i);
  assert.match(repository, /actor_user_id:\s*DEMO_USER_ID/i);
  assert.match(hostedRecordAudit, /must be recorded by a server-owned workflow/i);
  assert.doesNotMatch(hostedRecordAudit, /rpc\("record_setup_completion_audit"/i);
  assert.doesNotMatch(repository, /from\("audit_logs"\)\.insert\(input\)/i);
  assert.doesNotMatch(repository, /actor_user_id:\s*input\.actor_user_id|actor_user_id\s*=\s*input\.actor_user_id/i);
});

test("email scaffolding is tenant-scoped and keeps Gmail tokens out of client-readable tables", () => {
  const migration = readFileSync("supabase/migrations/20260622053735_email_scaffolding.sql", "utf8");
  const clientFiles = ["app", "components", "services", "lib"]
    .flatMap(listFiles)
    .filter((file) => /\.(ts|tsx|js)$/.test(file))
    .map((file) => readFileSync(file, "utf8"));

  assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.restaurant_email_connections/i);
  assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.supplier_recipients/i);
  assert.match(migration, /restaurant_id\s+uuid\s+not\s+null\s+references\s+public\.restaurants/i);
  assert.match(migration, /alter\s+table\s+public\.restaurant_email_connections\s+enable\s+row\s+level\s+security/i);
  assert.match(migration, /alter\s+table\s+public\.supplier_recipients\s+enable\s+row\s+level\s+security/i);
  assert.match(migration, /private\.is_restaurant_member\(restaurant_id\)/i);
  assert.match(migration, /private\.has_restaurant_role\(restaurant_id,\s*array\['owner',\s*'admin'\]\)/i);
  assert.match(migration, /Never store Gmail OAuth tokens/i);
  assert.doesNotMatch(migration, /refresh_token\s+text|access_token\s+text|client_secret\s+text/i);
  assert.equal(clientFiles.some((contents) => /GMAIL_REFRESH_TOKEN|GMAIL_ACCESS_TOKEN|GOOGLE_CLIENT_SECRET/i.test(contents)), false);
});

test("setup keeps file imports disabled and persists no raw attachment content", () => {
  const setupScreen = readFileSync("app/(auth)/setup.tsx", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(setupScreen, /attachments:\s*\[\]/i);
  assert.match(setupScreen, /attachment_count:\s*0/i);
  assert.match(setupScreen, /skippedRecipeIngredients/);
  assert.match(setupScreen, /setup\.ready\.skippedRecipes/);
  assert.match(setupScreen, /setup\.ready\.reviewRecipes/);
  assert.match(setupScreen, /skipped_recipe_ingredients/);
  assert.match(catalog, /"setup\.ready\.skippedRecipes\.one"/);
  assert.match(catalog, /"setup\.ready\.reviewRecipes"/);
  assert.doesNotMatch(setupScreen, /EXPO_PUBLIC_.*(OPENAI|GMAIL|GOOGLE|OCR|TOKEN|SECRET)/i);
  assert.doesNotMatch(packageJson, /expo-image-picker|expo-document-picker/i);
});

test("tenant isolation pgTAP allowlists cover July/August restaurant-owned tables", () => {
  const tenantTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const securityStatic = readFileSync("scripts/security-static.mjs", "utf8");
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");

  assert.match(tenantTests, /select plan\(451\);/);
  assert.match(tenantTests, /'inventory_count_sessions'/);
  assert.match(tenantTests, /'inventory_count_lines'/);
  assert.match(tenantTests, /'storage_locations'/);
  assert.match(tenantTests, /'inventory_location_balances'/);
  assert.match(tenantTests, /'restaurant_member_invites'/);
  assert.match(tenantTests, /'gmail_oauth_flows'/);
  assert.match(tenantTests, /'gmail_credentials'/);
  assert.match(tenantTests, /'supplier_email_deliveries'/);
  assert.match(tenantTests, /sales import updates are service-owned/i);
  assert.match(tenantTests, /purchase order deletes are service-owned/i);
  assert.match(tenantTests, /members can read inventory count sessions/i);
  assert.match(tenantTests, /member invites are not readable via Data API/i);
  assert.match(
    tenantTests,
    /insert into public\.inventory_count_sessions[\s\S]*bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb301/
  );
  assert.match(
    tenantTests,
    /'inventory_location_balances',\s*\$probe\$insert into public\.inventory_location_balances/
  );
  assert.match(securityStatic, /"inventory_count_sessions"/);
  assert.match(securityStatic, /"inventory_count_lines"/);
  assert.match(securityBackend, /"inventory_count_sessions"/);
  assert.match(securityBackend, /"inventory_count_lines"/);
});

test("setup attachment migration is tenant-scoped and metadata-only", () => {
  const migration = readFileSync("supabase/migrations/20260623001301_setup_persistence_observability.sql", "utf8");

  assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.setup_attachments/i);
  assert.match(migration, /restaurant_id\s+uuid\s+not\s+null\s+references\s+public\.restaurants/i);
  assert.match(migration, /metadata\s+jsonb\s+not\s+null\s+default\s+'\{\}'::jsonb/i);
  assert.match(migration, /alter\s+table\s+public\.setup_attachments\s+enable\s+row\s+level\s+security/i);
  assert.match(migration, /private\.is_restaurant_member\(restaurant_id\)/i);
  assert.match(migration, /private\.has_restaurant_role\(restaurant_id,\s*array\['owner',\s*'admin',\s*'manager'\]\)/i);
  assert.match(migration, /created_by\s+=\s+auth\.uid\(\)/i);
  assert.match(migration, /grant\s+select,\s+insert,\s+update,\s+delete\s+on\s+public\.setup_attachments\s+to\s+authenticated/i);
  assert.match(migration, /Do not store raw screenshots, file contents, OCR output/i);
  assert.doesNotMatch(migration, /access_token\s+text|refresh_token\s+text|client_secret\s+text/i);
});

test("tenant setup completion uses one bounded replay-safe database workflow", () => {
  const setupWorkflow = readFileSync("services/application/setup.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260714183310_secure_operational_workflows.sql", "utf8");
  const snapshotCall = setupWorkflow.match(/saveRestaurantSetupSnapshot\([\s\S]*?skippedRecipeIngredients\s*\n\s*\}\);/)?.[0] ?? "";

  assert.ok(snapshotCall);
  assert.match(snapshotCall, /source_record_id:\s*sale\.id/i);
  assert.match(snapshotCall, /client_reference_id:\s*attachment\.id/i);
  assert.doesNotMatch(setupWorkflow, /await\s+repository\.(?:upsertInventoryItem|createPosSale|upsertSupplierRecipient|createSetupAttachment)\(/i);
  assert.match(repository, /action:\s*"save_setup"/i);
  assert.match(repository, /functions\.invoke\("operational-workflows"/i);
  assert.doesNotMatch(repository, /rpc\("save_restaurant_setup"/i);
  assert.match(migration, /restaurant_signal_state/i);
  assert.match(migration, /service_mark_operational_signals_pending/i);
  assert.match(migration, /p_complete_setup/i);
  assert.match(migration, /signals_revision[\s\S]*'setup_completed'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.replace_operational_signals[\s\S]*authenticated/i);
});

test("setup inventory quantity creates and deltas write append-only ledger movements", () => {
  const ledgerMigration = readFileSync(
    "supabase/migrations/20260801030000_setup_inventory_ledger_movements.sql",
    "utf8"
  );
  const edgeMigration = readFileSync(
    "supabase/migrations/20260801083000_edge_save_restaurant_setup.sql",
    "utf8"
  );
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const tenantTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const demoSetup = repository.match(
    /async saveRestaurantSetupSnapshot\(restaurantId, input\) \{[\s\S]*?async createInventoryItemAndSignals/
  )?.[0] ?? "";

  assert.match(ledgerMigration, /create\s+or\s+replace\s+function\s+public\.save_restaurant_setup/i);
  assert.match(ledgerMigration, /insert into public\.inventory_movements/i);
  assert.match(ledgerMigration, /source_workflow,\s*[\s\S]*'save_restaurant_setup'/i);
  assert.match(ledgerMigration, /reason,\s*[\s\S]*'manual_count'/i);
  assert.match(ledgerMigration, /quantity_after is distinct from quantity_before/i);
  assert.match(ledgerMigration, /'created',\s*true/i);
  assert.match(ledgerMigration, /'created',\s*false/i);
  assert.match(edgeMigration, /private\.service_save_restaurant_setup\(\s*p_actor_user_id uuid/i);
  assert.match(edgeMigration, /grant execute on function public\.service_save_restaurant_setup[\s\S]*service_role/i);
  assert.match(edgeMigration, /revoke all on function public\.save_restaurant_setup/i);
  assert.match(demoSetup, /sourceWorkflow:\s*"save_restaurant_setup"/);
  assert.match(demoSetup, /reason:\s*"manual_count"/);
  assert.match(demoSetup, /created:\s*true/);
  assert.match(demoSetup, /created:\s*false/);
  assert.match(tenantTests, /setup create writes one opening save_restaurant_setup ledger row/i);
  assert.match(tenantTests, /setup quantity change appends a second ledger row/i);
  assert.match(tenantTests, /setup replay with unchanged quantity does not duplicate ledger rows|setup create writes one opening save_restaurant_setup ledger row and replay keeps it unique/i);
});

test("manual CSV POS ingest is service-owned, bounded, and keeps live sync fail-closed", () => {
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const syncPos = readFileSync("supabase/functions/sync-pos-sales/index.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const application = readFileSync("services/application/posIngest.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260730220548_ingest_manual_pos_sales_csv.sql", "utf8");
  const consumptionMigration = readFileSync(
    "supabase/migrations/20260731001500_apply_pos_recipe_consumption.sql",
    "utf8"
  );
  const correctionGuardMigration = readFileSync(
    "supabase/migrations/20260731210000_reject_consumed_pos_sale_corrections.sql",
    "utf8"
  );
  const skippedIncompatibleMigration = readFileSync(
    "supabase/migrations/20260801160341_pos_consumption_skipped_incompatible_count.sql",
    "utf8"
  );
  const skippedIncompatiblePgTap = readFileSync(
    "supabase/tests/database/pos_consumption_skipped_incompatible.test.sql",
    "utf8"
  );

  assert.match(application, /buildManualPosSalesIngestPayload|assertManualPosSalesIngestReady/);
  assert.match(repository, /action:\s*"ingest_pos_csv"/i);
  assert.match(repository, /skipped_incompatible_count/);
  assert.match(repository, /skippedIncompatibleCount/);
  assert.match(edge, /"ingest_pos_csv"/);
  assert.match(edge, /service_ingest_manual_pos_sales/);
  assert.match(edge, /Manual CSV Upload/);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_ingest_manual_pos_sales/i);
  assert.match(migration, /jsonb_array_length\(safe_sales\)\s*>\s*1000/i);
  assert.match(migration, /source_pos\s*<>\s*'Manual CSV Upload'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.service_ingest_manual_pos_sales[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.service_ingest_manual_pos_sales[\s\S]*service_role/i);
  assert.match(consumptionMigration, /private\.apply_recipe_consumption_for_sales/i);
  assert.match(consumptionMigration, /recipe_consumption/i);
  assert.match(consumptionMigration, /inventory_movements_recipe_consumption_source_uidx/i);
  assert.match(consumptionMigration, /appliedTodayConsumptionByItemId/i);
  assert.match(consumptionMigration, /revoke\s+all\s+on\s+function\s+private\.apply_recipe_consumption_for_sales[\s\S]*authenticated/i);
  assert.match(consumptionMigration, /grant\s+execute\s+on\s+function\s+private\.apply_recipe_consumption_for_sales[\s\S]*service_role/i);
  assert.match(correctionGuardMigration, /already drove inventory consumption/i);
  assert.match(correctionGuardMigration, /has_consumption/i);
  assert.match(correctionGuardMigration, /revoke\s+all\s+on\s+function\s+private\.service_ingest_manual_pos_sales[\s\S]*authenticated/i);
  assert.match(correctionGuardMigration, /grant\s+execute\s+on\s+function\s+private\.service_ingest_manual_pos_sales[\s\S]*service_role/i);
  assert.match(skippedIncompatibleMigration, /skipped_incompatible_count/i);
  assert.match(
    skippedIncompatibleMigration,
    /create\s+or\s+replace\s+function\s+private\.apply_recipe_consumption_for_sales/i
  );
  assert.match(
    skippedIncompatibleMigration,
    /create\s+or\s+replace\s+function\s+private\.service_ingest_manual_pos_sales/i
  );
  assert.match(
    skippedIncompatibleMigration,
    /revoke\s+all\s+on\s+function\s+private\.apply_recipe_consumption_for_sales[\s\S]*authenticated/i
  );
  assert.match(
    skippedIncompatibleMigration,
    /grant\s+execute\s+on\s+function\s+private\.apply_recipe_consumption_for_sales[\s\S]*service_role/i
  );
  assert.match(
    skippedIncompatibleMigration,
    /revoke\s+all\s+on\s+function\s+private\.service_ingest_manual_pos_sales[\s\S]*authenticated/i
  );
  assert.match(
    skippedIncompatibleMigration,
    /grant\s+execute\s+on\s+function\s+private\.service_ingest_manual_pos_sales[\s\S]*service_role/i
  );
  assert.match(skippedIncompatiblePgTap, /skipped_incompatible_count/);
  assert.match(skippedIncompatiblePgTap, /unit-incompatible mapping skips/i);
  assert.match(syncPos, /provider_not_enabled/);
  assert.doesNotMatch(syncPos, /service_ingest_manual_pos_sales/);
  assert.doesNotMatch(application, /\.from\("pos_sales"\)\.insert/);
});

test("inventory counts and regenerated guidance commit through one optimistic workflow", () => {
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const migration = readFileSync("supabase/migrations/20260714183310_secure_operational_workflows.sql", "utf8");
  const correctionMigration = readFileSync(
    "supabase/migrations/20260731080000_manager_correction_ledger_reason.sql",
    "utf8"
  );
  const correctionNoteMigration = readFileSync(
    "supabase/migrations/20260731090000_manager_correction_optional_note.sql",
    "utf8"
  );
  const updateWorkflow = inventoryWorkflow.match(/export\s+async\s+function\s+updateInventoryItem[\s\S]*?\n\}/)?.[0] ?? "";
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const hostedUpdateMethod =
    hostedRepository.match(
      /async updateInventoryItem\([\s\S]*?\n\s*\},[\s\S]*?async updateInventoryItemAndSignals/
    )?.[0] ?? "";
  const hostedRecipeUpdate =
    hostedRepository.match(/async updateMenuItemIngredientQuantity[\s\S]*?\n\s*\},/)?.[0] ?? "";
  const hostedRecipeUpsert =
    hostedRepository.match(/async upsertMenuItemIngredient[\s\S]*?\n\s*\},/)?.[0] ?? "";
  const hostedSetupAttachment =
    hostedRepository.match(/async createSetupAttachment[\s\S]*?\n\s*\},/)?.[0] ?? "";

  assert.match(updateWorkflow, /fetchPlanningData[\s\S]*fetchPurchaseRecommendations/i);
  assert.match(updateWorkflow, /buildRecommendationInserts[\s\S]*buildInsightsFromData/i);
  assert.match(updateWorkflow, /requireManagerCorrectionNote/);
  assert.match(updateWorkflow, /updateInventoryItemAndSignals\([\s\S]*existing\.last_updated[\s\S]*normalizedNote/i);
  assert.doesNotMatch(updateWorkflow, /repository\.updateInventoryItem\(/i);
  assert.match(repository, /action:\s*"update_inventory"/i);
  assert.match(repository, /functions\.invoke\("operational-workflows"/i);
  assert.match(repository, /buildManagerCorrectionMetadata/);
  assert.match(hostedUpdateMethod, /Direct inventory updates are disabled/i);
  assert.doesNotMatch(hostedUpdateMethod, /\.from\(\s*["']inventory_items["']\s*\)\s*\.update/i);
  assert.doesNotMatch(hostedRepository, /\.from\(\s*["']inventory_items["']\s*\)\s*\.update/i);
  assert.match(hostedRecipeUpdate, /Direct recipe mapping updates are disabled/i);
  assert.match(hostedRecipeUpsert, /Direct recipe mapping writes are disabled/i);
  assert.match(hostedSetupAttachment, /Direct setup attachment writes are disabled/i);
  assert.doesNotMatch(hostedRecipeUpdate, /\.from\(\s*["']menu_item_ingredients["']\s*\)\s*\.update/i);
  assert.doesNotMatch(hostedRecipeUpsert, /\.from\(\s*["']menu_item_ingredients["']\s*\)\s*\.upsert/i);
  assert.doesNotMatch(hostedSetupAttachment, /\.from\(\s*["']setup_attachments["']\s*\)\s*\.insert/i);
  assert.match(edge, /action === "update_inventory"[\s\S]*requireBoundedString\(body\.note,\s*"note",\s*240\)/);
  assert.match(detail, /inventory\.detail\.correctionNote/);
  assert.match(detail, /movementNoteText/);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_update_inventory_and_signals/i);
  assert.match(migration, /planning_revision[\s\S]*p_expected_revision/i);
  assert.match(migration, /update\s+public\.inventory_items[\s\S]*commit_operational_signals/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.update_inventory_item_and_signals[\s\S]*authenticated/i);
  assert.match(correctionMigration, /create\s+or\s+replace\s+function\s+private\.service_update_inventory_and_signals/i);
  assert.match(correctionMigration, /'manager_correction'/i);
  assert.match(correctionMigration, /source_workflow,\s*[\s\S]*'update_inventory'/i);
  assert.doesNotMatch(
    correctionMigration.match(/insert into public\.inventory_movements[\s\S]*?;/i)?.[0] ?? "",
    /'manual_count'/i
  );
  assert.match(correctionNoteMigration, /safe_patch := safe_patch - 'note'/i);
  assert.match(correctionNoteMigration, /jsonb_build_object\('note',\s*safe_note\)/i);
  assert.match(correctionNoteMigration, /Correction note is outside supported limits/i);
});

test("supplier order receiving is service-owned, ledgered, and distinct from Gmail mark-sent", () => {
  const ordersWorkflow = readFileSync("services/application/orders.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260731030516_receive_supplier_order.sql", "utf8");
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const receiveWorkflow = ordersWorkflow.match(/export\s+async\s+function\s+receiveSupplierOrder[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(ordersWorkflow, /confirmSupplierOrderPlaced/);
  assert.match(receiveWorkflow, /requireSupplierOrderReceiveLines/);
  assert.match(receiveWorkflow, /planSupplierOrderReceive/);
  assert.match(receiveWorkflow, /receiveSupplierOrderAndSignals/);
  assert.match(repository, /action:\s*"receive_supplier_order"/i);
  assert.match(repository, /action:\s*"confirm_supplier_order_placed"/i);
  assert.doesNotMatch(
    repository.match(/async confirmSupplierOrderPlaced[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']confirm_supplier_order_placed["']/i
  );
  assert.match(repository, /Direct POS sale inserts are disabled/);
  assert.match(repository, /Direct supplier draft writes are disabled/);
  assert.match(edge, /"receive_supplier_order"/);
  assert.match(edge, /"confirm_supplier_order_placed"/);
  assert.match(edge, /service_receive_supplier_order_and_signals/);
  assert.match(edge, /service_confirm_supplier_order_placed/);
  assert.match(edge, /supplier_order_received/);
  assert.match(edge, /supplier_order_placed_externally/);
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.confirm_supplier_order_placed/i);
  assert.match(migration, /placement_channel',\s*'manual_external'/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_receive_supplier_order_and_signals/i);
  assert.match(migration, /reason,\s*[\s\S]*'receiving'/i);
  assert.match(migration, /source_workflow,\s*[\s\S]*'receive_supplier_order'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.service_receive_supplier_order_and_signals[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.service_receive_supplier_order_and_signals[\s\S]*service_role/i);
  const receivePutAwayMigration = readFileSync(
    "supabase/migrations/20260801110000_receive_supplier_order_storage_location.sql",
    "utf8"
  );
  const receivePutAwayDatabaseTests = readFileSync(
    "supabase/tests/database/receive_supplier_order_putaway.test.sql",
    "utf8"
  );
  assert.match(receivePutAwayMigration, /private\.apply_inventory_receive_putaway/i);
  assert.match(receivePutAwayMigration, /storage_location_id/i);
  assert.match(receivePutAwayMigration, /storage_location_name/i);
  assert.match(edge, /storage_location_id/);
  assert.match(detail, /fetchStorageLocations/);
  assert.match(detail, /receiveStorageLocationId|putAway/);
  assert.match(
    receivePutAwayDatabaseTests,
    /authenticated clients cannot execute the receive supplier-order service RPC/i
  );
  assert.match(
    receivePutAwayDatabaseTests,
    /service_role can execute the receive supplier-order service RPC/i
  );
  assert.match(
    receivePutAwayDatabaseTests,
    /staff cannot receive a supplier order through the service RPC/i
  );
  assert.match(
    receivePutAwayDatabaseTests,
    /Walk-in put-away lands the received quantity on the chosen station/i
  );
  assert.match(
    receivePutAwayDatabaseTests,
    /Walk-in put-away returns Main station balance to the pre-receive on-hand amount/i
  );
  assert.match(
    receivePutAwayDatabaseTests,
    /receive rejects a cross-tenant storage location id/i
  );
  assert.match(
    receivePutAwayDatabaseTests,
    /re-receiving a completed order is idempotent/i
  );
  assert.match(
    receivePutAwayDatabaseTests,
    /manager can receive onto Main when storage_location_id is omitted/i
  );
  const edgePlaceMigration = readFileSync(
    "supabase/migrations/20260731220000_edge_storage_location_and_external_place.sql",
    "utf8"
  );
  assert.match(edgePlaceMigration, /private\.service_confirm_supplier_order_placed/i);
  assert.match(edgePlaceMigration, /grant execute on function public\.service_confirm_supplier_order_placed[\s\S]*service_role/i);
  assert.match(edgePlaceMigration, /revoke all on function public\.confirm_supplier_order_placed/i);
  assert.match(detail, /confirmSupplierOrderPlaced/);
  assert.match(detail, /receiveSupplierOrder/);
});

test("completed-order receive summary is a bounded tenant-scoped ledger read without client write authority", () => {
  const ordersWorkflow = readFileSync("services/application/orders.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const domain = readFileSync("services/domain/supplierOrderReceiving.ts", "utf8");
  const detail = readFileSync("app/orders/[id].tsx", "utf8");
  const summaryWorkflow =
    ordersWorkflow.match(/export\s+async\s+function\s+fetchSupplierOrderReceiveSummary[\s\S]*?\n\}/)?.[0] ??
    "";
  const demoFetch =
    repository.match(/async fetchSupplierOrderReceiveMovements[\s\S]*?\n    \},/)?.[0] ?? "";
  const hostedFetch = repository.includes("metadata->>supplier_order_id")
    ? repository
    : "";

  assert.match(domain, /buildCompletedSupplierOrderReceiveSummary/);
  assert.match(domain, /SUPPLIER_ORDER_RECEIVE_SUMMARY_LINE_MAX/);
  assert.match(summaryWorkflow, /fetchSupplierOrderReceiveMovements/);
  assert.match(summaryWorkflow, /buildCompletedSupplierOrderReceiveSummary/);
  assert.doesNotMatch(summaryWorkflow, /\.insert\(/);
  assert.doesNotMatch(summaryWorkflow, /receiveSupplierOrderAndSignals/);
  assert.match(demoFetch, /reason !== "receiving"/);
  assert.match(demoFetch, /Math\.min\(limit \?\? 100, 100\)/);
  assert.match(hostedFetch, /metadata->>supplier_order_id/);
  assert.match(hostedFetch, /\.eq\("reason", "receiving"\)/);
  assert.match(detail, /fetchSupplierOrderReceiveSummary/);
  assert.doesNotMatch(detail, /from\("inventory_movements"\)/);
});

test("purchase recommendation and order draft mutations are Edge-routed and service-owned", () => {
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260731230000_edge_purchase_recommendation_workflows.sql",
    "utf8"
  );
  const createPendingMigration = readFileSync(
    "supabase/migrations/20260801001000_edge_create_pending_purchase_recommendation.sql",
    "utf8"
  );
  const stagingTenant = readFileSync("scripts/staging-tenant-check.mjs", "utf8");
  const stagingRace = readFileSync("scripts/staging-client-race.mjs", "utf8");

  for (const action of [
    "create_pending_purchase_recommendation",
    "approve_purchase_recommendation",
    "dismiss_purchase_recommendation",
    "undo_purchase_recommendation_action",
    "update_supplier_order_draft",
    "mark_supplier_order_sent"
  ]) {
    assert.match(edge, new RegExp(`"${action}"`));
    assert.match(repository, new RegExp(`action:\\s*"${action}"`));
  }

  assert.doesNotMatch(
    repository.match(/async createPurchaseRecommendation[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']create_pending_purchase_recommendation["']/i
  );
  assert.doesNotMatch(
    repository.match(/async approvePurchaseRecommendation[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']approve_purchase_recommendation["']/i
  );
  assert.doesNotMatch(
    repository.match(/async dismissPurchaseRecommendation[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']dismiss_purchase_recommendation["']/i
  );
  assert.doesNotMatch(
    repository.match(/async undoPurchaseRecommendationAction[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']undo_purchase_recommendation_action["']/i
  );
  assert.doesNotMatch(
    repository.match(/async updateSupplierOrder[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']update_supplier_order_draft["']/i
  );
  assert.doesNotMatch(
    repository.match(/async markSupplierOrderSent[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']mark_supplier_order_sent["']/i
  );

  assert.match(edge, /service_create_pending_purchase_recommendation/);
  assert.match(edge, /service_approve_purchase_recommendation/);
  assert.match(edge, /service_dismiss_purchase_recommendation/);
  assert.match(edge, /service_undo_purchase_recommendation_action/);
  assert.match(edge, /service_update_supplier_order_draft/);
  assert.match(edge, /service_mark_supplier_order_sent/);
  assert.match(edge, /recommendation_created/);
  assert.match(edge, /recommendation_approved/);
  assert.match(edge, /supplier_order_draft_updated/);
  assert.match(edge, /supplier_order_sent_observed/);

  assert.match(migration, /private\.service_approve_purchase_recommendation/i);
  assert.match(migration, /private\.service_dismiss_purchase_recommendation/i);
  assert.match(migration, /private\.service_undo_purchase_recommendation_action/i);
  assert.match(migration, /private\.service_update_supplier_order_draft/i);
  assert.match(migration, /private\.service_mark_supplier_order_sent/i);
  assert.match(migration, /grant execute on function public\.service_approve_purchase_recommendation[\s\S]*service_role/i);
  assert.match(migration, /revoke all on function public\.approve_purchase_recommendation/i);
  assert.match(migration, /revoke all on function public\.dismiss_purchase_recommendation/i);
  assert.match(migration, /revoke all on function public\.undo_purchase_recommendation_action/i);
  assert.match(migration, /revoke all on function public\.update_supplier_order_draft/i);
  assert.match(migration, /revoke all on function public\.mark_supplier_order_sent/i);
  assert.match(createPendingMigration, /private\.service_create_pending_purchase_recommendation/i);
  assert.match(
    createPendingMigration,
    /grant execute on function public\.service_create_pending_purchase_recommendation[\s\S]*service_role/i
  );
  assert.match(
    createPendingMigration,
    /revoke all on function public\.create_pending_purchase_recommendation/i
  );

  assert.match(stagingTenant, /action:\s*"approve_purchase_recommendation"/);
  assert.match(stagingTenant, /action:\s*"mark_supplier_order_sent"/);
  assert.match(stagingRace, /functions\/v1\/operational-workflows/);
});

test("inventory waste writes are service-owned, ledgered, and separate from count saves", () => {
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260731012000_record_inventory_waste.sql", "utf8");
  const stationMigration = readFileSync(
    "supabase/migrations/20260802160000_waste_station_attribution.sql",
    "utf8"
  );
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const wasteWorkflow = inventoryWorkflow.match(/export\s+async\s+function\s+recordInventoryWaste[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(wasteWorkflow, /requireInventoryWasteQuantity/);
  assert.match(wasteWorkflow, /planInventoryWaste/);
  assert.match(wasteWorkflow, /assertWasteStationAvailability/);
  assert.match(wasteWorkflow, /recordInventoryWasteAndSignals\([\s\S]*existing\.last_updated/i);
  assert.doesNotMatch(wasteWorkflow, /updateInventoryItemAndSignals/);
  assert.match(repository, /action:\s*"record_waste"/i);
  assert.match(repository, /storageLocationId/);
  assert.match(edge, /"record_waste"/);
  assert.match(edge, /service_record_inventory_waste_and_signals/);
  assert.match(edge, /p_storage_location_id/);
  assert.match(edge, /inventory_waste_recorded/);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_record_inventory_waste_and_signals/i);
  assert.match(migration, /reason,\s*[\s\S]*'waste'/i);
  assert.match(migration, /source_workflow,\s*[\s\S]*'record_waste'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.service_record_inventory_waste_and_signals[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.service_record_inventory_waste_and_signals[\s\S]*service_role/i);
  assert.match(stationMigration, /apply_inventory_waste_station_deduction/);
  assert.match(stationMigration, /p_storage_location_id uuid default null/);
  assert.match(
    stationMigration,
    /revoke\s+all\s+on\s+function\s+public\.service_record_inventory_waste_and_signals[\s\S]*authenticated/i
  );
  assert.match(
    stationMigration,
    /grant\s+execute\s+on\s+function\s+public\.service_record_inventory_waste_and_signals[\s\S]*service_role/i
  );
  const wasteStationDatabaseTests = readFileSync(
    "supabase/tests/database/waste_station_attribution.test.sql",
    "utf8"
  );
  assert.match(
    wasteStationDatabaseTests,
    /authenticated clients cannot execute the waste service RPC with station attribution/i
  );
  assert.match(
    wasteStationDatabaseTests,
    /service_role can execute the waste service RPC with station attribution/i
  );
  assert.match(
    wasteStationDatabaseTests,
    /staff can record waste onto Walk-in through the service RPC/i
  );
  assert.match(
    wasteStationDatabaseTests,
    /Walk-in waste reduces the chosen station balance/i
  );
  assert.match(
    wasteStationDatabaseTests,
    /Walk-in waste leaves Main station balance unchanged/i
  );
  assert.match(
    wasteStationDatabaseTests,
    /waste rejects quantity above the selected station balance/i
  );
  assert.match(
    wasteStationDatabaseTests,
    /waste rejects a cross-tenant storage location id/i
  );
  assert.match(
    wasteStationDatabaseTests,
    /manager can record waste onto Main when storage_location_id is omitted/i
  );
  assert.match(detail, /recordInventoryWaste/);
  assert.match(detail, /wasteStorageLocationId/);
  assert.match(detail, /inventory\.detail\.recordWaste/);
  assert.match(detail, /canRecordInventoryWaste/);
  assert.match(detail, /canRecordWaste/);
});

test("staff waste recording is authorized in SQL, Edge, and inventory detail UI", () => {
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260731060925_staff_inventory_waste_roles.sql",
    "utf8"
  );
  const authorityMigration = readFileSync(
    "supabase/migrations/20260801201000_staff_edge_audit_and_signal_authority.sql",
    "utf8"
  );
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const list = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const tenantAccess = readFileSync("services/tenantAccess.ts", "utf8");
  const domain = readFileSync("services/domain/inventoryWaste.ts", "utf8");
  const databaseTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");

  assert.match(domain, /INVENTORY_WASTE_RECORD_ROLES/);
  assert.match(domain, /canRecordInventoryWaste/);
  assert.match(tenantAccess, /export function canRecordInventoryWaste/);
  assert.match(edge, /staffOperationalActions/);
  assert.match(edge, /"record_waste"/);
  assert.match(
    migration,
    /service_record_inventory_waste_and_signals[\s\S]*array\['owner', 'admin', 'manager', 'staff'\]/i
  );
  assert.match(
    authorityMigration,
    /fetch_operational_planning_snapshot[\s\S]*array\['owner', 'admin', 'manager', 'staff'\]/i
  );
  assert.match(
    authorityMigration,
    /commit_operational_signals[\s\S]*array\['owner', 'admin', 'manager', 'staff'\]/i
  );
  assert.match(
    authorityMigration,
    /inventory_waste_recorded[\s\S]*array\['owner', 'admin', 'manager', 'staff'\]/i
  );
  assert.match(authorityMigration, /staff_audit_actions text\[] := array\[/);
  assert.doesNotMatch(authorityMigration, /staff_audit_actions text\[] := array\[[\s\S]*inventory_updated/);
  const notificationAuditMigration = readFileSync(
    "supabase/migrations/20260804040000_staff_notification_audit_and_manual_insight_preserve.sql",
    "utf8"
  );
  assert.match(
    notificationAuditMigration,
    /staff_audit_actions text\[] := array\[[\s\S]*'operator_notification_preferences_updated'/
  );
  assert.match(
    notificationAuditMigration,
    /delete from public\.insights[\s\S]*generation_source in \('mise_rules', 'legacy_client'\)/
  );
  assert.match(databaseTests, /service audit RPC accepts staff actors for staff-authorized waste audits/i);
  assert.match(databaseTests, /service audit RPC accepts staff actors for notification preference audits/i);
  assert.match(databaseTests, /service audit RPC rejects staff actors for manager-only audit actions/i);
  assert.match(databaseTests, /manual insights survive rules-owned operational signal refresh/i);
  assert.match(databaseTests, /active staff can fetch planning snapshots required for waste signal refresh/i);
  assert.match(databaseTests, /'inventory_updated'/);
  assert.match(detail, /canRecordWaste/);
  assert.match(detail, /inventory\.detail\.limitedAccess/);
  assert.match(detail, /showWasteBeforeCountSettings/);
  assert.match(detail, /WasteRecordingCard/);
  assert.match(list, /canRecordInventoryWaste/);
  assert.match(list, /inventory\.waste\.cardTitle/);
  assert.match(list, /inventory\.waste\.findItemAction/);
  assert.match(catalog, /"inventory\.waste\.cardTitle"/);
  assert.match(catalog, /"inventory\.waste\.cardSubtitle"/);
  assert.match(catalog, /"inventory\.waste\.findItemAction"/);
});

test("Edge firewall allows staff on operational-workflows while keeping other functions manager+", () => {
  const policyMigration = readFileSync(
    "supabase/migrations/20260731071000_staff_operational_workflows_edge_policy.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const databaseTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const staffOperationalActions =
    edge.match(/const staffOperationalActions = new Set<OperationalAction>\(\[([\s\S]*?)\]\);/)?.[1] ?? "";

  assert.match(
    policyMigration,
    /'operational-workflows',\s*60,\s*60,\s*array\['owner',\s*'admin',\s*'manager',\s*'staff'\]/i
  );
  assert.match(
    policyMigration,
    /'sync-pos-sales',\s*8,\s*60,\s*array\['owner',\s*'admin',\s*'manager'\]/i
  );
  assert.match(
    policyMigration,
    /'link-gmail',\s*4,\s*300,\s*array\['owner',\s*'admin'\]/i
  );
  assert.match(
    policyMigration,
    /'send-supplier-email',\s*12,\s*60,\s*array\['owner',\s*'admin',\s*'manager'\]/i
  );
  assert.match(staffOperationalActions, /"begin_count_session"/);
  assert.match(staffOperationalActions, /"save_count_lines"/);
  assert.match(staffOperationalActions, /"submit_count_session"/);
  assert.match(staffOperationalActions, /"record_waste"/);
  assert.match(staffOperationalActions, /"transfer_inventory"/);
  assert.doesNotMatch(staffOperationalActions, /"approve_count_session"/);
  assert.doesNotMatch(staffOperationalActions, /"cancel_count_session"/);
  assert.doesNotMatch(staffOperationalActions, /"update_inventory"/);
  assert.doesNotMatch(staffOperationalActions, /"create_inventory_item"/);
  assert.match(databaseTests, /staff can reserve operational-workflows for authorized actions/i);
  assert.match(databaseTests, /staff still cannot reserve manager-only POS sync/i);
});

test("storage locations and inventory transfer are RLS-readable and service-mutated", () => {
  const migration = readFileSync(
    "supabase/migrations/20260731163000_storage_locations_and_transfer.sql",
    "utf8"
  );
  const readPathMigration = readFileSync(
    "supabase/migrations/20260801090819_storage_location_read_path_purity.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const demoStorage = readFileSync("services/demo/storageLocations.ts", "utf8");
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const securityStatic = readFileSync("scripts/security-static.mjs", "utf8");
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");

  assert.match(migration, /create table if not exists public\.storage_locations/i);
  assert.match(migration, /create table if not exists public\.inventory_location_balances/i);
  assert.match(migration, /revoke all on table public\.storage_locations from public, anon, authenticated/i);
  assert.match(migration, /grant select on public\.storage_locations to authenticated/i);
  assert.match(migration, /revoke all on table public\.inventory_location_balances from public, anon, authenticated/i);
  assert.match(migration, /grant select on public\.inventory_location_balances to authenticated/i);
  assert.match(migration, /create or replace function public\.create_storage_location/i);
  assert.match(migration, /create or replace function public\.ensure_restaurant_storage_locations/i);
  assert.match(readPathMigration, /create or replace function public\.list_restaurant_storage_locations/i);
  assert.match(readPathMigration, /revoke all on function public\.ensure_restaurant_storage_locations/i);
  assert.match(readPathMigration, /grant execute on function public\.list_restaurant_storage_locations[\s\S]*to authenticated/i);
  assert.match(readPathMigration, /perform private\.ensure_main_storage_location\(new_restaurant\.id\)/i);
  assert.match(migration, /private\.service_transfer_inventory/i);
  assert.match(migration, /'transfer_inventory'/);
  assert.match(migration, /array\['owner', 'admin', 'manager', 'staff'\]/);
  assert.match(edge, /"transfer_inventory"/);
  assert.match(edge, /"create_storage_location"/);
  assert.match(edge, /service_transfer_inventory/);
  assert.match(edge, /service_create_storage_location/);
  assert.match(edge, /storage_location_created/);
  assert.match(repository, /action:\s*"transfer_inventory"/);
  assert.match(repository, /action:\s*"create_storage_location"/);
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const hostedFetchStorage =
    hostedRepository.match(/async fetchStorageLocations[\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedFetchStorage, /list_restaurant_storage_locations/);
  assert.doesNotMatch(hostedFetchStorage, /ensure_restaurant_storage_locations/);
  assert.match(demoStorage, /Read-only: do not seed Main here/);
  assert.doesNotMatch(
    demoStorage.match(/export function listDemoStorageLocations[\s\S]*?\n\}/)?.[0] ?? "",
    /^\s*ensureDemoMainStorageLocation\s*\(/m
  );
  assert.doesNotMatch(
    repository.match(/async createStorageLocation[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']create_storage_location["']/i
  );
  assert.match(inventoryWorkflow, /export async function transferInventory/);
  assert.match(inventoryWorkflow, /export async function createStorageLocation/);
  assert.match(securityStatic, /"storage_locations"/);
  assert.match(securityStatic, /"inventory_location_balances"/);
  assert.match(securityStatic, /"inventory_count_sessions"/);
  assert.match(securityStatic, /"inventory_count_lines"/);
  assert.match(securityBackend, /"storage_locations"/);
  assert.match(securityBackend, /"inventory_location_balances"/);
  assert.match(securityBackend, /"inventory_count_sessions"/);
  assert.match(securityBackend, /"inventory_count_lines"/);
  const edgePlaceMigration = readFileSync(
    "supabase/migrations/20260731220000_edge_storage_location_and_external_place.sql",
    "utf8"
  );
  assert.match(edgePlaceMigration, /private\.service_create_storage_location/i);
  assert.match(edgePlaceMigration, /grant execute on function public\.service_create_storage_location[\s\S]*service_role/i);
  assert.match(edgePlaceMigration, /revoke all on function public\.create_storage_location/i);
});

test("supplier recipient upsert is Edge-routed with service-owned RPCs", () => {
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260801020000_edge_upsert_supplier_recipient.sql",
    "utf8"
  );
  const databaseTests = readFileSync(
    "supabase/tests/database/supplier_recipient_management.test.sql",
    "utf8"
  );
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const hostedUpsert =
    hostedRepository.match(/async upsertSupplierRecipient\([\s\S]*?\n    \},/)?.[0] ?? "";

  assert.match(edge, /"upsert_supplier_recipient"/);
  assert.match(edge, /service_upsert_supplier_recipient/);
  assert.match(edge, /supplier_recipient_upserted/);
  assert.match(migration, /private\.service_upsert_supplier_recipient/i);
  assert.match(migration, /grant execute on function public\.service_upsert_supplier_recipient[\s\S]*service_role/i);
  assert.match(migration, /revoke all on function public\.upsert_supplier_recipient/i);
  assert.match(hostedUpsert, /action:\s*"upsert_supplier_recipient"/);
  assert.doesNotMatch(hostedUpsert, /\.rpc\(\s*["']upsert_supplier_recipient["']/i);
  assert.match(databaseTests, /authenticated clients cannot execute the legacy supplier recipient RPC/i);
  assert.match(databaseTests, /service_upsert_supplier_recipient/i);
});

test("restaurant setup persistence is Edge-routed with a service-owned RPC", () => {
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260801083000_edge_save_restaurant_setup.sql",
    "utf8"
  );
  const tenantTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const saveSetupBranch = edge.match(/if \(action === "save_setup"\) \{[\s\S]*?\} else if \(action === "ingest_pos_csv"\)/)?.[0] ?? "";

  assert.match(saveSetupBranch, /service_save_restaurant_setup/);
  assert.doesNotMatch(saveSetupBranch, /\.rpc\(\s*["']save_restaurant_setup["']/);
  assert.match(
    hostedRepository.match(/async saveRestaurantSetupSnapshot\([\s\S]*?\n    \},/)?.[0] ?? "",
    /action:\s*"save_setup"/
  );
  assert.doesNotMatch(
    hostedRepository.match(/async saveRestaurantSetupSnapshot\([\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']save_restaurant_setup["']/
  );
  assert.match(migration, /private\.service_save_restaurant_setup\(\s*p_actor_user_id uuid/i);
  assert.match(migration, /grant execute on function public\.service_save_restaurant_setup[\s\S]*service_role/i);
  assert.match(migration, /revoke all on function public\.save_restaurant_setup/i);
  assert.match(migration, /revoke all on function public\.record_setup_completion_audit/i);
  assert.match(migration, /grant execute on function public\.service_record_setup_completion_audit[\s\S]*service_role/i);
  assert.match(tenantTests, /authenticated clients cannot execute the legacy setup persistence RPC/i);
  assert.match(tenantTests, /service role can execute the setup persistence service RPC/i);
  assert.match(tenantTests, /authenticated clients cannot execute the legacy setup audit RPC/i);
});

test("restaurant and operator profile mutations are Edge-routed with service-owned RPCs", () => {
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260801072000_edge_profile_and_locale_mutations.sql",
    "utf8"
  );
  const tenantTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const ownerAdminActions =
    edge.match(/const ownerAdminOperationalActions = new Set<OperationalAction>\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  const staffActions =
    edge.match(/const staffOperationalActions = new Set<OperationalAction>\(\[([\s\S]*?)\]\);/)?.[1] ?? "";

  assert.match(edge, /"update_restaurant_profile"/);
  assert.match(edge, /"update_my_profile"/);
  assert.match(edge, /"update_my_preferred_locale"/);
  assert.match(edge, /"update_my_notification_preferences"/);
  assert.match(edge, /service_update_restaurant_profile/);
  assert.match(edge, /service_update_my_profile/);
  assert.match(edge, /service_update_my_notification_preferences/);
  assert.match(edge, /restaurant_profile_updated/);
  assert.match(edge, /operator_profile_updated/);
  assert.match(edge, /operator_locale_updated/);
  assert.match(edge, /operator_notification_preferences_updated/);
  assert.match(ownerAdminActions, /"update_restaurant_profile"/);
  assert.match(staffActions, /"update_my_profile"/);
  assert.match(staffActions, /"update_my_preferred_locale"/);
  assert.match(staffActions, /"update_my_notification_preferences"/);
  assert.doesNotMatch(staffActions, /"update_restaurant_profile"/);

  assert.match(
    hostedRepository.match(/async updateRestaurantProfile\([\s\S]*?\n    \},/)?.[0] ?? "",
    /action:\s*"update_restaurant_profile"/
  );
  assert.match(
    hostedRepository.match(/async updateMyProfile\([\s\S]*?\n    \},/)?.[0] ?? "",
    /action:\s*"update_my_profile"/
  );
  assert.doesNotMatch(
    hostedRepository.match(/async updateRestaurantProfile\([\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']update_restaurant_profile["']/
  );
  assert.doesNotMatch(
    hostedRepository.match(/async updateMyProfile\([\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']update_my_profile["']/
  );

  assert.match(migration, /private\.update_restaurant_profile\(\s*p_actor_user_id uuid/i);
  assert.match(migration, /grant execute on function public\.service_update_restaurant_profile[\s\S]*service_role/i);
  assert.match(migration, /grant execute on function public\.service_update_my_profile[\s\S]*service_role/i);
  assert.match(migration, /revoke all on function public\.update_restaurant_profile/i);
  assert.match(migration, /revoke all on function public\.update_my_profile/i);
  assert.match(tenantTests, /authenticated clients cannot execute the legacy restaurant profile RPC/i);
  assert.match(tenantTests, /service role can execute the restaurant profile service RPC/i);
  assert.match(tenantTests, /authenticated clients cannot execute the legacy operator profile RPC/i);
});

test("team membership mutations are Edge-routed with service-owned RPCs and claim uses account-onboarding", () => {
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const onboardingEdge = readFileSync("supabase/functions/account-onboarding/index.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260801012000_edge_team_membership_workflows.sql",
    "utf8"
  );
  const membershipPrivilegeMigration = readFileSync(
    "supabase/migrations/20260801211000_revoke_membership_and_profile_dml.sql",
    "utf8"
  );
  const onboardingMigration = readFileSync(
    "supabase/migrations/20260801090525_edge_account_onboarding_workflows.sql",
    "utf8"
  );
  const teamDirectoryTests = readFileSync("supabase/tests/database/restaurant_team_directory.test.sql", "utf8");
  const inviteTests = readFileSync("supabase/tests/database/restaurant_member_invites.test.sql", "utf8");
  const inviteListReadPathMigration = readFileSync(
    "supabase/migrations/20260801182000_member_invite_list_read_path_purity.sql",
    "utf8"
  );
  const tenantTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const ownerAdminActions =
    edge.match(/const ownerAdminOperationalActions = new Set<OperationalAction>\(\[([\s\S]*?)\]\);/)?.[1] ?? "";

  assert.match(inviteListReadPathMigration, /create or replace function public\.list_restaurant_member_invites/i);
  assert.doesNotMatch(inviteListReadPathMigration, /update public\.restaurant_member_invites/i);
  assert.match(inviteListReadPathMigration, /effective status expired/i);
  assert.match(inviteListReadPathMigration, /grant execute on function public\.list_restaurant_member_invites[\s\S]*to authenticated/i);
  assert.match(inviteTests, /list returns effective expired status for past-due pending invites/i);
  assert.match(inviteTests, /list does not persist expiry onto the invite row/i);

  assert.match(edge, /"add_restaurant_member_by_email"/);
  assert.match(edge, /"create_restaurant_member_invite"/);
  assert.match(edge, /"revoke_restaurant_member_invite"/);
  assert.match(edge, /"update_restaurant_member"/);
  assert.match(edge, /"remove_restaurant_member"/);
  assert.match(edge, /service_add_restaurant_member_by_email/);
  assert.match(edge, /service_create_restaurant_member_invite/);
  assert.match(edge, /restaurant_member_added/);
  assert.match(edge, /restaurant_member_invite_created/);
  assert.match(edge, /Never persist one-time claim tokens/);
  assert.match(ownerAdminActions, /"add_restaurant_member_by_email"/);
  assert.match(ownerAdminActions, /"update_restaurant_member"/);
  assert.doesNotMatch(ownerAdminActions, /"claim_restaurant_member_invite"/);
  assert.match(onboardingEdge, /"claim_restaurant_member_invite"/);
  assert.match(onboardingEdge, /service_claim_restaurant_member_invite/);
  assert.match(onboardingEdge, /reserveUserScopedFunctionInvocation/);

  assert.match(
    hostedRepository.match(/async addRestaurantMemberByEmail[\s\S]*?\n    \},/)?.[0] ?? "",
    /action:\s*"add_restaurant_member_by_email"/
  );
  assert.match(
    hostedRepository.match(/async createRestaurantMemberInvite[\s\S]*?\n    \},/)?.[0] ?? "",
    /action:\s*"create_restaurant_member_invite"/
  );
  assert.match(
    hostedRepository.match(/async updateRestaurantMember[\s\S]*?\n    \},/)?.[0] ?? "",
    /action:\s*"update_restaurant_member"/
  );
  assert.match(
    hostedRepository.match(/async removeRestaurantMember[\s\S]*?\n    \},/)?.[0] ?? "",
    /action:\s*"remove_restaurant_member"/
  );
  assert.match(
    hostedRepository.match(/async claimRestaurantMemberInvite[\s\S]*?\n    \},/)?.[0] ?? "",
    /functions\.invoke\(\s*["']account-onboarding["']/
  );
  assert.doesNotMatch(
    hostedRepository.match(/async claimRestaurantMemberInvite[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']claim_restaurant_member_invite["']/
  );
  assert.doesNotMatch(
    hostedRepository.match(/async addRestaurantMemberByEmail[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']add_restaurant_member_by_email["']/
  );

  assert.match(migration, /private\.service_add_restaurant_member_by_email/i);
  assert.match(migration, /private\.service_create_restaurant_member_invite/i);
  assert.match(migration, /revoke all on function public\.add_restaurant_member_by_email/i);
  assert.match(migration, /revoke all on function public\.create_restaurant_member_invite/i);
  assert.match(migration, /grant execute on function public\.service_add_restaurant_member_by_email[\s\S]*service_role/i);
  assert.match(migration, /grant execute on function public\.service_create_restaurant_member_invite[\s\S]*service_role/i);
  assert.match(
    membershipPrivilegeMigration,
    /revoke insert, update, delete on table public\.restaurant_memberships from authenticated/i
  );
  assert.match(membershipPrivilegeMigration, /revoke update on table public\.users from authenticated/i);
  assert.match(onboardingMigration, /private\.service_claim_restaurant_member_invite/i);
  assert.match(onboardingMigration, /revoke all on function public\.claim_restaurant_member_invite/i);
  assert.match(teamDirectoryTests, /authenticated clients cannot execute legacy add_restaurant_member_by_email/i);
  assert.match(inviteTests, /authenticated clients cannot execute legacy claim_restaurant_member_invite/i);
  assert.match(tenantTests, /authenticated clients cannot execute the legacy member-add RPC/i);
  assert.match(tenantTests, /service role can execute the member-add service RPC/i);
  assert.match(tenantTests, /membership inserts are RPC-only/i);
  assert.match(tenantTests, /membership updates are RPC-only/i);
  assert.match(tenantTests, /membership deletes are RPC-only/i);
  assert.match(tenantTests, /legacy user profile updates are RPC-only/i);
});

test("pre-membership create and claim are user-scoped Edge workflows with service RPCs", () => {
  const edge = readFileSync("supabase/functions/account-onboarding/index.ts", "utf8");
  const shared = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260801090525_edge_account_onboarding_workflows.sql",
    "utf8"
  );
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";

  assert.match(config, /\[functions\.account-onboarding\][\s\S]*verify_jwt\s*=\s*true/i);
  assert.match(edge, /reserveUserScopedFunctionInvocation/);
  assert.match(edge, /recordUserScopedFunctionSecurityEvent/);
  assert.match(edge, /"create_restaurant_with_owner"/);
  assert.match(edge, /"claim_restaurant_member_invite"/);
  assert.match(edge, /service_create_restaurant_with_owner/);
  assert.match(edge, /service_claim_restaurant_member_invite/);
  assert.doesNotMatch(edge, /requireRestaurantRole/);
  assert.match(shared, /reserve_user_scoped_edge_function_invocation/);
  assert.match(shared, /record_user_scoped_edge_function_security_event/);
  assert.match(migration, /'account-onboarding'/);
  assert.match(migration, /reserve_user_scoped_edge_function_invocation/i);
  assert.match(migration, /private\.service_create_restaurant_with_owner/i);
  assert.match(migration, /private\.service_claim_restaurant_member_invite/i);
  assert.match(migration, /revoke all on function public\.create_restaurant_with_owner/i);
  assert.match(migration, /revoke all on function public\.claim_restaurant_member_invite/i);
  assert.match(
    hostedRepository.match(/async createRestaurantWithOwner[\s\S]*?\n    \},/)?.[0] ?? "",
    /functions\.invoke\(\s*["']account-onboarding["']/
  );
  assert.doesNotMatch(
    hostedRepository.match(/async createRestaurantWithOwner[\s\S]*?\n    \},/)?.[0] ?? "",
    /\.rpc\(\s*["']create_restaurant_with_owner["']/
  );
  assert.match(securityBackend, /accountOnboardingEdgeFunctionNames/);
  assert.match(securityBackend, /reserve_user_scoped_edge_function_invocation/);
});

test("security backend denylists revoked mutators and Edge-owned service RPCs", () => {
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");
  const stagingServiceRpc = readFileSync("scripts/staging-service-rpc-check.mjs", "utf8");

  assert.match(securityBackend, /revokedAuthenticatedMutators/);
  assert.match(securityBackend, /edgeOwnedServicePublicFunctions/);
  assert.match(securityBackend, /public\.create_restaurant_with_owner/);
  assert.match(securityBackend, /public\.request_my_account_deletion/);
  assert.match(securityBackend, /public\.save_restaurant_setup/);
  assert.match(securityBackend, /public\.undo_purchase_recommendation_action/);
  assert.match(securityBackend, /public\.update_supplier_order_draft/);
  assert.match(securityBackend, /public\.mark_supplier_order_sent/);
  assert.match(securityBackend, /public\.replace_pending_purchase_recommendations/);
  assert.match(securityBackend, /public\.replace_operational_insights/);
  assert.match(securityBackend, /public\.replace_operational_signals/);
  assert.match(securityBackend, /public\.update_inventory_item_and_signals/);
  assert.match(securityBackend, /public\.save_recipe_mapping_and_signals/);
  assert.match(securityBackend, /public\.service_request_my_account_deletion/);
  assert.match(securityBackend, /public\.service_save_restaurant_setup/);
  assert.match(securityBackend, /public\.service_undo_purchase_recommendation_action/);
  assert.match(securityBackend, /public\.service_update_supplier_order_draft/);
  assert.match(securityBackend, /public\.service_mark_supplier_order_sent/);
  assert.match(securityBackend, /must remain revoked from authenticated/);
  assert.match(stagingServiceRpc, /service_save_restaurant_setup/);
  assert.match(stagingServiceRpc, /service_request_my_account_deletion/);
  assert.match(stagingServiceRpc, /service_create_restaurant_with_owner/);
  assert.match(stagingServiceRpc, /service_transfer_inventory/);
  assert.match(stagingServiceRpc, /service_dismiss_purchase_recommendation/);
  assert.match(stagingServiceRpc, /service_undo_purchase_recommendation_action/);
  assert.match(stagingServiceRpc, /service_update_supplier_order_draft/);
  assert.match(stagingServiceRpc, /service_mark_supplier_order_sent/);
  assert.match(stagingServiceRpc, /service_update_my_preferred_locale/);
  assert.match(stagingServiceRpc, /service_update_my_notification_preferences/);
  assert.doesNotMatch(
    stagingServiceRpc,
    /assertDeniedRpc\(\s*"service_update_my_preferred_locale",\s*"service_update_my_notification_preferences"/
  );
});

test("inventory item create is service-owned with opening ledger movement and manager UI", () => {
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260731050500_create_inventory_item.sql", "utf8");
  const list = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const createScreen = readFileSync("app/inventory/new.tsx", "utf8");
  const createWorkflow = inventoryWorkflow.match(/export\s+async\s+function\s+createInventoryItem[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(createWorkflow, /requireInventoryItemCreateInput/);
  assert.match(createWorkflow, /planInventoryItemCreate/);
  assert.match(createWorkflow, /assertInventoryItemCreateCapacity/);
  assert.match(createWorkflow, /findDuplicateInventoryItemName/);
  assert.match(createWorkflow, /createInventoryItemAndSignals/);
  assert.match(repository, /action:\s*"create_inventory_item"/i);
  assert.match(edge, /"create_inventory_item"/);
  assert.match(edge, /service_create_inventory_item_and_signals/);
  assert.match(edge, /inventory_item_created/);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_create_inventory_item_and_signals/i);
  assert.match(migration, /source_workflow,\s*[\s\S]*'create_inventory_item'/i);
  assert.match(migration, /reason,\s*[\s\S]*'manual_count'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.service_create_inventory_item_and_signals[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.service_create_inventory_item_and_signals[\s\S]*service_role/i);
  assert.match(list, /inventory\/new/);
  assert.match(createScreen, /createInventoryItem/);
  assert.match(createScreen, /resolveInventoryCreateAccessState/);
  assert.match(createScreen, /resolveInventoryCreateFailureReason/);
  assert.match(createScreen, /StatusNotice/);
  assert.doesNotMatch(
    createScreen,
    /setMessage\(error\s+instanceof\s+Error\s*\?\s*error\.message/
  );
});

test("inventory count sessions are service-owned with draft progress and approve-time ledger writes", () => {
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260731023000_inventory_count_sessions.sql", "utf8");
  const staffRolesMigration = readFileSync(
    "supabase/migrations/20260731040129_count_session_staff_draft_roles.sql",
    "utf8"
  );
  const countNoteMigration = readFileSync(
    "supabase/migrations/20260731100000_count_line_variance_notes.sql",
    "utf8"
  );
  const validation = readFileSync("services/miseValidation.ts", "utf8");
  const screen = readFileSync("app/inventory/count.tsx", "utf8");
  const list = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const tenantAccess = readFileSync("services/tenantAccess.ts", "utf8");

  assert.match(inventoryWorkflow, /beginInventoryCountSession/);
  assert.match(inventoryWorkflow, /approveInventoryCountSession[\s\S]*planCountSessionApprovals/);
  assert.match(repository, /action:\s*"begin_count_session"/i);
  assert.match(repository, /action:\s*"approve_count_session"/i);
  assert.match(edge, /"begin_count_session"/);
  assert.match(edge, /"approve_count_session"/);
  assert.match(edge, /staffOperationalActions/);
  assert.match(edge, /service_approve_inventory_count_session/);
  assert.match(edge, /inventory_count_session_approved/);
  assert.match(edge, /requireCountLineUpdates[\s\S]*note/);
  assert.match(migration, /create table if not exists public\.inventory_count_sessions/i);
  assert.match(migration, /create table if not exists public\.inventory_count_lines/i);
  assert.match(screen, /resolveInventoryCountFailureReason/);
  assert.match(screen, /StatusNotice/);
  assert.match(screen, /captureMiseError/);
  assert.doesNotMatch(screen, /caught\.message/);

  assert.match(migration, /note text check \(note is null or char_length\(note\) <= 240\)/i);
  assert.match(migration, /inventory_count_sessions_one_open_per_restaurant_idx/i);
  assert.match(migration, /source_workflow,\s*[\s\S]*'approve_count_session'/i);
  assert.match(migration, /reason,\s*[\s\S]*'manual_count'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.service_approve_inventory_count_session[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.service_approve_inventory_count_session[\s\S]*service_role/i);
  assert.match(migration, /grant select on public\.inventory_count_sessions to authenticated/i);
  assert.doesNotMatch(migration, /grant insert on table public\.inventory_count_sessions to authenticated/i);
  assert.match(
    staffRolesMigration,
    /service_begin_inventory_count_session[\s\S]*array\['owner', 'admin', 'manager', 'staff'\]/i
  );
  assert.match(
    staffRolesMigration,
    /service_submit_inventory_count_session[\s\S]*array\['owner', 'admin', 'manager', 'staff'\]/i
  );
  assert.match(countNoteMigration, /note = safe_note/i);
  assert.match(countNoteMigration, /Count line note is outside supported limits/i);
  assert.match(countNoteMigration, /jsonb_build_object\('note',\s*safe_note\)/i);
  assert.match(validation, /requireInventoryCountLineNote/);
  assert.match(validation, /requireInventoryCountLineUpdates[\s\S]*note/);
  assert.match(screen, /canDraftInventoryCount/);
  assert.match(screen, /canApproveInventoryCount/);
  assert.match(screen, /beginInventoryCountSession/);
  assert.match(screen, /approveInventoryCountSession/);
  assert.match(screen, /staffAwaitingApproval/);
  assert.match(screen, /draftNotes/);
  assert.match(screen, /inventory\.count\.notePlaceholder/);
  assert.match(screen, /buildInventoryCountLinePayload/);
  assert.match(screen, /parseNumber,/);
  assert.match(screen, /inventory\.count\.invalidQuantity/);
  assert.match(list, /canDraftInventoryCount/);
  assert.match(list, /\/inventory\/count/);
  assert.match(tenantAccess, /canDraftInventoryCount/);
  assert.match(tenantAccess, /canApproveInventoryCount/);
});

test("recipe baseline edits and regenerated guidance commit through one optimistic workflow", () => {
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260714183310_secure_operational_workflows.sql", "utf8");

  assert.match(inventoryWorkflow, /updateRecipeBaselineIngredient[\s\S]*saveRecipeMappingAndSignals/i);
  assert.match(inventoryWorkflow, /addRecipeBaselineIngredient[\s\S]*saveRecipeMappingAndSignals/i);
  assert.doesNotMatch(inventoryWorkflow, /repository\.(?:updateMenuItemIngredientQuantity|upsertMenuItemIngredient)\(/i);
  assert.match(repository, /action:\s*"upsert_recipe"/i);
  assert.match(repository, /functions\.invoke\("operational-workflows"/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_save_recipe_and_signals/i);
  assert.match(migration, /planning_revision[\s\S]*p_expected_revision/i);
  assert.match(migration, /menu_item_ingredients[\s\S]*commit_operational_signals/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.save_recipe_mapping_and_signals[\s\S]*authenticated/i);
});

test("recipe baseline unlink is service-owned, manager-only, and preserves historical consumption", () => {
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260731072000_delete_recipe_mapping.sql", "utf8");
  const screen = readFileSync("app/settings/recipes.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const databaseTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const deleteWorkflow =
    inventoryWorkflow.match(/export\s+async\s+function\s+deleteRecipeBaselineIngredient[\s\S]*?\n\}/)?.[0] ?? "";
  const staffOperationalActions =
    edge.match(/const staffOperationalActions = new Set<OperationalAction>\(\[([\s\S]*?)\]\);/)?.[1] ?? "";

  assert.match(deleteWorkflow, /deleteRecipeMappingAndSignals/);
  assert.match(deleteWorkflow, /filter\(\(mapping\) => mapping\.id !== mappingId\)/);
  assert.match(repository, /action:\s*"delete_recipe"/i);
  assert.match(repository, /deleteRecipeMappingAndSignals/);
  assert.match(edge, /"delete_recipe"/);
  assert.match(edge, /service_delete_recipe_and_signals/);
  assert.match(edge, /recipe_baseline_deleted/);
  assert.doesNotMatch(staffOperationalActions, /"delete_recipe"/);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_delete_recipe_and_signals/i);
  assert.match(
    migration,
    /actor_has_restaurant_role\([\s\S]*array\['owner', 'admin', 'manager'\]/i
  );
  assert.match(migration, /delete from public\.menu_item_ingredients/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.service_delete_recipe_and_signals[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.service_delete_recipe_and_signals[\s\S]*service_role/i);
  assert.match(migration, /Historical inventory movements are retained/i);
  assert.match(screen, /deleteRecipeBaselineIngredient/);
  assert.match(screen, /fetchRecipeBaselineSummary\(restaurantId,\s*\{\s*itemLimit:\s*null\s*\}/);
  assert.match(screen, /recipes\.unlink\.confirmTitle/);
  assert.match(screen, /onUnlink/);
  assert.match(catalog, /"recipes\.action\.unlink"/);
  assert.match(catalog, /"recipes\.notice\.unlinked"/);
  assert.match(databaseTests, /trusted workflow unlinks a recipe mapping without rewriting historical consumption/i);
  assert.doesNotMatch(inventoryWorkflow, /\.from\("menu_item_ingredients"\)\.delete\(/i);
});

test("recipe baseline builder resolves inventory items through searchable picker helpers", () => {
  const screen = readFileSync("app/settings/recipes.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const searchDomain = readFileSync("services/domain/inventoryItemSearch.ts", "utf8");

  assert.match(searchDomain, /export\s+function\s+searchInventoryItemsForPicker/);
  assert.match(searchDomain, /export\s+function\s+resolveInventoryItemForRecipeLink/);
  assert.match(searchDomain, /export\s+function\s+filterMenuItemsForPicker/);
  assert.match(searchDomain, /export\s+function\s+filterInventoryItemsBySearch/);
  assert.match(screen, /searchInventoryItemsForPicker/);
  assert.match(screen, /resolveInventoryItemForRecipeLink/);
  assert.match(screen, /filterMenuItemsForPicker/);
  assert.match(screen, /onInventoryItemSelect/);
  assert.match(screen, /selectedInventoryItemId/);
  assert.match(screen, /selectedInventoryItem\.restaurant_id !== restaurantId/);
  assert.doesNotMatch(
    screen,
    /visibleInventoryItems\.find\(\(item\) => item\.item_name\.toLowerCase\(\) === normalized\)/
  );
  assert.match(catalog, /"recipes\.field\.inventoryPlaceholder"/);
  assert.match(catalog, /"recipes\.builder\.inventoryPickOne"/);
  assert.match(catalog, /"recipes\.field\.inventorySearchHint"/);
  assert.doesNotMatch(catalog, /type exact inventory item/i);
});

test("mapped recipe dishes reuse ranked baseline search helpers", () => {
  const screen = readFileSync("app/settings/recipes.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const searchDomain = readFileSync("services/domain/inventoryItemSearch.ts", "utf8");

  assert.match(searchDomain, /export\s+function\s+filterRecipeBaselineItemsBySearch/);
  assert.match(searchDomain, /RECIPE_BASELINE_SEARCH_THRESHOLD/);
  assert.match(screen, /filterRecipeBaselineItemsBySearch/);
  assert.match(screen, /RECIPE_BASELINE_SEARCH_THRESHOLD/);
  assert.match(screen, /mappedDishQuery/);
  assert.match(screen, /filteredMappedDishes/);
  assert.match(screen, /recipes\.section\.search\.accessibility/);
  assert.match(catalog, /"recipes\.section\.search\.placeholder"/);
  assert.match(catalog, /"recipes\.section\.search\.emptyTitle"/);
  assert.match(catalog, /"recipes\.section\.search\.emptyBody"/);
});

test("inventory list and count sheet reuse ranked inventory search helpers", () => {
  const inventoryScreen = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const countScreen = readFileSync("app/inventory/count.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const searchDomain = readFileSync("services/domain/inventoryItemSearch.ts", "utf8");

  assert.match(searchDomain, /export\s+function\s+filterInventoryItemsBySearch/);
  assert.match(inventoryScreen, /filterInventoryItemsBySearch/);
  assert.match(inventoryScreen, /getExtraSearchText/);
  assert.match(inventoryScreen, /coverageLabel/);
  assert.doesNotMatch(
    inventoryScreen,
    /item\.item_name\.toLowerCase\(\)\.includes\(normalized\)/
  );
  assert.match(countScreen, /filterInventoryItemsBySearch/);
  assert.match(countScreen, /lineQuery/);
  assert.match(countScreen, /visibleLines/);
  assert.match(countScreen, /inventory\.count\.search\.accessibility/);
  assert.match(catalog, /"inventory\.search\.hint"/);
  assert.match(catalog, /"inventory\.count\.search\.placeholder"/);
  assert.match(catalog, /"inventory\.count\.emptyMatches\.title"/);
});

test("inventory station health rows filter the stock list through presentation helpers", () => {
  const inventoryScreen = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const presentation = readFileSync(
    "services/presentation/inventoryHealthPresentation.ts",
    "utf8"
  );
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(presentation, /stockedItemIds/);
  assert.match(presentation, /export\s+function\s+resolveStationStockedItemIds/);
  assert.match(presentation, /export\s+function\s+filterItemsByStationStock/);
  assert.match(inventoryScreen, /resolveStationStockedItemIds/);
  assert.match(inventoryScreen, /filterItemsByStationStock/);
  assert.match(inventoryScreen, /selectedStationId/);
  assert.match(inventoryScreen, /inventory\.health\.stationFilter\.selectAccessibility/);
  assert.match(catalog, /"inventory\.health\.stationFilter\.active"/);
  assert.match(catalog, /"inventory\.health\.stationFilter\.clear"/);
  assert.match(catalog, /"inventory\.emptyMatches\.stationBody"/);
});

test("transfer put-away and orders review reuse ranked location and recommendation search", () => {
  const detailScreen = readFileSync("app/inventory/[id].tsx", "utf8");
  const orderDetailScreen = readFileSync("app/orders/[id].tsx", "utf8");
  const ordersScreen = readFileSync("app/(tabs)/orders.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const searchDomain = readFileSync("services/domain/inventoryItemSearch.ts", "utf8");

  assert.match(searchDomain, /export\s+function\s+filterStorageLocationsBySearch/);
  assert.match(searchDomain, /STORAGE_LOCATION_CHIP_SEARCH_THRESHOLD/);
  assert.match(searchDomain, /PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD/);
  assert.match(searchDomain, /export\s+function\s+filterSupplierOrdersBySearch/);
  assert.match(searchDomain, /SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD/);
  assert.match(detailScreen, /filterStorageLocationsBySearch/);
  assert.match(detailScreen, /STORAGE_LOCATION_CHIP_SEARCH_THRESHOLD/);
  assert.match(detailScreen, /inventory\.detail\.transferLocationSearch\.accessibility/);
  assert.match(orderDetailScreen, /filterStorageLocationsBySearch/);
  assert.match(orderDetailScreen, /orders\.detail\.receive\.putAwaySearch\.accessibility/);
  assert.match(orderDetailScreen, /receiveStorageLocationIds/);
  assert.match(orderDetailScreen, /orders\.detail\.receive\.putAwayDefault/);
  assert.match(orderDetailScreen, /orders\.detail\.receive\.putAwayLine/);
  assert.match(orderDetailScreen, /filterInventoryItemsBySearch/);
  assert.match(orderDetailScreen, /receiveLineQuery/);
  assert.match(orderDetailScreen, /visibleReceiveLines/);
  assert.match(orderDetailScreen, /orders\.detail\.receive\.lineSearch\.accessibility/);
  assert.match(ordersScreen, /filterInventoryItemsBySearch/);
  assert.match(ordersScreen, /PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD/);
  assert.match(ordersScreen, /orders\.review\.search\.accessibility/);
  assert.match(ordersScreen, /filterSupplierOrdersBySearch/);
  assert.match(ordersScreen, /SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD/);
  assert.match(ordersScreen, /orders\.lane\.search\.accessibility/);
  assert.match(catalog, /"inventory\.detail\.transferLocationSearch\.placeholder"/);
  assert.match(catalog, /"orders\.detail\.receive\.putAwaySearch\.placeholder"/);
  assert.match(catalog, /"orders\.detail\.receive\.lineSearch\.placeholder"/);
  assert.match(catalog, /"orders\.detail\.receive\.lineSearch\.emptyTitle"/);
  assert.match(catalog, /"orders\.review\.search\.placeholder"/);
  assert.match(catalog, /"orders\.review\.search\.emptyTitle"/);
  assert.match(catalog, /"orders\.lane\.search\.placeholder"/);
  assert.match(catalog, /"orders\.lane\.search\.emptyTitle"/);
});

test("setup recipe drafts resolve inventory through searchable picker helpers", () => {
  const screen = readFileSync("app/(auth)/setup.tsx", "utf8");
  const setupService = readFileSync("services/application/setup.ts", "utf8");
  const linkingDomain = readFileSync("services/domain/setupRecipeLinking.ts", "utf8");
  const drafts = readFileSync("services/domain/setupDrafts.ts", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(linkingDomain, /export\s+function\s+resolveSetupRecipeIngredient/);
  assert.match(linkingDomain, /export\s+function\s+searchSetupInventoryForPicker/);
  assert.match(linkingDomain, /resolveInventoryItemForRecipeLink/);
  assert.match(drafts, /inventoryItemId\?:/);
  assert.match(screen, /searchSetupInventoryForPicker/);
  assert.match(screen, /resolveSetupRecipeIngredient/);
  assert.match(screen, /handleIngredientSelect/);
  assert.match(screen, /inventoryItemId/);
  assert.match(setupService, /resolveSetupRecipeIngredient/);
  assert.match(setupService, /resolveSetupRecipeIngredientAgainstCatalog/);
  assert.match(setupService, /setupInventoryCatalogId/);
  assert.match(setupService, /inventory_item_name:\s*linkedInventoryItem\.item_name/);
  assert.doesNotMatch(
    setupService,
    /inventoryItemsByName\.has\(ingredientName\.toLowerCase\(\)\)/
  );
  assert.match(catalog, /"setup\.recipes\.inventoryPickOne"/);
  assert.match(catalog, /"setup\.field\.ingredientSearchHint"/);
});

test("Supabase repository keeps demo seed and reset local-only", () => {
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const supabaseRepository = repository.match(/function createSupabaseRepository\(\): MiseRepository \{[\s\S]*$/)?.[0] ?? "";
  const loadDemoBlock = supabaseRepository.match(/async loadDemoPOSData\([\s\S]*?\n    \},/)?.[0] ?? "";
  const resetDemoBlock = supabaseRepository.match(/async resetDemoData\([\s\S]*?\n    \},/)?.[0] ?? "";

  assert.match(loadDemoBlock, /Demo POS seeding is local-only/i);
  assert.match(resetDemoBlock, /Demo reset is local-only/i);
  assert.doesNotMatch(loadDemoBlock, /\.delete\(|\.upsert\(|\.insert\(/i);
  assert.doesNotMatch(resetDemoBlock, /loadDemoPOSData|\.delete\(|\.upsert\(|\.insert\(/i);
});

test("supplier draft undo cleanup is tenant-scoped", () => {
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const orderWorkflow = readFileSync("services/application/orders.ts", "utf8");
  const workflowMigration = readFileSync("supabase/migrations/20260712121557_stabilize_order_workflow.sql", "utf8");
  const hostedDeleteDraftBlock =
    [...repository.matchAll(/async deleteSupplierOrderDraft\([\s\S]*?\n    \},/g)]
      .map((match) => match[0])
      .find((block) => block.includes("Direct supplier draft deletes are disabled")) ?? "";

  assert.match(hostedDeleteDraftBlock, /Direct supplier draft deletes are disabled/i);
  assert.doesNotMatch(hostedDeleteDraftBlock, /\.from\("supplier_orders"\)[\s\S]*\.delete\(/i);
  assert.match(orderWorkflow, /undoPurchaseRecommendationAction/i);
  assert.match(orderWorkflow, /repository\.undoPurchaseRecommendationAction/i);
  assert.match(orderWorkflow, /Direct draft writes are disabled/i);
  assert.match(workflowMigration, /action[\s\S]*recommendation_undo/i);
  assert.doesNotMatch(orderWorkflow, /actor_user_id/i);
});

test("Edge Functions validate contracts, sanitize metadata, and audit attempts", () => {
  const shared = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  const syncPos = readFileSync("supabase/functions/sync-pos-sales/index.ts", "utf8");
  const aiInsights = readFileSync("supabase/functions/generate-ai-insights/index.ts", "utf8");
  const linkGmail = readFileSync("supabase/functions/link-gmail/index.ts", "utf8");
  const sendEmail = readFileSync("supabase/functions/send-supplier-email/index.ts", "utf8");

  assert.match(shared, /export\s+function\s+requireUuid/i);
  assert.match(shared, /export\s+function\s+requireIsoDateString/i);
  assert.match(shared, /export\s+function\s+requireEnum/i);
  assert.match(shared, /export\s+function\s+safeFunctionMetadata/i);
  assert.match(shared, /export\s+async\s+function\s+reserveFunctionInvocation/i);
  assert.match(shared, /export\s+function\s+firewallBlockedResponse/i);
  assert.match(shared, /export\s+async\s+function\s+recordFunctionSecurityEvent/i);
  assert.match(shared, /export\s+async\s+function\s+recordFunctionAuditLog/i);
  assert.match(shared, /rpc\("reserve_edge_function_invocation"/i);
  assert.match(shared, /rpc\("record_edge_function_security_event"/i);
  assert.match(shared, /rpc\("service_record_edge_audit_log"[\s\S]*p_metadata:\s*safeFunctionMetadata\(metadata\)/i);
  assert.doesNotMatch(shared, /securitySupabase\.from\("audit_logs"\)\.insert/i);
  assert.doesNotMatch(shared, /actor_user_id:\s*user|actor_user_id:\s*input/i);

  [syncPos, aiInsights, linkGmail, sendEmail].forEach((source) => {
    assert.match(source, /reserveFunctionInvocation\(/i);
    assert.match(source, /firewallBlockedResponse\(reservation\)/i);
  });

  assert.match(syncPos, /requireUuid\(body\.restaurantId,\s*"restaurantId"\)/i);
  assert.match(syncPos, /requireEnum\(body\.provider,\s*"provider"/i);
  assert.match(syncPos, /requireIsoDateString\(body\.from,\s*"from"\)/i);
  assert.match(syncPos, /recordFunctionAuditLog\([\s\S]*"pos_sync_requested"/i);
  assert.match(syncPos, /recordFunctionSecurityEvent\([\s\S]*"pos_sync_blocked"/i);
  assert.match(syncPos, /"provider_not_enabled"/i);
  assert.match(syncPos, /"server_configuration_required"/i);
  assert.doesNotMatch(syncPos, /\.from\("sales_imports"\)[\s\S]*\.(?:insert|upsert)\(/i);
  assert.doesNotMatch(syncPos, /status:\s*"queued"/i);
  assert.doesNotMatch(syncPos, /missingSecret|missingSecret:\s*requiredSecretName/i);

  assert.match(aiInsights, /requireUuid\(body\.restaurantId,\s*"restaurantId"\)/i);
  assert.match(aiInsights, /recordFunctionAuditLog\([\s\S]*"ai_insight_generation_requested"/i);
  assert.match(aiInsights, /recordFunctionSecurityEvent\([\s\S]*"ai_insight_generation_blocked"/i);
  assert.doesNotMatch(aiInsights, /service_create_rules_engine_ai_insight/i);
  assert.doesNotMatch(aiInsights, /\.from\("ai_insights"\)[\s\S]*\.insert\(/i);
  assert.doesNotMatch(aiInsights, /generated_placeholder|ready_not_executed/i);
  assert.match(linkGmail, /requireUuid\(body\.restaurantId,\s*"restaurantId"\)/i);
  assert.match(linkGmail, /recordFunctionAuditLog\([\s\S]*"gmail_link_started"/i);
  assert.doesNotMatch(linkGmail, /missing_google_oauth_secrets/i);
  assert.match(sendEmail, /requireUuid\(body\.restaurantId,\s*"restaurantId"\)/i);
  assert.match(sendEmail, /requireUuid\(body\.orderId,\s*"orderId"\)/i);
  assert.match(sendEmail, /recordFunctionAuditLog\([\s\S]*"supplier_email_prepare_requested"/i);
  assert.match(sendEmail, /recordFunctionSecurityEvent\([\s\S]*"supplier_email_prepared"/i);
});

test("Edge Function firewall migration rate-limits sensitive server workflows", () => {
  const migration = readFileSync("supabase/migrations/20260627053512_edge_function_firewall.sql", "utf8");

  assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+private\.edge_function_security_events/i);
  assert.match(migration, /alter\s+table\s+private\.edge_function_security_events\s+enable\s+row\s+level\s+security/i);
  assert.match(migration, /revoke\s+all\s+on\s+table\s+private\.edge_function_security_events\s+from\s+public,\s+anon,\s+authenticated/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.reserve_edge_function_invocation/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.record_edge_function_security_event/i);
  assert.match(migration, /private\.has_restaurant_role\(target_restaurant_id,\s*current_policy\.allowed_roles\)/i);
  assert.match(migration, /private\.is_restaurant_member\(target_restaurant_id\)/i);
  assert.match(migration, /'sync-pos-sales',\s*8,\s*60,\s*array\['owner',\s*'admin',\s*'manager'\]/i);
  assert.match(migration, /'link-gmail',\s*4,\s*300,\s*array\['owner',\s*'admin'\]/i);
  assert.match(migration, /'rate_limited'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.reserve_edge_function_invocation\(uuid,\s*text,\s*text,\s*jsonb\)\s+from\s+public,\s+anon/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.reserve_edge_function_invocation\(uuid,\s*text,\s*text,\s*jsonb\)\s+to\s+authenticated/i);
});

test("workflow authority hardening removes direct writes and makes Edge telemetry reservation-bound", () => {
  const migration = readFileSync("supabase/migrations/20260713100023_harden_workflow_authority.sql", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const shared = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  const operationalMigration = readFileSync("supabase/migrations/20260714183310_secure_operational_workflows.sql", "utf8");

  for (const table of ["purchase_recommendations", "supplier_orders", "insights", "audit_logs"]) {
    assert.match(
      migration,
      new RegExp(`revoke\\s+insert,\\s*update,\\s*delete\\s+on\\s+public\\.${table}\\s+from\\s+authenticated`, "i")
    );
  }
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.create_pending_purchase_recommendation/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.replace_pending_purchase_recommendations/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.replace_operational_insights/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.record_setup_completion_audit/i);
  assert.match(migration, /recommended_quantity\s*>\s*0[\s\S]*recommended_quantity\s*<=\s*1000000/i);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*p_actor_user_id/i);
  assert.match(migration, /reservation_id[\s\S]*unique\s+index/i);
  assert.match(migration, /grant\s+execute[\s\S]*reserve_edge_function_invocation\(uuid,\s*uuid,\s*text,\s*text,\s*jsonb\)\s+to\s+service_role/i);
  assert.match(migration, /revoke\s+all[\s\S]*reserve_edge_function_invocation\(uuid,\s*uuid,\s*text,\s*text,\s*jsonb\)[\s\S]*authenticated/i);
  assert.match(migration, /drop\s+function\s+public\.reserve_edge_function_invocation\(uuid,\s*text,\s*text,\s*jsonb\)/i);

  assert.match(repository, /action:\s*"create_pending_purchase_recommendation"/i);
  assert.doesNotMatch(repository, /rpc\("create_pending_purchase_recommendation"/i);
  assert.doesNotMatch(repository, /rpc\("replace_pending_purchase_recommendations"/i);
  assert.doesNotMatch(repository, /rpc\("replace_operational_insights"/i);
  assert.match(repository, /functions\.invoke\("operational-workflows"/i);
  assert.match(operationalMigration, /generation_source[\s\S]*mise_rules/i);
  assert.match(operationalMigration, /revoke\s+all[\s\S]*replace_pending_purchase_recommendations[\s\S]*authenticated/i);
  assert.doesNotMatch(repository, /from\("purchase_recommendations"\)\.insert\(inserts\)/i);
  assert.match(shared, /SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(shared, /p_reservation_id:\s*reservationId/i);
});

test("final security posture keeps Edge reservation and setup attachments off authenticated DML", () => {
  const authority = readFileSync("supabase/migrations/20260713100023_harden_workflow_authority.sql", "utf8");
  const atomicSetup = readFileSync(
    "supabase/migrations/20260713103021_atomic_setup_and_operational_signals.sql",
    "utf8"
  );
  const securityStatic = readFileSync("scripts/security-static.mjs", "utf8");

  assert.match(authority, /drop\s+function\s+public\.reserve_edge_function_invocation\(uuid,\s*text,\s*text,\s*jsonb\)/i);
  assert.match(
    authority,
    /grant\s+execute\s+on\s+function\s+public\.reserve_edge_function_invocation\(uuid,\s*uuid,\s*text,\s*text,\s*jsonb\)\s+to\s+service_role/i
  );
  assert.match(
    authority,
    /revoke\s+all\s+on\s+function\s+public\.reserve_edge_function_invocation\(uuid,\s*uuid,\s*text,\s*text,\s*jsonb\)\s+from\s+public,\s+anon,\s+authenticated/i
  );
  assert.match(atomicSetup, /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.setup_attachments\s+from\s+authenticated/i);
  assert.match(
    securityStatic,
    /legacy reserve_edge_function_invocation\(uuid,text,text,jsonb\) must be dropped/i
  );
  assert.match(
    securityStatic,
    /reservation-bound reserve_edge_function_invocation must be executable by service_role/i
  );
  assert.match(
    securityStatic,
    /setup_attachments DML must be revoked from authenticated clients/i
  );
  assert.doesNotMatch(
    securityStatic,
    /reserve_edge_function_invocation must be executable by authenticated users only/i
  );
});

test("operational constraints keep public tables structured and token-free", () => {
  const migration = readFileSync("supabase/migrations/20260625212050_operational_constraints.sql", "utf8");

  assert.match(migration, /inventory_items_operational_values_check/i);
  assert.match(migration, /purchase_recommendations_operational_values_check/i);
  assert.match(migration, /supplier_orders_operational_values_check/i);
  assert.match(migration, /pos_integrations_public_settings_no_secret_keys_check/i);
  assert.match(migration, /sales_imports_public_metadata_no_secret_keys_check/i);
  assert.match(migration, /setup_attachments_metadata_only_check/i);
  assert.match(migration, /metadata->>'storage_status'\s*=\s*'metadata_only'/i);
  assert.match(migration, /not\s+\(metadata\s+\?\|\s+array\[/i);
});

test("direct detail routes render fallback states instead of indefinite loading", () => {
  const inventoryDetail = readFileSync("app/inventory/[id].tsx", "utf8");
  const orderDetail = readFileSync("app/orders/[id].tsx", "utf8");

  assert.match(inventoryDetail, /if\s*\(\s*!restaurant\s*\|\|\s*!id\s*\)\s*\{[\s\S]*setLoading\(false\)/i);
  assert.match(orderDetail, /if\s*\(\s*!restaurant\s*\|\|\s*!id\s*\)\s*\{[\s\S]*setLoading\(false\)/i);
  assert.doesNotMatch(inventoryDetail, /if\s*\(\s*!restaurant\s*\|\|\s*!id\s*\)\s*return;/i);
  assert.doesNotMatch(orderDetail, /if\s*\(\s*!restaurant\s*\|\|\s*!id\s*\)\s*return;/i);
});

test("telemetry helper redacts secret-like properties before sending", () => {
  const sanitized = sanitizeTelemetryProperties({
    restaurant_id: "restaurant_a",
    action: "setup_completed",
    gmail_refresh_token: "should-not-leave-client",
    nested: {
      authorization: "Bearer secret",
      count: 2
    }
  });

  assert.equal(sanitized.restaurant_id, "restaurant_a");
  assert.equal(sanitized.gmail_refresh_token, "[redacted]");
  assert.deepEqual(sanitized.nested, {
    authorization: "[redacted]",
    count: 2
  });
});

test("public schema does not hold privileged security definer helpers", () => {
  const schema = readFileSync("supabase/schema.sql", "utf8");
  const publicFunctionBlocks = [...schema.matchAll(/create\s+or\s+replace\s+function\s+public\.[\s\S]*?\$\$;/gi)].map(
    (match) => match[0]
  );

  assert.ok(publicFunctionBlocks.length > 0);
  assert.equal(publicFunctionBlocks.some((block) => /security\s+definer/i.test(block)), false);
});

test("package exposes private-beta backend security gates", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const scripts = packageJson.scripts as Record<string, string>;
  const script = (name: string): string => {
    const value = scripts[name];
    if (typeof value !== "string") {
      throw new Error(`Missing package script: ${name}`);
    }
    return value;
  };

  assert.match(script("security:backend"), /scripts\/security-backend\.mjs/);
  assert.match(script("supabase:test"), /scripts\/supabase-local-test\.mjs/);
  assert.equal(script("doctor"), "expo-doctor");
  assert.match(script("verify:private-beta-security:local"), /security:backend/);
  assert.match(script("verify:private-beta-security:local"), /supabase:test/);
  assert.match(script("verify:private-beta-security:local"), /doctor/);
  assert.match(script("verify:private-beta-security:local"), /qa:routes/);
  assert.match(script("verify:private-beta-security:local"), /qa:interactions/);
  assert.match(script("verify:private-beta-security:hosted"), /verify-hosted-security\.mjs/);
  assert.match(script("verify:private-beta-security"), /verify-private-beta-security\.mjs/);
  assert.match(script("staging:seed"), /staging-seed\.mjs/);
  assert.match(script("staging:service-rpc"), /staging-service-rpc-check\.mjs/);
  assert.match(script("staging:edge-concurrency"), /staging-edge-concurrency\.mjs/);
  assert.match(script("staging:client-race"), /staging-client-race\.mjs/);
  assert.match(script("verify:beta"), /security:backend/);
  assert.match(script("verify:beta"), /doctor/);
  assert.match(script("verify:beta"), /qa:interactions/);
  assert.match(script("demo:ready"), /security:backend/);
  assert.match(script("demo:ready"), /doctor/);
  assert.match(script("demo:ready"), /qa:interactions/);
  assert.match(script("verify:paid-product"), /verify:private-beta-security/);

  assert.equal(packageJson.dependencies.expo, "~56.0.18");
  assert.equal(packageJson.dependencies["expo-router"], "~56.2.17");
  assert.equal(packageJson.dependencies["expo-constants"], "~56.0.18");
  assert.equal(packageJson.dependencies["expo-linking"], "~56.0.16");
  assert.equal(packageJson.dependencies["expo-splash-screen"], "~56.0.14");
  assert.equal(packageJson.dependencies["react-native-screens"], "~4.26.0");
  assert.equal(packageJson.devDependencies["expo-doctor"], "1.20.1");

  const localDatabaseGate = readFileSync("scripts/supabase-local-test.mjs", "utf8");
  assert.match(localDatabaseGate, /minimalChildEnv/);
  assert.match(localDatabaseGate, /\["db", "start"\]/);
  assert.match(localDatabaseGate, /\["db", "reset"\]/);
  assert.match(localDatabaseGate, /\["db", "advisors", "--local", "--type", "security", "--fail-on", "error"\]/);
  assert.match(localDatabaseGate, /mkdtempSync\(join\(tmpdir\(\)/);
  assert.doesNotMatch(localDatabaseGate, /SUPABASE_STAGING_SECRET_KEY|MISE_STAGING_SEED_PASSWORD/);
});

test("protected CircleCI closure enforces the complete local gate before staging", () => {
  const config = readFileSync(".circleci/config.yml", "utf8");

  assert.match(config, /cimg\/node:22\.13-browsers/);
  assert.match(config, /browser-tools: circleci\/browser-tools@2\.4\.2/);
  assert.equal(config.match(/browser-tools\/install_chrome/g)?.length, 2);
  for (const command of [
    "npm run typecheck",
    "npm test",
    "npm audit --audit-level=high",
    "npm run doctor",
    "npm run design:static",
    "npm run qa:routes",
    "npm run qa:interactions",
    "npm run security:backend",
    "npm run supabase:test",
    "npm run verify:private-beta-security:hosted"
  ]) {
    assert.match(config, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(config, /context: mise-staging-security/);
  assert.match(config, /requires:\s*\n\s*- verify\s*\n\s*- db_security/);
  assert.match(config, /branches:\s*\n\s*only: main/);
});

test("Expo release config uses the supported splash plugin and mobile QA discovers Linux Chrome", () => {
  const appConfig = JSON.parse(readFileSync("app.json", "utf8"));
  const expo = appConfig.expo as Record<string, unknown> & { plugins: unknown[] };
  const splashRegistration = expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen"
  );

  assert.equal(Object.hasOwn(expo, "newArchEnabled"), false);
  assert.equal(Object.hasOwn(expo, "splash"), false);
  assert.deepEqual(splashRegistration, [
    "expo-splash-screen",
    {
      image: "./assets/splash-icon.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#F7F3ED"
    }
  ]);

  const mobileQa = readFileSync("scripts/mobile-layout-smoke.mjs", "utf8");
  assert.match(mobileQa, /process\.env\.CHROME_PATH/);
  assert.match(mobileQa, /\/usr\/bin\/google-chrome/);
  assert.match(mobileQa, /\/usr\/bin\/chromium/);
  assert.match(mobileQa, /install Chrome\/Chromium before running mobile QA/);
});

test("backend security script proves local RLS, Data API grants, and firewall guards", () => {
  const script = readFileSync("scripts/security-backend.mjs", "utf8");

  assert.match(script, /security-static\.mjs/);
  assert.match(script, /major_version\s+must\s+be\s+15\+/i);
  assert.match(script, /enable\\\\s\+row\\\\s\+level\\\\s\+security/i);
  assert.match(script, /authenticated Data API grant/i);
  assert.match(script, /restaurant_id uuid not null/i);
  assert.match(script, /auth\.role/i);
  assert.match(script, /SECURITY DEFINER/i);
  assert.match(script, /buildFinalFunctionInventory/);
  assert.match(script, /verify_jwt\s*=\s*true/i);
  assert.match(script, /requireAuthenticatedContext/);
  assert.match(script, /reserveFunctionInvocation/);
  assert.match(script, /recordFunctionSecurityEvent/);
  assert.doesNotMatch(script, /Hosted staging tenant checks skipped/i);
  assert.doesNotMatch(script, /staging-tenant-check\.mjs/);
});

test("private-beta closure fails closed and runs every hosted proof", () => {
  const combined = readFileSync("scripts/verify-private-beta-security.mjs", "utf8");
  const hosted = readFileSync("scripts/verify-hosted-security.mjs", "utf8");

  for (const required of [
    "SUPABASE_STAGING_URL",
    "SUPABASE_STAGING_PROJECT_REF",
    "SUPABASE_STAGING_ANON_KEY",
    "SUPABASE_STAGING_SECRET_KEY",
    "MISE_STAGING_MARKER",
    "MISE_STAGING_SEED_PASSWORD"
  ]) {
    assert.match(combined, new RegExp(required));
    assert.match(hosted, new RegExp(required));
  }
  assert.match(combined, /fail-closed/i);
  assert.match(combined, /verify:private-beta-security:local/);
  assert.match(combined, /verify:private-beta-security:hosted/);
  assert.match(hosted, /staging:seed/);
  assert.match(hosted, /staging:client-race/);
  assert.match(hosted, /staging:tenant-check/);
  assert.match(hosted, /staging:service-rpc/);
  assert.match(hosted, /staging:edge-concurrency/);
});

test("staging tenant check covers private-beta restaurant data and role boundaries", () => {
  const script = readFileSync("scripts/staging-tenant-check.mjs", "utf8");
  const seed = readFileSync("scripts/staging-seed.mjs", "utf8");

  const tenantTables = [
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
    "pos_integrations",
    "sales_imports",
    "insights",
    "supplier_items",
    "purchase_orders",
    "ai_insights",
    "restaurant_email_connections",
    "supplier_recipients",
    "setup_attachments",
    "audit_logs",
    "restaurant_memberships"
  ];
  tenantTables.forEach((table) => assert.match(script, new RegExp(table)));
  const operationalTables = tenantTables.filter((table) => table !== "restaurant_memberships");
  const mutationMatrix = script.slice(
    script.indexOf("const crossTenantMutationProbes"),
    script.indexOf("const directInventoryUpdate")
  );
  operationalTables.forEach((table) => {
    assert.match(seed, new RegExp(`upsert\\(["']${table}["']`));
    assert.match(mutationMatrix, new RegExp(`table: ["']${table}["']`));
  });
  assert.match(seed, /inventory_count_lines/);
  assert.match(seed, /storage_locations/);
  assert.match(script, /tenantCFixtureTables/);

  assert.match(script, /unauthenticated users cannot read restaurant inventory/i);
  assert.match(script, /manager A cannot read tenant B/i);
  assert.match(script, /crossTenantMutationProbes/);
  assert.match(script, /cannot INSERT into unrelated tenant C/i);
  assert.match(script, /cannot UPDATE tenant B/i);
  assert.match(script, /cannot DELETE tenant B/i);
  assert.match(script, /tenant B .* fixture remains unchanged/i);
  assert.match(script, /staff cannot update inventory rows/i);
  assert.match(script, /owner A can update tenant A restaurant profile/i);
  assert.match(script, /client audit insert rejects forged actor_user_id/i);
  assert.match(script, /tenant B .* was not mutated/i);
});

test("hosted Edge and service RPC checks forge every privileged tenant boundary", () => {
  const edge = readFileSync("scripts/staging-edge-concurrency.mjs", "utf8");
  const serviceRpc = readFileSync("scripts/staging-service-rpc-check.mjs", "utf8");

  for (const functionName of [
    "sync-pos-sales",
    "generate-ai-insights",
    "link-gmail",
    "send-supplier-email",
    "operational-workflows"
  ]) {
    assert.match(edge, new RegExp(functionName));
  }
  assert.match(
    edge,
    /functionName: "link-gmail",[\s\S]*?token: ownerA\.token,[\s\S]*?restaurantId: tenantB/,
    "the Gmail tenant-forgery probe uses a source-tenant-authorized owner"
  );
  assert.match(edge, /sameTenantInvocations/);
  assert.match(edge, /must pass the source-tenant role boundary/);
  assert.match(edge, /authorized caller cannot forge tenant B/i);

  for (const functionName of [
    "reserve_edge_function_invocation",
    "record_edge_function_security_event",
    "service_fetch_operational_planning_snapshot",
    "service_mark_operational_signals_pending",
    "service_commit_operational_signals",
    "service_update_inventory_and_signals",
    "service_record_inventory_waste_and_signals",
    "service_create_inventory_item_and_signals",
    "service_begin_inventory_count_session",
    "service_approve_inventory_count_session",
    "service_save_recipe_and_signals",
    "service_delete_recipe_and_signals",
    "service_create_rules_engine_ai_insight",
    "service_record_edge_audit_log"
  ]) {
    assert.match(serviceRpc, new RegExp(functionName));
  }
  assert.match(serviceRpc, /await assertStagingPreflight\(\)/);
  assert.match(serviceRpc, /createClient\(url, secretKey/);
  assert.ok(
    serviceRpc.indexOf("await assertStagingPreflight()") < serviceRpc.indexOf("createClient(url, secretKey"),
    "the staging marker must be verified before the service key is transmitted"
  );
});

test("rendered staging races cover every tenant-sensitive operational surface", () => {
  const script = readFileSync("scripts/staging-client-race.mjs", "utf8");

  for (const marker of [
    "Review Espresso Beans reorder",
    "Espresso Beans",
    "Northside espresso",
    "Cafe Supply",
    "Back to inventory",
    "Back to orders",
    "functions/v1/operational-workflows"
  ]) {
    assert.match(script, new RegExp(marker));
  }
  assert.match(script, /tenantAInventoryId/);
  assert.match(script, /tenantBInventoryId/);
  assert.match(script, /tenantAOrderId/);
  assert.match(script, /tenantBOrderId/);
  assert.match(script, /Fetch\.requestPaused/);
  assert.match(script, /Dual-tenant account did not establish tenant A before race checks/);
});

test("approval quantity bounds are enforced at service, demo, and RPC boundaries", () => {
  const service = readFileSync("services/application/orders.ts", "utf8");
  const inventoryService = readFileSync("services/application/inventory.ts", "utf8");
  const setupService = readFileSync("services/application/setup.ts", "utf8");
  const demo = readFileSync("services/domain/miseDomain.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260714035118_enforce_approval_quantity_bounds.sql",
    "utf8"
  );

  assert.match(service, /requireRecommendationApprovalQuantity\(recommendedQuantity\)/);
  assert.match(inventoryService, /requireInventoryItemPatch\(patch\)/);
  assert.match(inventoryService, /requireRecipeBaselineQuantity\(quantityUsedPerSale\)/);
  assert.match(setupService, /validateSetupInput\(input\)[\s\S]*saveRestaurantSetupSnapshot/);
  assert.match(demo, /recommendedQuantity\s*<=\s*0/);
  assert.match(demo, /recommendedQuantity\s*>\s*1_000_000/);
  assert.match(migration, /p_recommended_quantity\s*<=\s*0/);
  assert.match(migration, /p_recommended_quantity\s*>\s*1000000/);
  assert.match(migration, /'NaN',\s*'Infinity',\s*'-Infinity'/);
  assert.match(migration, /security\s+definer/i);
  assert.match(migration, /auth\.uid\(\)\s+is\s+null/i);
  assert.match(migration, /revoke\s+all[\s\S]*from\s+public,\s*anon/i);
});

test("recommendation acceptance integrity preserves originals and optional dismiss reasons", () => {
  const migration = readFileSync(
    "supabase/migrations/20260802001000_recommendation_acceptance_integrity.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const demo = readFileSync("services/domain/miseDomain.ts", "utf8");
  const service = readFileSync("services/application/orders.ts", "utf8");
  const pgTap = readFileSync(
    "supabase/tests/database/recommendation_acceptance_integrity.test.sql",
    "utf8"
  );

  assert.match(migration, /original_recommended_quantity/);
  assert.match(migration, /dismiss_reason/);
  assert.match(migration, /char_length\(safe_dismiss_reason\) > 240/);
  assert.match(migration, /when previous_status = 'pending' then recommendation_row\.recommended_quantity/);
  assert.match(migration, /original_recommended_quantity is not null/);
  assert.match(edge, /p_dismiss_reason/);
  assert.match(edge, /dismissReason/);
  assert.match(edge, /original_recommended_quantity/);
  assert.match(edge, /quantity_edited/);
  assert.match(demo, /original_recommended_quantity = recommendation\.recommended_quantity/);
  assert.match(demo, /Dismiss reason is outside supported limits/);
  assert.match(service, /requireOptionalDismissReason\(dismissReason\)/);
  assert.match(pgTap, /edited approval preserves the original Mise quantity/);
  assert.match(pgTap, /undo restores the original Mise quantity/);
  assert.match(pgTap, /dismiss stores a trimmed reason/);
});

test("receive discrepancy learning exposes bounded receivingHistory without client write authority", () => {
  const migration = readFileSync(
    "supabase/migrations/20260802010000_receive_discrepancy_learning_snapshot.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const domain = readFileSync("services/domain/receiveDiscrepancyLearning.ts", "utf8");
  const signals = readFileSync("services/domain/operationalSignals.ts", "utf8");
  const pgTap = readFileSync(
    "supabase/tests/database/receive_discrepancy_learning.test.sql",
    "utf8"
  );

  assert.match(migration, /'receivingHistory'/);
  assert.match(migration, /reason = 'receiving'/);
  assert.match(migration, /inventory_movements_restaurant_receiving_created_at_idx/);
  assert.match(migration, /limit 500/);
  assert.match(edge, /receivingHistory:\s*\[\.\.\.inFlightReceives/);
  assert.match(edge, /supplier_order_id === orderId/);
  assert.match(domain, /RECEIVE_FILL_MULTIPLIER_MAX = 1\.25/);
  assert.match(domain, /RECEIVE_FILL_LEARNING_MIN_SAMPLES = 3/);
  assert.match(signals, /buildReceiveFillBiasByItem/);
  assert.match(signals, /insight\.rule\.ordering\.chronic_short_ship/);
  assert.match(pgTap, /planning snapshot includes receivingHistory key/);
  assert.match(pgTap, /staff cannot receive supplier orders/);
  assert.match(pgTap, /receivingHistory quantityOrdered matches accepted ordered qty/);
});

test("manual add-to-order uses stacked restaurant learning instead of raw suggested quantities", () => {
  const application = readFileSync("services/application/inventory.ts", "utf8");
  const domain = readFileSync("services/domain/miseDomain.ts", "utf8");

  assert.match(application, /planManualPendingRecommendation/);
  assert.match(application, /receivingHistory:\s*data\.receivingHistory/);
  assert.match(application, /wasteHistory:\s*data\.wasteHistory/);
  assert.match(application, /countVarianceHistory:\s*data\.countVarianceHistory/);
  assert.doesNotMatch(
    application.match(/export async function addInventoryItemToOrder[\s\S]*?\n\}/)?.[0] ?? "",
    /recommended_quantity:\s*prediction\.suggestedOrderQuantity/
  );
  assert.match(domain, /export function planManualPendingRecommendation/);
  assert.match(domain, /export function applyStackedOrderLearning/);
  assert.match(domain, /applyReceiveFillBias/);
  assert.match(domain, /applyLossBias/);
});

test("waste and count-variance learning exposes bounded ledger history without client write authority", () => {
  const migration = readFileSync(
    "supabase/migrations/20260802030000_waste_count_variance_learning_snapshot.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const domain = readFileSync("services/domain/wasteVarianceLearning.ts", "utf8");
  const signals = readFileSync("services/domain/operationalSignals.ts", "utf8");
  const today = readFileSync("services/domain/todayTasks.ts", "utf8");
  const pgTap = readFileSync(
    "supabase/tests/database/waste_count_variance_learning.test.sql",
    "utf8"
  );

  assert.match(migration, /'wasteHistory'/);
  assert.match(migration, /'countVarianceHistory'/);
  assert.match(migration, /reason = 'waste'/);
  assert.match(migration, /reason = 'manual_count'/);
  assert.match(migration, /inventory_movements_restaurant_waste_created_at_idx/);
  assert.match(migration, /inventory_movements_restaurant_manual_count_created_at_idx/);
  assert.match(migration, /limit 500/);
  assert.match(edge, /wasteHistory:\s*\[\.\.\.inFlightWaste/);
  assert.match(edge, /countVarianceHistory:\s*\[\.\.\.inFlightCountVariance/);
  assert.match(domain, /LOSS_MULTIPLIER_MAX = 1\.2/);
  assert.match(domain, /LOSS_LEARNING_MIN_SAMPLES = 3/);
  assert.match(signals, /buildWasteBiasByItem/);
  assert.match(signals, /buildCountShrinkBiasByItem/);
  assert.match(signals, /insight\.rule\.waste\.chronic_waste/);
  assert.match(signals, /insight\.rule\.inventory\.chronic_count_shrink/);
  assert.match(today, /today\.waste\.chronic_waste/);
  assert.match(today, /today\.inventory\.chronic_count_shrink/);
  assert.match(pgTap, /planning snapshot includes wasteHistory key/);
  assert.match(pgTap, /planning snapshot includes countVarianceHistory key/);
  assert.match(pgTap, /wasteHistory quantityRemoved matches applied waste qty/);
  assert.match(pgTap, /countVarianceHistory variance matches shrink amount/);
});

test("manager-correction learning exposes bounded ledger history without client write authority", () => {
  const migration = readFileSync(
    "supabase/migrations/20260802040930_manager_correction_learning_snapshot.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const domain = readFileSync("services/domain/wasteVarianceLearning.ts", "utf8");
  const signals = readFileSync("services/domain/operationalSignals.ts", "utf8");
  const today = readFileSync("services/domain/todayTasks.ts", "utf8");
  const pgTap = readFileSync(
    "supabase/tests/database/manager_correction_learning.test.sql",
    "utf8"
  );
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const inventory = readFileSync("services/application/inventory.ts", "utf8");

  assert.match(migration, /'managerCorrectionHistory'/);
  assert.match(migration, /reason = 'manager_correction'/);
  assert.match(migration, /inventory_movements_restaurant_manager_correction_created_at_idx/);
  assert.match(migration, /movement\.quantity_after < movement\.quantity_before/);
  assert.match(migration, /limit 500/);
  assert.match(edge, /managerCorrectionHistory:\s*\[\s*\.\.\.inFlightManagerCorrection/);
  assert.match(domain, /extractManagerCorrectionSamplesFromMovements/);
  assert.match(domain, /buildManagerCorrectionBiasByItem/);
  assert.match(signals, /buildManagerCorrectionBiasByItem/);
  assert.match(signals, /insight\.rule\.inventory\.chronic_manager_correction/);
  assert.match(today, /today\.inventory\.chronic_manager_correction/);
  assert.match(repository, /extractManagerCorrectionSamplesFromMovements/);
  assert.match(inventory, /managerCorrectionHistory:\s*data\.managerCorrectionHistory/);
  assert.match(pgTap, /planning snapshot includes managerCorrectionHistory key/);
  assert.match(pgTap, /managerCorrectionHistory variance matches downward correction/);
  assert.match(pgTap, /managerCorrectionHistory ignores upward corrections/);
});

test("acceptance-edit learning uses original vs accepted quantities without client write authority", () => {
  const migration = readFileSync(
    "supabase/migrations/20260802050000_acceptance_edit_learning_index.sql",
    "utf8"
  );
  const domain = readFileSync("services/domain/acceptanceEditLearning.ts", "utf8");
  const signals = readFileSync("services/domain/operationalSignals.ts", "utf8");
  const miseDomain = readFileSync("services/domain/miseDomain.ts", "utf8");
  const today = readFileSync("services/domain/todayTasks.ts", "utf8");
  const todayApp = readFileSync("services/application/today.ts", "utf8");
  const presentation = readFileSync("services/presentation/operationsPresentation.ts", "utf8");
  const pgTap = readFileSync(
    "supabase/tests/database/acceptance_edit_learning.test.sql",
    "utf8"
  );

  assert.match(migration, /purchase_recommendations_restaurant_acceptance_edit_created_at_idx/);
  assert.match(migration, /original_recommended_quantity is not null/);
  assert.match(migration, /status in \('approved', 'ordered'\)/);
  assert.match(domain, /ACCEPTANCE_EDIT_MULTIPLIER_MAX = 1\.25/);
  assert.match(domain, /ACCEPTANCE_EDIT_MULTIPLIER_MIN = 0\.8/);
  assert.match(domain, /ACCEPTANCE_EDIT_LEARNING_MIN_SAMPLES = 3/);
  assert.match(domain, /extractAcceptanceEditSamplesFromRecommendations/);
  assert.match(domain, /buildAcceptanceEditBiasByItem/);
  assert.match(signals, /buildAcceptanceEditBiasByItem/);
  assert.match(signals, /applyAcceptanceEditBias/);
  assert.match(signals, /insight\.rule\.ordering\.chronic_acceptance_edit/);
  assert.match(signals, /original_recommended_quantity\?:/);
  assert.match(miseDomain, /acceptanceEditBias/);
  assert.match(miseDomain, /applyAcceptanceEditBias/);
  assert.match(today, /today\.ordering\.chronic_acceptance_edit/);
  assert.match(todayApp, /extractAcceptanceEditSamplesFromRecommendations/);
  assert.match(todayApp, /chronicAcceptanceEditItems/);
  assert.match(presentation, /chronicAcceptanceEditTitle/);
  assert.match(presentation, /reviewApprovals/);
  assert.match(pgTap, /acceptance-edit learning index exists/);
  assert.match(pgTap, /planning recommendationHistory exposes original vs accepted/);
  assert.match(pgTap, /authenticated clients cannot rewrite accepted recommendation quantities/);
});

test("dismissal-reason clustering learns category patterns without client write authority", () => {
  const migration = readFileSync(
    "supabase/migrations/20260802060000_recommendation_dismissal_learning_index.sql",
    "utf8"
  );
  const domain = readFileSync("services/domain/recommendationDismissalLearning.ts", "utf8");
  const signals = readFileSync("services/domain/operationalSignals.ts", "utf8");
  const miseDomain = readFileSync("services/domain/miseDomain.ts", "utf8");
  const today = readFileSync("services/domain/todayTasks.ts", "utf8");
  const todayApp = readFileSync("services/application/today.ts", "utf8");
  const presentation = readFileSync("services/presentation/operationsPresentation.ts", "utf8");
  const pgTap = readFileSync(
    "supabase/tests/database/recommendation_dismissal_learning.test.sql",
    "utf8"
  );

  assert.match(migration, /purchase_recommendations_restaurant_dismissal_learning_created_at_idx/);
  assert.match(migration, /status = 'dismissed'/);
  assert.match(migration, /dismiss_reason is not null/);
  assert.match(domain, /DISMISSAL_LEARNING_MIN_SAMPLES = 3/);
  assert.match(domain, /DISMISSAL_DOMINANT_SHARE = 0\.6/);
  assert.match(domain, /classifyDismissReason/);
  assert.match(domain, /extractDismissalSamplesFromRecommendations/);
  assert.match(domain, /buildDismissalFeedbackByItem/);
  assert.match(domain, /never auto-suppressed|never suppresses/i);
  assert.match(signals, /buildDismissalFeedbackByItem/);
  assert.match(signals, /dismissalFeedbackReasonFragment/);
  assert.match(signals, /insight\.rule\.ordering\.chronic_dismissal/);
  assert.match(signals, /dismiss_reason\?:/);
  assert.match(signals, /recommendationHistory: OperationalRecommendationHistory\[] = \[\]/);
  assert.match(signals, /recommendationHistory,/);
  assert.doesNotMatch(
    signals,
    /buildInsightsFromData\([\s\S]*recommendationHistory: \[\]/
  );
  assert.match(miseDomain, /dismissalFeedback/);
  assert.match(miseDomain, /extractDismissalSamplesFromRecommendations/);
  assert.match(today, /today\.ordering\.chronic_dismissal/);
  assert.match(todayApp, /extractDismissalSamplesFromRecommendations/);
  assert.match(todayApp, /chronicDismissalItems/);
  assert.match(presentation, /chronicDismissalTitle/);
  assert.match(presentation, /reviewDismissals/);
  const recalculations = readFileSync("services/application/recalculations.ts", "utf8");
  assert.match(recalculations, /buildInsightsFromData\([\s\S]*recommendationHistory/);
  assert.match(pgTap, /dismissal learning index exists/);
  assert.match(pgTap, /planning recommendationHistory exposes dismiss_reason/);
  assert.match(pgTap, /authenticated clients cannot rewrite dismiss_reason/);
});

test("security readiness document defines private-beta backend rules and public launch blockers", () => {
  const doc = readFileSync("docs/security-readiness.md", "utf8");

  assert.match(doc, /npm run verify:private-beta-security/);
  assert.match(doc, /`restaurant_memberships` is the authorization source/);
  assert.match(doc, /explicit `authenticated` grants/);
  assert.match(doc, /No policy may use broad `USING \(true\)`/);
  assert.match(doc, /Demo data is local-only/);
  assert.match(doc, /verify_jwt = true/);
  assert.match(doc, /Provider credentials belong in backend-only Supabase Edge Function secrets/);
  assert.match(doc, /Do not use real restaurant data until all are true/);
  assert.match(doc, /Public-Launch Blockers/);
});

test("membership and profile tables lose residual authenticated DML grants", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801211000_revoke_membership_and_profile_dml.sql",
    "utf8"
  );
  const tenantTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const localeTests = readFileSync("supabase/tests/database/operator_locale_preference.test.sql", "utf8");

  assert.match(
    migration,
    /revoke insert, update, delete on table public\.restaurant_memberships from authenticated/i
  );
  assert.match(migration, /revoke update on table public\.users from authenticated/i);
  assert.match(tenantTests, /membership inserts are RPC-only/i);
  assert.match(tenantTests, /legacy user profile updates are RPC-only/i);
  assert.match(localeTests, /authenticated clients cannot update preferred_locale directly/i);
});

test("orphan authenticated write RLS policies are dropped on service-owned operational tables", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801230000_drop_orphan_operational_write_policies.sql",
    "utf8"
  );
  const tenantTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");

  for (const policy of [
    "Managers can insert inventory",
    "Managers can update inventory",
    "Owners and admins can delete inventory",
    "Managers can insert menu mappings",
    "Managers can update menu mappings",
    "Owners and admins can delete menu mappings",
    "Managers can insert sales",
    "Managers can update sales",
    "Owners and admins can delete sales",
    "Managers can insert setup attachments",
    "Managers can update setup attachments",
    "Owners and admins can delete setup attachments"
  ]) {
    assert.match(
      migration,
      new RegExp(`drop policy if exists "${policy}" on public\\.(inventory_items|menu_item_ingredients|pos_sales|setup_attachments)`, "i")
    );
  }

  assert.match(tenantTests, /inventory_items has no direct authenticated write policies/i);
  assert.match(tenantTests, /menu_item_ingredients has no direct authenticated write policies/i);
  assert.match(tenantTests, /pos_sales has no direct authenticated write policies/i);
  assert.match(tenantTests, /setup_attachments has no direct authenticated write policies/i);
  assert.match(securityBackend, /function buildFinalAuthenticatedPolicies\s*\(/);
  assert.match(securityBackend, /must not retain authenticated write policies/i);
});

test("secondary operational tables lose authenticated DML and inventory movements are ledgered", () => {
  const migration = readFileSync(
    "supabase/migrations/20260730211800_close_secondary_dml_and_inventory_movements.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/request-account-deletion/index.ts", "utf8");
  const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");

  assert.match(migration, /create table if not exists public\.inventory_movements/i);
  assert.match(migration, /insert into public\.inventory_movements/i);
  assert.match(migration, /reason in \(\s*'manual_count'/i);
  assert.match(
    migration,
    /revoke insert, update, delete on table[\s\S]*public\.pos_integrations[\s\S]*public\.purchase_orders[\s\S]*from authenticated/i
  );
  assert.match(migration, /create table if not exists public\.account_deletion_requests/i);
  assert.match(migration, /create or replace function public\.request_my_account_deletion/i);
  assert.match(migration, /subject_user_id uuid not null/i);
  assert.match(config, /\[functions\.request-account-deletion\][\s\S]*verify_jwt\s*=\s*true/i);
  assert.match(edge, /service_request_my_account_deletion/);
  assert.match(edge, /auth\.admin\.deleteUser/);
  assert.match(settings, /requestAccountDeletion/);
  assert.match(settings, /EXPO_PUBLIC_PRIVACY_POLICY_URL|privacyPolicyUrl/);
});

test("sole-owner account deletion archives restaurants and rolls back Auth failures", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801050742_sole_owner_account_deletion.sql",
    "utf8"
  );
  const edgeMigration = readFileSync(
    "supabase/migrations/20260801084500_edge_request_account_deletion.sql",
    "utf8"
  );
  const firewallMigration = readFileSync(
    "supabase/migrations/20260801101000_edge_request_account_deletion_firewall.sql",
    "utf8"
  );
  const postDeleteMigration = readFileSync(
    "supabase/migrations/20260802020000_account_deletion_post_delete_security_events.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/request-account-deletion/index.ts", "utf8");
  const shared = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");
  const securityStatic = readFileSync("scripts/security-static.mjs", "utf8");
  const accountDeletionTests = readFileSync("supabase/tests/database/account_deletion.test.sql", "utf8");

  assert.match(migration, /add column if not exists archived_at timestamptz/i);
  assert.match(migration, /restaurant\.archived_at is null/i);
  assert.match(migration, /sole_owned_restaurant_ids/i);
  assert.match(migration, /disabled_membership_ids/i);
  assert.match(migration, /create or replace function public\.service_rollback_failed_account_deletion/i);
  assert.match(
    migration,
    /grant execute on function public\.service_rollback_failed_account_deletion\(uuid\)[\s\S]*to service_role/i
  );
  assert.match(
    migration,
    /revoke all on function public\.service_rollback_failed_account_deletion\(uuid\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(migration, /status in \('requested', 'processing', 'completed', 'cancelled', 'failed'\)/i);
  assert.match(edgeMigration, /private\.service_request_my_account_deletion\(\s*p_actor_user_id uuid/i);
  assert.match(
    edgeMigration,
    /grant execute on function public\.service_request_my_account_deletion[\s\S]*service_role/i
  );
  assert.match(edgeMigration, /revoke all on function public\.request_my_account_deletion/i);
  assert.match(firewallMigration, /'request-account-deletion'/);
  assert.match(firewallMigration, /request-account-deletion',\s*4,\s*300/i);
  assert.match(
    firewallMigration,
    /p_function_name not in \('account-onboarding', 'request-account-deletion'\)/i
  );
  assert.match(postDeleteMigration, /reserved_actor_user_id/);
  assert.match(postDeleteMigration, /deleted_actor_user_id/);
  assert.match(
    postDeleteMigration,
    /p_function_name = 'request-account-deletion'[\s\S]*actor_user_id is null[\s\S]*reserved_actor_user_id/
  );
  assert.match(shared, /UserScopedEdgeFunctionName[\s\S]*request-account-deletion/);
  assert.match(edge, /reserveUserScopedFunctionInvocation/);
  assert.match(edge, /recordUserScopedFunctionSecurityEvent/);
  assert.match(edge, /service_request_my_account_deletion/);
  assert.doesNotMatch(edge, /\.rpc\(\s*["']request_my_account_deletion["']/);
  assert.match(edge, /service_rollback_failed_account_deletion/);
  assert.match(edge, /Restaurant access was restored/i);
  assert.match(edge, /Account deletion request status could not be updated/);
  assert.match(edge, /authUserDeleted/);
  assert.match(
    securityBackend,
    /globalServiceOnlyPublicFunctions[\s\S]*service_rollback_failed_account_deletion/
  );
  assert.match(securityBackend, /reserveUserScopedFunctionInvocation/);
  assert.match(securityStatic, /account deletion must reserve a user-scoped firewall invocation/);
  assert.match(accountDeletionTests, /authenticated clients cannot execute the legacy account deletion request RPC/i);
  assert.match(accountDeletionTests, /service role can execute the account deletion request service RPC/i);
  assert.match(accountDeletionTests, /actors can reserve user-scoped request-account-deletion invocations/i);
  assert.match(accountDeletionTests, /terminal security events finalize after Auth hard-delete/i);
  assert.match(accountDeletionTests, /deleted_actor_user_id/i);
  assert.match(catalog, /Restaurants you solely own are closed/);
  assert.match(settings, /requestAccountDeletion/);
});

test("restaurant data export is owner/admin Edge-routed with secret redaction", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801193000_edge_export_restaurant_data.sql",
    "utf8"
  );
  const edge = readFileSync("supabase/functions/export-restaurant-data/index.ts", "utf8");
  const shared = readFileSync("supabase/functions/_shared/mise.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const domain = readFileSync("services/domain/restaurantDataExport.ts", "utf8");
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(migration, /'export-restaurant-data'/);
  assert.match(
    migration,
    /'export-restaurant-data',\s*4,\s*300,\s*array\['owner',\s*'admin'\]/i
  );
  assert.match(shared, /EdgeFunctionName[\s\S]*export-restaurant-data/);
  assert.match(config, /\[functions\.export-restaurant-data\][\s\S]*verify_jwt\s*=\s*true/i);
  assert.match(edge, /requireAuthenticatedContext/);
  assert.match(edge, /reserveFunctionInvocation/);
  assert.match(edge, /requireRestaurantRole\([\s\S]*\["owner",\s*"admin"\]/);
  assert.match(edge, /recordFunctionAuditLog/);
  assert.match(edge, /recordFunctionSecurityEvent/);
  assert.match(edge, /buildRestaurantDataExport/);
  assert.match(edge, /from\("restaurant_member_invites"\)/);
  assert.match(
    edge,
    /from\("restaurant_member_invites"\)[\s\S]*select\(\s*"id,restaurant_id,email,role,status,created_by,claimed_by,expires_at,created_at,claimed_at,revoked_at"\s*\)/
  );
  assert.doesNotMatch(
    edge.match(/from\("restaurant_member_invites"\)[\s\S]*?\.eq\("restaurant_id"/)?.[0] ?? "",
    /token_hash/
  );
  assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(domain, /token_hash/);
  assert.match(domain, /SECRET_SETTING_KEY_PATTERN/);
  assert.match(domain, /DEFAULT_POS_SALES_EXPORT_DAYS\s*=\s*90/);
  assert.match(repository, /functions\.invoke\("export-restaurant-data"/);
  assert.match(repository, /demo_export_restaurant_data/);
  assert.match(settings, /exportRestaurantData/);
  assert.match(settings, /canExportRestaurantData/);
  assert.match(settings, /Clipboard\.setStringAsync/);
  assert.match(catalog, /settings\.account\.export/);
  assert.match(securityBackend, /export-restaurant-data/);
});
