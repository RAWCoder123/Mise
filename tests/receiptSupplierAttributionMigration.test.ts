import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261110190000_operator_receipt_supplier_attribution.sql",
  "utf8"
);
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");

test("operator receipt supplier migration uses an additive BEFORE INSERT validator", () => {
  assert.match(
    migration,
    /create or replace function private\.validate_operator_receipt_supplier_attribution\(\)/i
  );
  assert.match(migration, /security invoker/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(
    migration,
    /create trigger validate_operator_receipt_supplier_attribution\s+before insert on public\.inventory_events/i
  );
  assert.match(migration, /new\.source <> 'operator_receipt'/);
  assert.match(migration, /from public\.inventory_items item/i);
  assert.match(migration, /item\.supplier_id/i);
  assert.match(
    migration,
    /Ad-hoc receipts require the item''s durable supplier identity\./
  );
  assert.match(
    migration,
    /Receipt supplier identity must match the inventory item supplier\./
  );
  assert.match(migration, /errcode = '22023'/);
});

test("operator receipt supplier migration does not redeclare the inventory RPC or widen grants", () => {
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.doesNotMatch(migration, /record_supplier_delivery/i);
  assert.doesNotMatch(migration, /grant\s+insert[\s\S]*inventory_events[\s\S]*to authenticated/i);
  assert.doesNotMatch(migration, /grant\s+all[\s\S]*inventory_events[\s\S]*to authenticated/i);
  assert.match(
    migration,
    /revoke all on function private\.validate_operator_receipt_supplier_attribution\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
});

test("demo and hosted repositories stamp operator_receipt supplier_id before ledger write", () => {
  assert.match(demoRepository, /applyOperatorReceiptSupplierAttribution/);
  assert.match(hostedRepository, /applyOperatorReceiptSupplierAttribution/);
  assert.match(hostedRepository, /OPERATOR_RECEIPT_SOURCE/);
  assert.match(hostedRepository, /\.select\("supplier_id"\)/);
  assert.match(transport, /durable supplier identity/);
  assert.match(transport, /durable supplier uuid/);
  assert.match(transport, /supplier_mismatch/);
  assert.match(transport, /missing_supplier/);
  assert.match(transport, /invalid_supplier/);
});
