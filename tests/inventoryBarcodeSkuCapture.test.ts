import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260828010000_capture_inventory_item_supplier_sku.sql",
  "utf8"
);
const hostedRepository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const scanScreen = readFileSync("app/more/scan-item.tsx", "utf8");
const application = readFileSync("services/application/inventory.ts", "utf8");

test("capture_inventory_item_supplier_sku is manager-gated SECURITY DEFINER with empty search_path", () => {
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+public\.capture_inventory_item_supplier_sku\s*\(\s*p_restaurant_id\s+uuid,\s*p_inventory_item_id\s+uuid,\s*p_supplier_sku\s+text\s*\)/i
  );
  assert.match(migration, /security\s+definer/i);
  assert.match(migration, /set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    /private\.has_restaurant_role\(\s*p_restaurant_id,\s*array\['owner',\s*'admin',\s*'manager'\]/i
  );
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.capture_inventory_item_supplier_sku[^;]+to\s+authenticated/i);
  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+public\.capture_inventory_item_supplier_sku[^;]+from\s+public,\s*anon,\s*authenticated,\s*service_role/i
  );
  assert.match(migration, /inventory_barcode_sku_captured/);
  assert.doesNotMatch(migration, /grant\s+execute[\s\S]*service_role/i);
});

test("hosted and demo repositories expose barcode SKU capture without client DML", () => {
  assert.match(hostedRepository, /client\.rpc\(\s*"capture_inventory_item_supplier_sku"/);
  assert.match(demoRepository, /async\s+captureInventoryItemSupplierSku\(/);
  assert.match(application, /repository\.captureInventoryItemSupplierSku\(/);
  assert.doesNotMatch(hostedRepository, /\.from\(\s*"supplier_items"\s*\)[\s\S]{0,120}\.(insert|update|upsert)\(/);
});

test("scan item screen matches supplier SKU and gates capture to managers", () => {
  assert.match(scanScreen, /fetchInventoryBarcodeCatalog/);
  assert.match(scanScreen, /matchInventoryBarcode\([\s\S]*supplierItems/);
  assert.match(scanScreen, /canManageRestaurantData\(memberships,\s*restaurant\?\.id\)/);
  assert.match(scanScreen, /captureInventoryItemSupplierSku/);
  assert.match(scanScreen, /scanItem\.barcode\.noneBodyCapture/);
});
