import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

import { getInitialLoginCredentials, canUseDemoMode, readPublicAppConfig } from "../lib/appConfig";
import { DEMO_DATASET } from "../services/demoData";
import {
  canApproveInventoryCount,
  canDeleteRestaurantData,
  canDraftInventoryCount,
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
  assert.equal(canDraftInventoryCount(staff, "restaurant_a"), true);
  assert.equal(canApproveInventoryCount(staff, "restaurant_a"), false);
  assert.equal(canRecordInventoryWaste(staff, "restaurant_a"), true);

  assert.equal(canManageRestaurantData(manager, "restaurant_a"), true);
  assert.equal(canDeleteRestaurantData(manager, "restaurant_a"), false);
  assert.equal(canDraftInventoryCount(manager, "restaurant_a"), true);
  assert.equal(canApproveInventoryCount(manager, "restaurant_a"), true);
  assert.equal(canRecordInventoryWaste(manager, "restaurant_a"), true);

  assert.equal(canUpdateRestaurantProfile(owner, "restaurant_a"), true);
  assert.equal(canUpdateRestaurantProfile(admin, "restaurant_a"), true);
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

  assert.equal(/\busing\s*\(\s*true\s*\)/i.test(combined), false);
  assert.equal(/\bwith\s+check\s*\(\s*true\s*\)/i.test(combined), false);
  assert.match(combined, /create\s+schema\s+if\s+not\s+exists\s+private/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+private\.is_restaurant_member/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+private\.has_restaurant_role/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+private\.create_restaurant_with_owner/i);
  assert.match(combined, /create\s+or\s+replace\s+function\s+public\.create_restaurant_with_owner/i);
  assert.match(combined, /references\s+auth\.users\(id\)/i);
  assert.match(combined, /private\.is_restaurant_member\(restaurant_id\)/i);
  assert.match(combined, /private\.has_restaurant_role\(restaurant_id,\s*array\['owner',\s*'admin',\s*'manager'\]\)/i);
  assert.match(combined, /revoke\s+all\s+on\s+function\s+private\.is_restaurant_member\(uuid\)\s+from\s+public,\s+anon/i);
  assert.match(combined, /grant\s+execute\s+on\s+function\s+public\.create_restaurant_with_owner\(text,\s*text\)\s+to\s+authenticated/i);
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

test("audit client API uses the fixed-semantic setup RPC and does not accept caller-controlled actor_user_id", () => {
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");

  assert.match(repository, /export\s+type\s+AuditLogInput\s*=\s*Pick<AuditLog,\s*"restaurant_id"\s*\|\s*"action"\s*\|\s*"entity_table">/i);
  assert.doesNotMatch(repository, /type\s+AuditLogInput\s*=\s*Omit<AuditLog,[^;]*actor_user_id/i);
  assert.match(repository, /actor_user_id:\s*DEMO_USER_ID/i);
  assert.match(repository, /rpc\("record_setup_completion_audit"/i);
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

  assert.match(setupScreen, /attachments:\s*\[\]/i);
  assert.match(setupScreen, /attachment_count:\s*0/i);
  assert.doesNotMatch(setupScreen, /EXPO_PUBLIC_.*(OPENAI|GMAIL|GOOGLE|OCR|TOKEN|SECRET)/i);
  assert.doesNotMatch(packageJson, /expo-image-picker|expo-document-picker/i);
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
  assert.match(migration, /restaurant_signal_state/i);
  assert.match(migration, /service_mark_operational_signals_pending/i);
  assert.match(migration, /p_complete_setup/i);
  assert.match(migration, /signals_revision[\s\S]*'setup_completed'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.replace_operational_signals[\s\S]*authenticated/i);
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

  assert.match(application, /buildManualPosSalesIngestPayload|assertManualPosSalesIngestReady/);
  assert.match(repository, /action:\s*"ingest_pos_csv"/i);
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
  assert.match(syncPos, /provider_not_enabled/);
  assert.doesNotMatch(syncPos, /service_ingest_manual_pos_sales/);
  assert.doesNotMatch(application, /\.from\("pos_sales"\)\.insert/);
});

test("inventory counts and regenerated guidance commit through one optimistic workflow", () => {
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260714183310_secure_operational_workflows.sql", "utf8");
  const updateWorkflow = inventoryWorkflow.match(/export\s+async\s+function\s+updateInventoryItem[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(updateWorkflow, /fetchPlanningData[\s\S]*fetchPurchaseRecommendations/i);
  assert.match(updateWorkflow, /buildRecommendationInserts[\s\S]*buildInsightsFromData/i);
  assert.match(updateWorkflow, /updateInventoryItemAndSignals\([\s\S]*existing\.last_updated/i);
  assert.doesNotMatch(updateWorkflow, /repository\.updateInventoryItem\(/i);
  assert.match(repository, /action:\s*"update_inventory"/i);
  assert.match(repository, /functions\.invoke\("operational-workflows"/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_update_inventory_and_signals/i);
  assert.match(migration, /planning_revision[\s\S]*p_expected_revision/i);
  assert.match(migration, /update\s+public\.inventory_items[\s\S]*commit_operational_signals/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.update_inventory_item_and_signals[\s\S]*authenticated/i);
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
  assert.match(repository, /confirm_supplier_order_placed/);
  assert.match(repository, /Direct POS sale inserts are disabled/);
  assert.match(repository, /Direct supplier draft writes are disabled/);
  assert.match(edge, /"receive_supplier_order"/);
  assert.match(edge, /service_receive_supplier_order_and_signals/);
  assert.match(edge, /supplier_order_received/);
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.confirm_supplier_order_placed/i);
  assert.match(migration, /placement_channel',\s*'manual_external'/i);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_receive_supplier_order_and_signals/i);
  assert.match(migration, /reason,\s*[\s\S]*'receiving'/i);
  assert.match(migration, /source_workflow,\s*[\s\S]*'receive_supplier_order'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.service_receive_supplier_order_and_signals[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.service_receive_supplier_order_and_signals[\s\S]*service_role/i);
  assert.match(detail, /confirmSupplierOrderPlaced/);
  assert.match(detail, /receiveSupplierOrder/);
});

test("inventory waste writes are service-owned, ledgered, and separate from count saves", () => {
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260731012000_record_inventory_waste.sql", "utf8");
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const wasteWorkflow = inventoryWorkflow.match(/export\s+async\s+function\s+recordInventoryWaste[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(wasteWorkflow, /requireInventoryWasteQuantity/);
  assert.match(wasteWorkflow, /planInventoryWaste/);
  assert.match(wasteWorkflow, /recordInventoryWasteAndSignals\([\s\S]*existing\.last_updated/i);
  assert.doesNotMatch(wasteWorkflow, /updateInventoryItemAndSignals/);
  assert.match(repository, /action:\s*"record_waste"/i);
  assert.match(edge, /"record_waste"/);
  assert.match(edge, /service_record_inventory_waste_and_signals/);
  assert.match(edge, /inventory_waste_recorded/);
  assert.match(migration, /create\s+or\s+replace\s+function\s+private\.service_record_inventory_waste_and_signals/i);
  assert.match(migration, /reason,\s*[\s\S]*'waste'/i);
  assert.match(migration, /source_workflow,\s*[\s\S]*'record_waste'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.service_record_inventory_waste_and_signals[\s\S]*authenticated/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.service_record_inventory_waste_and_signals[\s\S]*service_role/i);
  assert.match(detail, /recordInventoryWaste/);
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
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const tenantAccess = readFileSync("services/tenantAccess.ts", "utf8");
  const domain = readFileSync("services/domain/inventoryWaste.ts", "utf8");

  assert.match(domain, /INVENTORY_WASTE_RECORD_ROLES/);
  assert.match(domain, /canRecordInventoryWaste/);
  assert.match(tenantAccess, /export function canRecordInventoryWaste/);
  assert.match(edge, /staffOperationalActions/);
  assert.match(edge, /"record_waste"/);
  assert.match(
    migration,
    /service_record_inventory_waste_and_signals[\s\S]*array\['owner', 'admin', 'manager', 'staff'\]/i
  );
  assert.match(detail, /canRecordWaste/);
  assert.match(detail, /inventory\.detail\.limitedAccess/);
  assert.match(detail, /\{canRecordWaste \? \(/);
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
  assert.match(migration, /create table if not exists public\.inventory_count_sessions/i);
  assert.match(migration, /create table if not exists public\.inventory_count_lines/i);
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
  assert.match(screen, /canDraftInventoryCount/);
  assert.match(screen, /canApproveInventoryCount/);
  assert.match(screen, /beginInventoryCountSession/);
  assert.match(screen, /approveInventoryCountSession/);
  assert.match(screen, /staffAwaitingApproval/);
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

  assert.match(repository, /rpc\("create_pending_purchase_recommendation"/i);
  assert.doesNotMatch(repository, /rpc\("replace_pending_purchase_recommendations"/i);
  assert.doesNotMatch(repository, /rpc\("replace_operational_insights"/i);
  assert.match(repository, /functions\.invoke\("operational-workflows"/i);
  assert.match(operationalMigration, /generation_source[\s\S]*mise_rules/i);
  assert.match(operationalMigration, /revoke\s+all[\s\S]*replace_pending_purchase_recommendations[\s\S]*authenticated/i);
  assert.doesNotMatch(repository, /from\("purchase_recommendations"\)\.insert\(inserts\)/i);
  assert.match(shared, /SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(shared, /p_reservation_id:\s*reservationId/i);
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
    "approve_purchase_recommendation"
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
  assert.match(edge, /request_my_account_deletion/);
  assert.match(edge, /auth\.admin\.deleteUser/);
  assert.match(settings, /requestAccountDeletion/);
  assert.match(settings, /EXPO_PUBLIC_PRIVACY_POLICY_URL|privacyPolicyUrl/);
});
