import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createLocalDemoRepository } from "../services/repositories/demoRepository";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("inventory detail wires durable supplier reassignment through miseService", () => {
  const inventoryDetail = source("app/inventory/[id].tsx");
  const inventoryApplication = source("services/application/inventory.ts");
  const restaurantApplication = source("services/application/restaurant.ts");

  assert.match(inventoryDetail, /fetchSuppliers/);
  assert.match(inventoryDetail, /reassignInventoryItemSupplier/);
  assert.match(inventoryDetail, /createSupplier/);
  assert.match(inventoryDetail, /inventory\.detail\.supplier\.title/);
  assert.match(inventoryDetail, /mutationAllowed/);
  assert.match(inventoryDetail, /canManageRestaurantData/);
  assert.match(inventoryDetail, /hubReady\s*\?\s*suppliers\s*:\s*\[\]/);
  assert.match(
    inventoryDetail,
    /await reassignInventoryItemSupplier[\s\S]*activeRestaurantIdRef\.current !== restaurantId/
  );
  assert.match(inventoryDetail, /supplier\.restaurant_id !== restaurantId/);
  assert.match(inventoryApplication, /export async function reassignInventoryItemSupplier/);
  assert.match(restaurantApplication, /export async function fetchSuppliers/);
  assert.match(restaurantApplication, /export async function createSupplier/);
});

test("demo repository reassigns inventory supplier identity and rejects duplicate creates", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const repository = createLocalDemoRepository();
  const restaurant = await repository.resetDemoData(null);
  const suppliers = await repository.fetchSuppliers(restaurant.id);
  assert.ok(suppliers.length >= 2);

  const items = await repository.fetchInventoryItems(restaurant.id);
  const item = items[0]!;
  const current = suppliers.find((supplier) => supplier.id === item.supplier_id);
  assert.ok(current);
  const target = suppliers.find((supplier) => supplier.id !== current.id);
  assert.ok(target);

  const reassigned = await repository.reassignInventoryItemSupplier(
    restaurant.id,
    item.id,
    target.id
  );
  assert.equal(reassigned.supplier_id, target.id);
  assert.equal(reassigned.supplier_name, target.display_name);

  const after = (await repository.fetchInventoryItems(restaurant.id)).find(
    (candidate) => candidate.id === item.id
  );
  assert.ok(after);
  assert.equal(after.supplier_id, target.id);

  const created = await repository.createSupplier(restaurant.id, "Night Owl Produce Co");
  assert.equal(created.restaurant_id, restaurant.id);
  assert.equal(created.display_name, "Night Owl Produce Co");

  await assert.rejects(
    () => repository.createSupplier(restaurant.id, "Night Owl Produce Co"),
    /already exists/i
  );

  const assigned = await repository.reassignInventoryItemSupplier(
    restaurant.id,
    item.id,
    created.id
  );
  assert.equal(assigned.supplier_id, created.id);
  assert.equal(assigned.supplier_name, created.display_name);
});
