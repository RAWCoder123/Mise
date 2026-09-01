import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("settings suppliers loads read-only catalog pack labels, preferred flags, and SKUs", () => {
  const screen = readFileSync("app/settings/suppliers.tsx", "utf8");
  const application = readFileSync("services/application/restaurant.ts", "utf8");
  const domain = readFileSync("services/domain/supplierCatalog.ts", "utf8");
  const demo = readFileSync("services/demo/replaceableDemoData.ts", "utf8");

  assert.match(screen, /fetchSupplierCatalog/);
  assert.match(screen, /filterSupplierCatalogGroups/);
  assert.match(screen, /copy\.catalogTitle/);
  assert.match(screen, /copy\.preferred/);
  assert.match(screen, /catalogSkuLabel/);
  assert.match(screen, /catalogPackLabel/);
  assert.doesNotMatch(screen, /saveSupplierItem|createSupplierItem|updateSupplierItem|pack_quantity/);
  assert.doesNotMatch(screen, /capture_inventory_item_supplier_sku/);

  assert.match(application, /export async function fetchSupplierCatalog/);
  assert.match(application, /buildSupplierCatalogBrowse/);
  assert.match(application, /fetchRestaurantOpsProfile/);
  assert.match(domain, /Never invents pack labels, SKUs/);

  assert.match(demo, /demoSupplierSku/);
  assert.match(demo, /demoSupplierPackSize/);
  assert.match(demo, /demoSupplierPreferred/);
  assert.doesNotMatch(demo, /supplier_sku:\s*null/);
});

test("more hub advertises supplier catalog evidence on the suppliers row", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  assert.match(catalog, /"more\.row\.suppliers\.subtitle": "Recipients, pack labels, preferred items, and SKUs"/);
  assert.match(catalog, /"more\.row\.suppliers\.subtitle": "Destinatarios, empaques, preferidos y SKU"/);
  assert.match(catalog, /"more\.row\.suppliers\.subtitle": "收件人、包装标签、首选品和 SKU"/);
});
