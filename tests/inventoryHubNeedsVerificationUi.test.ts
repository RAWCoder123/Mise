import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inventoryHub = readFileSync("app/(tabs)/inventory.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("Inventory hub wires Needs verification filter and preview group", () => {
  assert.match(inventoryHub, /from "\.\.\/\.\.\/services\/presentation\/inventoryHubPresentation"/);
  assert.match(inventoryHub, /matchesInventoryHubFilter/);
  assert.match(inventoryHub, /listNeedsVerificationOutlooks/);
  assert.match(inventoryHub, /isInventoryCanonicalUnitReady/);
  assert.match(inventoryHub, /value: "Needs verification"/);
  assert.match(inventoryHub, /t\("inventory\.filter\.needsVerification"\)/);
  assert.match(inventoryHub, /t\("inventory\.group\.needsVerification"/);
  assert.match(inventoryHub, /setFilter\("Needs verification"\)/);
  assert.doesNotMatch(inventoryHub, /function matchesInventoryFilter\(/);
  assert.doesNotMatch(inventoryHub, /function isCanonicalUnitReady\(/);
});

test("Needs verification copy exists in EN, ES, and zh-Hans catalogs", () => {
  for (const key of ["inventory.filter.needsVerification", "inventory.group.needsVerification"]) {
    assert.equal((catalog.match(new RegExp(`"${key}":`, "g")) ?? []).length, 3, key);
  }
  assert.match(catalog, /Filter inventory by stock status or verification/);
  assert.match(catalog, /Filtrar inventario por estado de stock o verificación/);
  assert.match(catalog, /按库存状态或验证情况筛选库存/);
});
