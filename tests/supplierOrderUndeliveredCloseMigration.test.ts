import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260902180000_complete_supplier_order_undelivered.sql",
  "utf8"
);
const orderDetail = readFileSync("app/orders/[id].tsx", "utf8");
const deliveriesApplication = readFileSync("services/application/deliveries.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const supabaseRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("undelivered-close RPC is manager-only, zero-delivery gated, and authenticated-executable", () => {
  assert.match(migration, /create or replace function public\.complete_supplier_order_undelivered/i);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/);
  assert.match(migration, /order_row\.status <> 'sent'/);
  assert.match(migration, /prior_delivery_count > 0/);
  assert.match(migration, /supplier_cancelled.*never_arrived.*ordered_in_error/s);
  assert.match(migration, /supplier_order_undelivered_closed/);
  assert.match(migration, /No inventory receipt was posted/);
  assert.match(
    migration,
    /grant execute on function public\.complete_supplier_order_undelivered[\s\S]*to authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.complete_supplier_order_undelivered[\s\S]*to service_role/i
  );
  assert.doesNotMatch(migration, /insert into public\.supplier_deliveries/i);
  assert.doesNotMatch(migration, /record_inventory_event/i);
});

test("order detail surfaces undelivered-close CTA and application wiring", () => {
  assert.match(deliveriesApplication, /closeSupplierOrderUndelivered/);
  assert.match(deliveriesApplication, /canCloseSupplierOrderUndelivered/);
  assert.match(orderDetail, /closeSupplierOrderUndelivered/);
  assert.match(orderDetail, /orders\.detail\.closeUndelivered\.action/);
  assert.match(orderDetail, /visibleDeliveryEvidence\.length === 0/);
  assert.match(demoRepository, /closeSupplierOrderUndelivered/);
  assert.match(supabaseRepository, /complete_supplier_order_undelivered/);
});

test("undelivered-close copy exists in EN, ES, and zh-Hans catalogs", () => {
  for (const key of [
    "orders.detail.closeUndelivered.action",
    "orders.detail.closeUndelivered.title",
    "orders.detail.closeUndelivered.body",
    "orders.detail.closeUndelivered.reason.neverArrived",
    "orders.detail.closeUndelivered.reason.supplierCancelled",
    "orders.detail.closeUndelivered.reason.orderedInError",
    "orders.detail.closeUndelivered.successBody",
    "orders.detail.closeUndelivered.failedBody"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} should appear once per locale`);
  }
});
