import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { requireInventoryItemPatch } from "../services/miseValidation";

const migration = readFileSync(
  "supabase/migrations/20260828190000_inventory_policy_category_rename.sql",
  "utf8"
);
const edgeWorkflow = readFileSync(
  "supabase/functions/operational-workflows/index.ts",
  "utf8"
);
const detailScreen = readFileSync("app/inventory/[id].tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");
const types = readFileSync("types/mise.ts", "utf8");
const validation = readFileSync("services/miseValidation.ts", "utf8");
const tenantIsolation = readFileSync(
  "supabase/tests/database/tenant_isolation.test.sql",
  "utf8"
);

test("inventory policy tip allows item_name and category without on-hand writes", () => {
  assert.match(
    migration,
    /safe_patch\s*-\s*array\['par_level',\s*'reorder_threshold',\s*'item_name',\s*'category'\]/i
  );
  assert.match(migration, /item_name\s*=\s*item_row\.item_name/i);
  assert.match(migration, /category\s*=\s*item_row\.category/i);
  assert.match(migration, /An inventory item with this name already exists/i);
  assert.doesNotMatch(migration, /set\s+current_quantity\s*=/i);
  assert.doesNotMatch(migration, /supplier_name/i);
  assert.match(
    edgeWorkflow,
    /new Set\(\["par_level", "reorder_threshold", "item_name", "category"\]\)/i
  );
});

test("inventory detail saves item name and category with policy settings", () => {
  assert.match(
    types,
    /Pick<InventoryItem,\s*"current_quantity"\s*\|\s*"par_level"\s*\|\s*"reorder_threshold"\s*\|\s*"item_name"\s*\|\s*"category">/
  );
  assert.match(validation, /requireInventoryPolicyText\(validated\.item_name,\s*"Item name",\s*160\)/);
  assert.match(validation, /requireInventoryPolicyText\(validated\.category,\s*"Category",\s*120\)/);
  assert.match(detailScreen, /item_name:\s*itemName\.trim\(\)/);
  assert.match(detailScreen, /category:\s*category\.trim\(\)/);
  assert.match(detailScreen, /inventory\.detail\.itemName/);
  assert.match(detailScreen, /inventory\.detail\.category/);
  assert.match(catalog, /"inventory\.detail\.itemName":\s*"Item name"/);
  assert.match(catalog, /"inventory\.detail\.itemName":\s*"Nombre del artículo"/);
  assert.match(catalog, /"inventory\.detail\.itemName":\s*"条目名称"/);
  assert.match(catalog, /"inventory\.detail\.category":\s*"Category"/);
  assert.match(catalog, /"inventory\.detail\.category":\s*"Categoría"/);
  assert.match(catalog, /"inventory\.detail\.category":\s*"分类"/);
});

test("requireInventoryItemPatch normalizes and rejects invalid name or category", () => {
  assert.deepEqual(requireInventoryItemPatch({ item_name: "  Chicken   Breast  " }), {
    item_name: "Chicken Breast"
  });
  assert.deepEqual(requireInventoryItemPatch({ category: " Produce " }), {
    category: "Produce"
  });
  assert.deepEqual(requireInventoryItemPatch({ item_name: "Bad\nName" }), {
    item_name: "Bad Name"
  });
  assert.throws(() => requireInventoryItemPatch({ item_name: "" }), /Item name must be between/);
  assert.throws(() => requireInventoryItemPatch({ category: "a".repeat(121) }), /Category must be between/);
  assert.throws(
    () => requireInventoryItemPatch({ item_name: `Bad${String.fromCharCode(1)}Name` }),
    /Item name must be between/
  );
});

test("tenant isolation pins inventory name and category policy updates", () => {
  assert.match(
    tenantIsolation,
    /trusted workflow updates inventory item name and category without rewriting on-hand quantity/i
  );
  assert.match(tenantIsolation, /\{"item_name":"Airline Chicken","category":"Proteins"\}/);
  assert.match(
    tenantIsolation,
    /service inventory workflow rejects unsupported identity-adjacent patch fields/i
  );
});
