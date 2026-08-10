import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260810130000_service_inventory_policy_only_patches.sql",
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
    /safe_patch\s*-\s*array\['par_level',\s*'reorder_threshold',\s*'supplier_name'\]/i
  );
  assert.match(
    migration,
    /set\s+par_level\s*=\s*item_row\.par_level[\s\S]*reorder_threshold\s*=\s*item_row\.reorder_threshold[\s\S]*supplier_name\s*=\s*item_row\.supplier_name/i
  );
  assert.doesNotMatch(migration, /set\s+current_quantity\s*=\s*item_row\.current_quantity/i);
  assert.match(migration, /On-hand quantity changes must use record_inventory_event/i);
  assert.match(
    edgeWorkflow,
    /new Set\(\["par_level", "reorder_threshold", "supplier_name"\]\)/i
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
