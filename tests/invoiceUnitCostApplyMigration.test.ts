import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260902153000_apply_invoice_unit_cost_from_delivery.sql",
  "utf8"
);
const inventoryDetail = readFileSync("app/inventory/[id].tsx", "utf8");
const inventoryApplication = readFileSync("services/application/inventory.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const supabaseRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("apply RPC is manager-only, evidence-scoped, and authenticated-executable", () => {
  assert.match(migration, /create or replace function public\.apply_invoice_unit_cost_from_delivery/i);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/);
  assert.match(migration, /delivery_item_row\.inventory_item_id <> p_inventory_item_id/);
  assert.match(migration, /unit_price is null/);
  assert.match(migration, /received_quantity <= 0/);
  assert.match(migration, /estimated_unit_cost = proposed_unit_cost/);
  assert.match(migration, /invoice_unit_cost_applied/);
  assert.match(migration, /supplier_prices_checked/);
  assert.match(
    migration,
    /grant execute on function public\.apply_invoice_unit_cost_from_delivery[\s\S]*to authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.apply_invoice_unit_cost_from_delivery[\s\S]*to service_role/i
  );
  assert.doesNotMatch(migration, /grant update on public\.inventory_items/i);
});

test("inventory detail surfaces invoice cost CTA and application wiring", () => {
  assert.match(inventoryApplication, /selectInvoiceUnitCostApplyCandidate/);
  assert.match(inventoryApplication, /applyInvoiceUnitCostFromDelivery/);
  assert.match(inventoryApplication, /regenerateOperationalSignals/);
  assert.match(inventoryDetail, /invoiceUnitCostApply/);
  assert.match(inventoryDetail, /inventory\.detail\.invoiceCost\.action/);
  assert.match(inventoryDetail, /applyInvoiceUnitCostFromDelivery/);
  assert.match(demoRepository, /applyInvoiceUnitCostFromDelivery/);
  assert.match(supabaseRepository, /apply_invoice_unit_cost_from_delivery/);
  assert.match(supabaseRepository, /unit_price/);
});

test("invoice cost copy exists in EN, ES, and zh-Hans catalogs", () => {
  for (const key of [
    "inventory.detail.invoiceCost.title",
    "inventory.detail.invoiceCost.body",
    "inventory.detail.invoiceCost.action",
    "inventory.detail.invoiceCost.successBody",
    "inventory.detail.invoiceCost.failedBody"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} should appear once per locale`);
  }
});
