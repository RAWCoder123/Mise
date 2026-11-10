import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261110210000_supplier_delivery_receipt_supplier_attribution.sql",
  "utf8"
);
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const domain = readFileSync(
  "services/domain/supplierDeliveryReceiptAttribution.ts",
  "utf8"
);

test("supplier delivery receipt migration uses an additive BEFORE INSERT stamper", () => {
  assert.match(
    migration,
    /create or replace function private\.stamp_supplier_delivery_receipt_supplier_attribution\(\)/i
  );
  assert.match(migration, /security invoker/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(
    migration,
    /create trigger stamp_supplier_delivery_receipt_supplier_attribution\s+before insert on public\.inventory_events/i
  );
  assert.match(migration, /new\.source <> 'supplier_delivery'/);
  assert.match(migration, /from public\.supplier_orders orders/i);
  assert.match(migration, /orders\.supplier_id/i);
  assert.match(migration, /metadata ->> 'supplierOrderId'/);
  assert.match(
    migration,
    /Supplier delivery receipts require the order''s durable supplier identity\./
  );
  assert.match(
    migration,
    /Supplier delivery receipt identity must match the supplier order\./
  );
  assert.match(migration, /errcode = '22023'/);
  assert.match(
    migration,
    /new\.metadata := new\.metadata \|\| pg_catalog\.jsonb_build_object\(\s*'supplier_id', order_supplier_id/i
  );
});

test("supplier delivery receipt migration does not redeclare contested receive RPCs or widen grants", () => {
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_supplier_delivery/i);
  assert.doesNotMatch(migration, /record_supplier_delivery_mise_003b_name_base/i);
  assert.doesNotMatch(migration, /new\.source <> 'operator_receipt'/);
  assert.doesNotMatch(migration, /from public\.inventory_items item/i);
  assert.doesNotMatch(migration, /grant\s+insert[\s\S]*inventory_events[\s\S]*to authenticated/i);
  assert.doesNotMatch(migration, /grant\s+all[\s\S]*inventory_events[\s\S]*to authenticated/i);
  assert.match(
    migration,
    /revoke all on function private\.stamp_supplier_delivery_receipt_supplier_attribution\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
});

test("demo delivery path and domain helper bind order-path supplier attribution", () => {
  assert.match(domain, /applySupplierDeliveryReceiptAttribution/);
  assert.match(domain, /SUPPLIER_DELIVERY_SOURCE/);
  assert.match(domain, /supplier_delivery/);
  assert.match(
    demoRepository,
    /Supplier delivery receipts require the order's durable supplier identity\./
  );
  assert.match(
    demoRepository,
    /supplier_id:\s*order\.supplier_id/
  );
});
