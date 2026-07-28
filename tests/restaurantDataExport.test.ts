import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const edge = readFileSync("supabase/functions/export-restaurant-data/index.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260727231500_restaurant_data_export_firewall.sql",
  "utf8"
);
const privacyPolicy = readFileSync("docs/store/privacy-policy.md", "utf8");

test("restaurant export is owner/admin only and passes the standard firewall lifecycle", () => {
  assert.match(edge, /requireAuthenticatedContext\(req\)/);
  assert.match(edge, /reserveFunctionInvocation\([\s\S]*"export-restaurant-data"/);
  assert.match(edge, /requireRestaurantRole\([\s\S]*\["owner", "admin"\]/);
  assert.match(edge, /recordFunctionAuditLog\(/);
  assert.match(edge, /recordFunctionSecurityEvent\(/);
  assert.match(edge, /recordFunctionTerminalError\(terminalContext\)/);
  assert.match(migration, /'export-restaurant-data', 4, 300, array\['owner', 'admin'\]/);
});

test("restaurant export covers operational truth and excludes backend-only schemas", () => {
  for (const dataset of [
    "pos_sales",
    "inventory_items",
    "inventory_events",
    "purchase_recommendations",
    "supplier_orders",
    "restaurant_operational_controls",
    "pos_locations",
    "pos_catalog_item_mappings",
    "menu_items",
    "recipe_versions",
    "recipe_ingredients",
    "modifier_recipe_adjustments",
    "ingredient_substitutions",
    "operational_finding_decisions",
    "audit_logs"
  ]) {
    assert.match(edge, new RegExp(`name: "${dataset}"`));
  }
  assert.doesNotMatch(edge, /\.schema\(["']private["']\)/);
  assert.doesNotMatch(edge, /\.schema\(["']vault["']\)/);
  assert.doesNotMatch(edge, /gmail_credentials|edge_function_security_events|vault\.secrets/);
});

test("restaurant export fails closed on truncation, excessive size, and protected keys", () => {
  assert.match(edge, /MAX_ROWS_PER_DATASET = 5_000/);
  assert.match(edge, /MAX_TOTAL_ROWS = 25_000/);
  assert.match(edge, /MAX_EXPORT_BYTES = 6 \* 1024 \* 1024/);
  assert.match(edge, /returned an incomplete/);
  assert.match(edge, /sensitiveKeyPattern/);
  assert.match(edge, /assertSecretFree\(payload\)/);
  assert.doesNotMatch(edge, /partial:\s*true/);
});

test("every exported dataset is explicitly scoped to the requested restaurant", () => {
  assert.match(
    edge,
    /\.from\(table\)[\s\S]*?\.eq\("restaurant_id", restaurantId\)[\s\S]*?\.range\(/g
  );
  assert.match(edge, /\.from\("restaurants"\)[\s\S]*?\.eq\("id", restaurantId\)/);
  assert.match(edge, /p_restaurant_id: restaurantId/);
  assert.match(edge, /restaurantId,\s*restaurant: restaurantResult\.data/);
});

test("privacy copy matches export scope and deletion retention behavior", () => {
  assert.match(privacyPolicy, /owners and administrators may request a machine-readable export/i);
  assert.match(privacyPolicy, /Provider credentials, encrypted secrets, and private security logs are never included/i);
  assert.match(privacyPolicy, /Oversized exports are delivered through Mise support rather than returned partially/i);
  assert.match(privacyPolicy, /durable, access-restricted deletion audit may remain/i);
});
