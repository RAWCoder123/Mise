import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260903071000_apply_adhoc_receipt_unit_cost.sql",
  "utf8"
);
const inventoryDetail = readFileSync("app/inventory/[id].tsx", "utf8");
const logDelivery = readFileSync("app/more/log-delivery.tsx", "utf8");
const inventoryApplication = readFileSync("services/application/inventory.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const supabaseRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");
const validation = readFileSync("services/miseValidation.ts", "utf8");

test("apply RPC is manager-only, bounded, and authenticated-executable", () => {
  assert.match(migration, /create or replace function public\.apply_adhoc_receipt_unit_cost/i);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/);
  assert.match(migration, /p_unit_cost > 1000000/);
  assert.match(migration, /estimated_unit_cost = proposed_unit_cost/);
  assert.match(migration, /adhoc_receipt_unit_cost_applied/);
  assert.match(migration, /supplier_prices_checked/);
  assert.match(
    migration,
    /grant execute on function public\.apply_adhoc_receipt_unit_cost[\s\S]*to authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.apply_adhoc_receipt_unit_cost[\s\S]*to service_role/i
  );
  assert.doesNotMatch(migration, /grant update on public\.inventory_items/i);
});

test("receipt UI and application wire optional unit cost without inventing prices", () => {
  assert.match(validation, /unitCost\?: unknown/);
  assert.match(validation, /Unit cost is only supported when logging a receipt/);
  assert.match(inventoryApplication, /applyAdhocReceiptUnitCost/);
  assert.match(inventoryApplication, /regenerateOperationalSignals/);
  assert.match(logDelivery, /applyAdhocReceiptUnitCost/);
  assert.match(logDelivery, /logDelivery\.field\.unitCost/);
  assert.match(inventoryDetail, /inventory\.ops\.unitCost/);
  assert.match(inventoryDetail, /applyAdhocReceiptUnitCost/);
  assert.match(demoRepository, /applyAdhocReceiptUnitCost/);
  assert.match(supabaseRepository, /apply_adhoc_receipt_unit_cost/);
});

test("ad-hoc receipt unit-cost copy exists in EN, ES, and zh-Hans catalogs", () => {
  for (const key of [
    "logDelivery.field.unitCost",
    "logDelivery.unitCost.applied",
    "logDelivery.unitCost.applyFailed",
    "logDelivery.error.unitCost",
    "logDelivery.history.unitCost",
    "inventory.ops.unitCost",
    "inventory.ops.unitCostInvalid",
    "inventory.ops.unitCostApplied",
    "inventory.ops.unitCostApplyFailed"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} should appear once per locale`);
  }
});
