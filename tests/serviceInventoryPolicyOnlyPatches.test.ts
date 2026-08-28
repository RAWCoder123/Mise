import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
  "utf8"
);
const tenantIsolation = readFileSync(
  "supabase/tests/database/tenant_isolation.test.sql",
  "utf8"
);
const edgeWorkflow = readFileSync(
  "supabase/functions/operational-workflows/index.ts",
  "utf8"
);
const demoRepository = readFileSync(
  "services/repositories/demoRepository.ts",
  "utf8"
);

test("service inventory update rejects current_quantity and only writes policy fields", () => {
  assert.match(
    migration,
    /create or replace function private\.service_update_inventory_and_signals/i
  );
  assert.match(
    migration,
    /safe_patch\s*-\s*array\['par_level',\s*'reorder_threshold'\]/i
  );
  assert.match(
    migration,
    /set\s+par_level\s*=\s*item_row\.par_level[\s\S]*reorder_threshold\s*=\s*item_row\.reorder_threshold/i
  );
  assert.doesNotMatch(migration, /set\s+current_quantity\s*=\s*item_row\.current_quantity/i);
  assert.doesNotMatch(migration, /safe_patch\s*-\s*array\[[^\]]*'supplier_name'/i);
  const categoryRenameMigration = readFileSync(
    "supabase/migrations/20260828190000_inventory_policy_category_rename.sql",
    "utf8"
  );
  assert.match(
    categoryRenameMigration,
    /safe_patch\s*-\s*array\['par_level',\s*'reorder_threshold',\s*'item_name',\s*'category'\]/i
  );
  assert.match(
    edgeWorkflow,
    /new Set\(\["par_level", "reorder_threshold", "item_name", "category"\]\)/i
  );
});

test("tenant isolation pins unaudited quantity rejection and policy-only atomic updates", () => {
  assert.match(
    tenantIsolation,
    /service inventory workflow rejects unaudited current_quantity patches/i
  );
  assert.match(
    tenantIsolation,
    /trusted workflow updates manager inventory policy and both operational signal sets atomically/i
  );
  assert.match(
    tenantIsolation,
    /policy patch does not rewrite on-hand quantity/i
  );
  assert.match(tenantIsolation, /\{"par_level":42\}/);
});

test("demo inventory signal updates reject current_quantity patches", () => {
  const method =
    demoRepository.match(
      /async\s+updateInventoryItemAndSignals\([\s\S]*?\n\s{4}\},/
    )?.[0] ?? "";
  assert.match(
    method,
    /hasOwnProperty\.call\(patch,\s*"current_quantity"\)/i
  );
  assert.match(method, /remain auditable/i);
});
