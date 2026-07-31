import { createId } from "../domain/miseDomain";
import {
  MAIN_STORAGE_LOCATION_NAME,
  planInventoryTransfer,
  planStorageLocationCreate
} from "../domain/inventoryTransfer";
import type { DemoState } from "./replaceableDemoData";
import type { InventoryItem, InventoryLocationBalance, StorageLocation } from "../../types/mise";

function ensureDemoStorageLocations(state: DemoState) {
  if (!Array.isArray(state.storageLocations)) state.storageLocations = [];
}

function ensureDemoLocationBalances(state: DemoState) {
  if (!Array.isArray(state.inventoryLocationBalances)) state.inventoryLocationBalances = [];
}

export function ensureDemoMainStorageLocation(
  state: DemoState,
  restaurantId: string,
  now = new Date().toISOString()
): StorageLocation {
  ensureDemoStorageLocations(state);
  const existing = state.storageLocations.find(
    (location) =>
      location.restaurant_id === restaurantId &&
      location.name.toLowerCase() === MAIN_STORAGE_LOCATION_NAME.toLowerCase()
  );
  if (existing) {
    if (!existing.is_active) {
      existing.is_active = true;
      existing.updated_at = now;
    }
    return existing;
  }
  const created: StorageLocation = {
    id: createId("storage_location"),
    restaurant_id: restaurantId,
    name: MAIN_STORAGE_LOCATION_NAME,
    sort_order: 0,
    is_active: true,
    created_at: now,
    updated_at: now
  };
  state.storageLocations.push(created);
  return created;
}

export function listDemoStorageLocations(state: DemoState, restaurantId: string): StorageLocation[] {
  ensureDemoMainStorageLocation(state, restaurantId);
  return state.storageLocations
    .filter((location) => location.restaurant_id === restaurantId && location.is_active)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export function createDemoStorageLocation(
  state: DemoState,
  restaurantId: string,
  name: string
): StorageLocation {
  const planned = planStorageLocationCreate({ name });
  ensureDemoMainStorageLocation(state, restaurantId);
  const duplicate = state.storageLocations.find(
    (location) =>
      location.restaurant_id === restaurantId &&
      location.name.toLowerCase() === planned.name.toLowerCase()
  );
  if (duplicate) {
    throw new Error("A storage location with that name already exists.");
  }
  const now = new Date().toISOString();
  const created: StorageLocation = {
    id: createId("storage_location"),
    restaurant_id: restaurantId,
    name: planned.name,
    sort_order: 100,
    is_active: true,
    created_at: now,
    updated_at: now
  };
  state.storageLocations.push(created);
  return created;
}

export function listDemoInventoryLocationBalances(
  state: DemoState,
  restaurantId: string,
  itemId: string
): InventoryLocationBalance[] {
  ensureDemoLocationBalances(state);
  return state.inventoryLocationBalances
    .filter(
      (balance) => balance.restaurant_id === restaurantId && balance.inventory_item_id === itemId
    )
    .slice()
    .sort((a, b) => a.storage_location_id.localeCompare(b.storage_location_id));
}

function upsertDemoBalance(
  state: DemoState,
  restaurantId: string,
  itemId: string,
  storageLocationId: string,
  quantity: number,
  now: string
): InventoryLocationBalance {
  ensureDemoLocationBalances(state);
  const existing = state.inventoryLocationBalances.find(
    (balance) =>
      balance.restaurant_id === restaurantId &&
      balance.inventory_item_id === itemId &&
      balance.storage_location_id === storageLocationId
  );
  if (existing) {
    existing.quantity = quantity;
    existing.updated_at = now;
    return existing;
  }
  const created: InventoryLocationBalance = {
    id: createId("inventory_location_balance"),
    restaurant_id: restaurantId,
    inventory_item_id: itemId,
    storage_location_id: storageLocationId,
    quantity,
    created_at: now,
    updated_at: now
  };
  state.inventoryLocationBalances.push(created);
  return created;
}

export function transferDemoInventory(input: {
  state: DemoState;
  restaurantId: string;
  item: InventoryItem;
  fromStorageLocationId: string;
  toStorageLocationId: string;
  quantity: number;
  note: string | null;
  appendMovement: (input: {
    restaurantId: string;
    itemId: string;
    quantityBefore: number;
    quantityAfter: number;
    reason: "transfer";
    sourceWorkflow: "transfer_inventory";
    metadata: Record<string, unknown>;
  }) => void;
}): InventoryItem {
  const { state, restaurantId, item } = input;
  const now = new Date().toISOString();
  const main = ensureDemoMainStorageLocation(state, restaurantId, now);
  const locations = listDemoStorageLocations(state, restaurantId);
  const fromLocation = locations.find((location) => location.id === input.fromStorageLocationId);
  const toLocation = locations.find((location) => location.id === input.toStorageLocationId);
  if (!fromLocation || !toLocation) {
    throw new Error("Storage location not found.");
  }

  let balances = listDemoInventoryLocationBalances(state, restaurantId, item.id);
  if (balances.length === 0) {
    upsertDemoBalance(state, restaurantId, item.id, main.id, item.current_quantity, now);
    balances = listDemoInventoryLocationBalances(state, restaurantId, item.id);
  } else {
    const sum = balances.reduce((total, row) => total + row.quantity, 0);
    if (Math.abs(sum - item.current_quantity) > 1e-9) {
      const mainBalance = balances.find((row) => row.storage_location_id === main.id);
      const nextMainQuantity = Math.max(0, (mainBalance?.quantity ?? 0) + (item.current_quantity - sum));
      upsertDemoBalance(state, restaurantId, item.id, main.id, nextMainQuantity, now);
      balances = listDemoInventoryLocationBalances(state, restaurantId, item.id);
    }
  }

  const planned = planInventoryTransfer({
    onHandQuantity: item.current_quantity,
    balances: balances.map((balance) => ({
      storageLocationId: balance.storage_location_id,
      quantity: balance.quantity
    })),
    fromStorageLocationId: input.fromStorageLocationId,
    toStorageLocationId: input.toStorageLocationId,
    quantity: input.quantity,
    note: input.note,
    mainStorageLocationId: main.id
  });

  for (const update of planned.balanceUpdates) {
    upsertDemoBalance(
      state,
      restaurantId,
      item.id,
      update.storageLocationId,
      update.quantityAfter,
      now
    );
  }

  item.last_updated = now;
  input.appendMovement({
    restaurantId,
    itemId: item.id,
    quantityBefore: item.current_quantity,
    quantityAfter: item.current_quantity,
    reason: "transfer",
    sourceWorkflow: "transfer_inventory",
    metadata: {
      ...planned.metadata,
      from_storage_location_name: fromLocation.name,
      to_storage_location_name: toLocation.name
    }
  });
  return item;
}
