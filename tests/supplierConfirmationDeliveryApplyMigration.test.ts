import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260902142000_apply_supplier_confirmation_delivery_date.sql",
  "utf8"
);
const orderDetail = readFileSync("app/orders/[id].tsx", "utf8");
const ordersApplication = readFileSync("services/application/orders.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const supabaseRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");

test("apply RPC is manager-only, sent-order scoped, and authenticated-executable", () => {
  assert.match(migration, /create or replace function public\.apply_supplier_confirmation_delivery_date/i);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/);
  assert.match(migration, /order_row\.status <> 'sent'/);
  assert.match(migration, /confirmation_status not in \('acknowledged', 'changed'\)/);
  assert.match(migration, /expected_delivery_at is null/);
  assert.match(migration, /at time zone restaurant_timezone/);
  assert.match(migration, /delivery_date = proposed_delivery_date/);
  assert.match(migration, /supplier_confirmation_delivery_applied/);
  assert.match(migration, /grant execute on function public\.apply_supplier_confirmation_delivery_date[\s\S]*to authenticated/i);
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.apply_supplier_confirmation_delivery_date[\s\S]*to service_role/i
  );
  assert.doesNotMatch(migration, /grant insert on public\.supplier_orders/i);
});

test("order detail surfaces apply CTA and uses operational detail confirmation candidate", () => {
  assert.match(ordersApplication, /selectConfirmationDeliveryApplyCandidate/);
  assert.match(ordersApplication, /applySupplierConfirmationDeliveryDate/);
  assert.match(orderDetail, /confirmationDeliveryApply/);
  assert.match(orderDetail, /orders\.detail\.confirmationApply\.action/);
  assert.match(orderDetail, /applySupplierConfirmationDeliveryDate/);
  assert.match(demoRepository, /applySupplierConfirmationDeliveryDate/);
  assert.match(supabaseRepository, /apply_supplier_confirmation_delivery_date/);
});
