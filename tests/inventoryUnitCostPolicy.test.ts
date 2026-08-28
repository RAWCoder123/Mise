import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260828140000_inventory_policy_estimated_unit_cost.sql",
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

test("inventory policy tip allows estimated_unit_cost without on-hand writes", () => {
  assert.match(
    migration,
    /safe_patch\s*-\s*array\['par_level',\s*'reorder_threshold',\s*'estimated_unit_cost'\]/i
  );
  assert.match(
    migration,
    /estimated_unit_cost\s*=\s*item_row\.estimated_unit_cost/i
  );
  assert.doesNotMatch(migration, /set\s+current_quantity\s*=/i);
  assert.doesNotMatch(migration, /supplier_name/i);
  assert.match(
    edgeWorkflow,
    /new Set\(\["par_level", "reorder_threshold", "estimated_unit_cost"\]\)/i
  );
});

test("inventory detail saves estimated unit cost with par settings", () => {
  assert.match(types, /estimated_unit_cost/);
  assert.match(
    types,
    /Pick<InventoryItem,\s*"current_quantity"\s*\|\s*"par_level"\s*\|\s*"reorder_threshold"\s*\|\s*"estimated_unit_cost">/
  );
  assert.match(validation, /\["estimated_unit_cost",\s*"Estimated unit cost"\]/);
  assert.match(detailScreen, /estimated_unit_cost:\s*parseNumber\(estimatedUnitCost\)/);
  assert.match(detailScreen, /inventory\.detail\.estimatedUnitCost/);
  assert.match(catalog, /"inventory\.detail\.estimatedUnitCost":\s*"Estimated unit cost/);
  assert.match(catalog, /"inventory\.detail\.estimatedUnitCost":\s*"Costo unitario estimado/);
  assert.match(catalog, /"inventory\.detail\.estimatedUnitCost":\s*"预估单位成本/);
});

test("tenant isolation pins estimated unit cost policy updates", () => {
  assert.match(
    tenantIsolation,
    /trusted workflow updates estimated unit cost without rewriting on-hand quantity/i
  );
  assert.match(tenantIsolation, /\{"estimated_unit_cost":3\.75\}/);
  assert.match(
    tenantIsolation,
    /service inventory workflow rejects unsupported cost-adjacent patch fields/i
  );
});
