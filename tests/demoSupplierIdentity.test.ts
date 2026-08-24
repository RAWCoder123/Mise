import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialDemoState,
  repairDemoState,
  type StoredDemoState
} from "../services/demo/replaceableDemoData";
import {
  reassignInventorySupplierInDemoState,
  renameSupplierInDemoState
} from "../services/demo/demoWorkflows";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("v11 demo repair creates deterministic restaurant-scoped supplier UUIDs", () => {
  const raw = clone(createInitialDemoState("Square")) as unknown as StoredDemoState & {
    suppliers?: unknown;
  };
  raw.schema_version = 11;
  delete raw.suppliers;
  for (const rows of [
    raw.inventoryItems ?? [],
    raw.purchaseRecommendations ?? [],
    raw.supplierOrders ?? [],
    raw.supplierRecipients ?? [],
    raw.supplierItems ?? []
  ]) {
    for (const row of rows) delete (row as { supplier_id?: string }).supplier_id;
  }

  const secondRestaurantId = "10000000-0000-4000-8000-000000000001";
  raw.restaurants = [
    ...(raw.restaurants ?? []),
    { ...raw.restaurants![0]!, id: secondRestaurantId, name: "Second restaurant" }
  ];
  raw.inventoryItems = [
    ...(raw.inventoryItems ?? []),
    {
      ...raw.inventoryItems![0]!,
      id: "10000000-0000-4000-8000-000000000002",
      restaurant_id: secondRestaurantId
    }
  ];

  const first = repairDemoState(raw).state;
  const second = repairDemoState(raw).state;
  const firstTenantSupplier = first.suppliers.find(
    (supplier) =>
      supplier.restaurant_id === first.currentRestaurantId &&
      supplier.normalized_name === "fresh poultry supply"
  );
  const secondTenantSupplier = first.suppliers.find(
    (supplier) =>
      supplier.restaurant_id === secondRestaurantId &&
      supplier.normalized_name === "fresh poultry supply"
  );

  assert.match(firstTenantSupplier?.id ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(secondTenantSupplier?.id ?? "", /^[0-9a-f-]{36}$/);
  assert.notEqual(firstTenantSupplier?.id, secondTenantSupplier?.id);
  assert.deepEqual(
    first.suppliers.map((supplier) => supplier.id),
    second.suppliers.map((supplier) => supplier.id)
  );
  assert.equal(first.schema_version, 12);
});

test("v12 demo repair never replaces a cross-tenant supplier ID from matching display text", () => {
  const raw = clone(createInitialDemoState("Square"));
  const item = raw.inventoryItems[0]!;
  const originalSupplier = raw.suppliers.find(
    (supplier) => supplier.id === item.supplier_id
  )!;
  const secondRestaurantId = "10000000-0000-4000-8000-000000000020";
  const foreignSupplierId = "10000000-0000-4000-8000-000000000021";
  raw.restaurants.push({
    ...raw.restaurants[0]!,
    id: secondRestaurantId,
    name: "Second restaurant"
  });
  raw.suppliers.push({
    ...originalSupplier,
    id: foreignSupplierId,
    restaurant_id: secondRestaurantId
  });
  item.supplier_id = foreignSupplierId;

  const repaired = repairDemoState(raw).state;
  const repairedItem = repaired.inventoryItems.find((candidate) => candidate.id === item.id)!;

  assert.equal(repairedItem.supplier_name, originalSupplier.display_name);
  assert.equal(repairedItem.supplier_id, "");
});

test("demo rename preserves identity and recipient while retaining sent display snapshots", () => {
  const state = createInitialDemoState("Square", { preset: "default" });
  const draft = state.supplierOrders.find((order) => order.status === "draft")!;
  const historical = state.supplierOrders.find(
    (order) => order.supplier_id === draft.supplier_id && order.status === "completed"
  )!;
  const recipient = state.supplierRecipients.find(
    (entry) => entry.supplier_id === draft.supplier_id
  )!;
  const recipientId = recipient.id;
  const recipientEmail = recipient.email;
  const historicalName = historical.supplier_name;
  const revisionBefore = state.supplierSendContentRevisions[draft.id] ?? 1;

  const renamed = renameSupplierInDemoState(
    state,
    draft.restaurant_id,
    draft.supplier_id,
    "Metro Produce & Foods"
  );

  assert.equal(renamed.id, draft.supplier_id);
  assert.equal(recipient.id, recipientId);
  assert.equal(recipient.email, recipientEmail);
  assert.equal(recipient.supplier_id, renamed.id);
  assert.equal(recipient.supplier_name, "Metro Produce & Foods");
  assert.equal(draft.supplier_name, "Metro Produce & Foods");
  assert.match(draft.order_message, /Metro Produce & Foods/);
  assert.equal(state.supplierSendContentRevisions[draft.id], revisionBefore + 1);
  assert.equal(historical.supplier_name, historicalName);
  assert.doesNotMatch(historical.order_message, /Metro Produce & Foods/);
  const otherSupplier = state.suppliers.find((supplier) => supplier.id !== renamed.id)!;
  assert.throws(
    () =>
      renameSupplierInDemoState(
        state,
        draft.restaurant_id,
        renamed.id,
        `  ${otherSupplier.display_name.toLocaleUpperCase("en-US")}  `
      ),
    /already exists/
  );
  assert.equal(renamed.display_name, "Metro Produce & Foods");
  assert.throws(
    () =>
      renameSupplierInDemoState(
        state,
        draft.restaurant_id,
        renamed.id,
        "Metro\nProduce"
      ),
    /valid supplier name/
  );
});

test("demo reassignment invalidates pending authority and blocks approved draft lines", () => {
  const state = createInitialDemoState("Square");
  const item = state.inventoryItems[0]!;
  const originalSupplierId = item.supplier_id;
  const target = state.suppliers.find((supplier) => supplier.id !== originalSupplierId)!;
  state.purchaseRecommendations.push({
    id: "10000000-0000-4000-8000-000000000010",
    restaurant_id: item.restaurant_id,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: originalSupplierId,
    supplier_name: item.supplier_name,
    recommended_quantity: 5,
    unit: item.unit,
    reason: "Test pending authority.",
    urgency: "medium",
    status: "pending",
    supplier_order_id: null,
    created_at: new Date().toISOString()
  });

  const reassigned = reassignInventorySupplierInDemoState(
    state,
    item.restaurant_id,
    item.id,
    target.id
  );
  assert.equal(reassigned.item.supplier_id, target.id);
  assert.equal(reassigned.item.supplier_name, target.display_name);
  assert.deepEqual(reassigned.invalidatedRecommendationIds, [
    "10000000-0000-4000-8000-000000000010"
  ]);
  assert.equal(
    state.purchaseRecommendations.some(
      (recommendation) => recommendation.id === "10000000-0000-4000-8000-000000000010"
    ),
    false
  );

  state.purchaseRecommendations.push({
    id: "10000000-0000-4000-8000-000000000011",
    restaurant_id: item.restaurant_id,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: target.id,
    supplier_name: target.display_name,
    recommended_quantity: 5,
    unit: item.unit,
    reason: "Approved line cannot be silently reparented.",
    urgency: "medium",
    status: "approved",
    supplier_order_id: "10000000-0000-4000-8000-000000000012",
    created_at: new Date().toISOString()
  });
  assert.throws(
    () =>
      reassignInventorySupplierInDemoState(
        state,
        item.restaurant_id,
        item.id,
        originalSupplierId
      ),
    /Undo the approved supplier draft line/
  );
  assert.equal(item.supplier_id, target.id);
});

test("demo setup name discovery stops at completion and exact stale replay is a no-op", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
      clear: () => { values.clear(); },
      key: (index) => [...values.keys()][index] ?? null,
      get length() { return values.size; }
    }
  };
  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  const restaurant = await repository.resetDemoData(null);
  const setupInput = (supplierName: string) => ({
    inventoryItems: [{
      restaurant_id: restaurant.id,
      item_name: "Correction Setup Tomatoes",
      category: "Setup baseline",
      unit: "case",
      current_quantity: 4,
      par_level: 12,
      reorder_threshold: 4,
      estimated_unit_cost: 20,
      supplier_client_reference_id: "correction-supplier-local"
    }],
    suppliers: [{
      restaurant_id: restaurant.id,
      client_reference_id: "correction-supplier-local",
      display_name: supplierName,
      email: "orders@correction-setup.test"
    }],
    recipeMappings: [],
    posSales: [],
    attachments: [],
    skippedRecipeIngredients: 0
  });

  await repository.saveRestaurantSetupSnapshot(
    restaurant.id,
    setupInput("Correction Setup Supplier")
  );
  const initialSupplier = (await repository.fetchSuppliers(restaurant.id)).find(
    (supplier) => supplier.normalized_name === "correction setup supplier"
  );
  assert.ok(initialSupplier);

  await repository.renameSupplier(
    restaurant.id,
    initialSupplier.id,
    "Correction Setup Supplier & Foods"
  );
  await repository.saveRestaurantSetupSnapshot(
    restaurant.id,
    setupInput("Correction Setup Supplier")
  );

  const afterReplay = await repository.fetchSuppliers(restaurant.id);
  assert.equal(
    afterReplay.some((supplier) => supplier.normalized_name === "correction setup supplier"),
    false
  );
  assert.equal(
    afterReplay.find((supplier) => supplier.id === initialSupplier.id)?.display_name,
    "Correction Setup Supplier & Foods"
  );
  await assert.rejects(
    repository.saveRestaurantSetupSnapshot(
      restaurant.id,
      setupInput("Unknown Post Setup Supplier")
    ),
    /Initial setup is already complete/
  );
  assert.equal(
    (await repository.fetchSuppliers(restaurant.id)).some(
      (supplier) => supplier.normalized_name === "unknown post setup supplier"
    ),
    false
  );
});
