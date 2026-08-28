import { createId } from "../domain/miseDomain";
import {
  MAIN_STORAGE_LOCATION_NAME,
  planInventoryTransfer,
  planLocationBalanceReconcile,
  planReceiveLocationPutaway,
  planStorageLocationCreate
} from "../domain/inventoryTransfer";
import {
  assertWasteStationAvailability,
  planWasteLocationDeduction
} from "../domain/inventoryWaste";
import type { DemoState } from "./replaceableDemoData";
import type { InventoryItem, InventoryLocationBalance, StorageLocation } from "../../types/mise";
import type { InventoryEvent } from "../domain/inventoryLedger";

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

/** Align location balances with restaurant on-hand after create/count/waste/receive. */
export function reconcileDemoLocationBalancesToOnHand(
  state: DemoState,
  restaurantId: string,
  item: InventoryItem,
  now = new Date().toISOString()
): void {
  const main = ensureDemoMainStorageLocation(state, restaurantId, now);
  const balances = listDemoInventoryLocationBalances(state, restaurantId, item.id);
  const planned = planLocationBalanceReconcile({
    onHandQuantity: item.current_quantity,
    balances: balances.map((balance) => ({
      storageLocationId: balance.storage_location_id,
      quantity: balance.quantity
    })),
    mainStorageLocationId: main.id
  });
  if (!planned.changed) return;
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
}

/**
 * After on-hand increases from a receive, land the increase on Main then move
 * it onto the chosen put-away station. Empty balances stay lazy unless a
 * non-Main station is chosen.
 */
export function applyDemoReceiveLocationPutaway(
  state: DemoState,
  restaurantId: string,
  item: InventoryItem,
  storageLocationId: string | null | undefined,
  quantityReceived: number,
  now = new Date().toISOString()
): void {
  if (!(quantityReceived > 0)) return;
  const main = ensureDemoMainStorageLocation(state, restaurantId, now);
  const targetId = typeof storageLocationId === "string" ? storageLocationId.trim() : "";
  const locations = listDemoStorageLocations(state, restaurantId);
  const target =
    (targetId ? locations.find((location) => location.id === targetId) : null) ?? main;
  if (!target) {
    throw new Error("Storage location not found.");
  }

  const balances = listDemoInventoryLocationBalances(state, restaurantId, item.id);
  if (balances.length === 0) {
    if (target.id === main.id) {
      return;
    }
    const priorOnHand = Math.max(0, item.current_quantity - quantityReceived);
    upsertDemoBalance(state, restaurantId, item.id, main.id, priorOnHand, now);
    upsertDemoBalance(state, restaurantId, item.id, target.id, quantityReceived, now);
    return;
  }

  reconcileDemoLocationBalancesToOnHand(state, restaurantId, item, now);
  if (target.id === main.id) return;

  const afterReconcile = listDemoInventoryLocationBalances(state, restaurantId, item.id);
  const planned = planReceiveLocationPutaway({
    mainStorageLocationId: main.id,
    storageLocationId: target.id,
    quantityReceived,
    balances: afterReconcile.map((balance) => ({
      storageLocationId: balance.storage_location_id,
      quantity: balance.quantity
    }))
  });
  if (!planned) return;
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
}

/**
 * Attribute waste to a station after on-hand was reduced.
 * Caller must pass balances/on-hand captured before the quantity write.
 */
export function applyDemoWasteLocationDeduction(
  state: DemoState,
  restaurantId: string,
  item: InventoryItem,
  storageLocationId: string | null | undefined,
  quantityRemovedApplied: number,
  onHandQuantityBefore: number,
  balancesBefore: InventoryLocationBalance[],
  now = new Date().toISOString()
): StorageLocation {
  const main = ensureDemoMainStorageLocation(state, restaurantId, now);
  const locations = listDemoStorageLocations(state, restaurantId);
  const requestedId = typeof storageLocationId === "string" ? storageLocationId.trim() : "";
  const target =
    (requestedId ? locations.find((location) => location.id === requestedId) : null) ?? main;
  if (!target) {
    throw new Error("Storage location not found.");
  }

  const mainQuantityBefore =
    balancesBefore.find((balance) => balance.storage_location_id === main.id)?.quantity ??
    (balancesBefore.length === 0 ? onHandQuantityBefore : 0);

  assertWasteStationAvailability({
    onHandQuantity: onHandQuantityBefore,
    quantityRemovedApplied,
    storageLocationId: target.id,
    mainStorageLocationId: main.id,
    balancesBefore: balancesBefore.map((balance) => ({
      storageLocationId: balance.storage_location_id,
      quantity: balance.quantity
    }))
  });

  if (balancesBefore.length === 0) {
    if (target.id === main.id) return target;
    throw new Error("Insufficient quantity at the selected storage location.");
  }

  reconcileDemoLocationBalancesToOnHand(state, restaurantId, item, now);

  const balancesAfter = listDemoInventoryLocationBalances(state, restaurantId, item.id);
  const planned = planWasteLocationDeduction({
    mainStorageLocationId: main.id,
    storageLocationId: target.id,
    quantityRemoved: quantityRemovedApplied,
    mainQuantityBefore,
    balancesAfterReconcile: balancesAfter.map((balance) => ({
      storageLocationId: balance.storage_location_id,
      quantity: balance.quantity
    }))
  });
  if (!planned) return target;

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
  return target;
}

export function transferDemoInventory(input: {
  state: DemoState;
  restaurantId: string;
  item: InventoryItem;
  fromStorageLocationId: string;
  toStorageLocationId: string;
  quantity: number;
  note: string | null;
  actorUserId: string | null;
}): { item: InventoryItem; event: InventoryEvent } {
  const { state, restaurantId, item } = input;
  const now = new Date().toISOString();
  const main = ensureDemoMainStorageLocation(state, restaurantId, now);
  const locations = listDemoStorageLocations(state, restaurantId);
  const fromLocation = locations.find((location) => location.id === input.fromStorageLocationId);
  const toLocation = locations.find((location) => location.id === input.toStorageLocationId);
  if (!fromLocation || !toLocation) {
    throw new Error("Storage location not found.");
  }
  if (
    item.canonical_unit_verification_status !== "verified" ||
    !item.canonical_unit ||
    item.canonical_quantity_per_unit == null ||
    item.canonical_quantity_per_unit <= 0
  ) {
    throw new Error("Inventory item canonical conversion is not verified");
  }

  let balances = listDemoInventoryLocationBalances(state, restaurantId, item.id);
  if (balances.length === 0) {
    upsertDemoBalance(state, restaurantId, item.id, main.id, item.current_quantity, now);
    balances = listDemoInventoryLocationBalances(state, restaurantId, item.id);
  } else {
    const sum = balances.reduce((total, row) => total + row.quantity, 0);
    if (Math.abs(sum - item.current_quantity) > 1e-9) {
      const mainBalance = balances.find((row) => row.storage_location_id === main.id);
      const nextMainQuantity = Math.max(
        0,
        (mainBalance?.quantity ?? 0) + (item.current_quantity - sum)
      );
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
  const maximumSequence = (state.inventoryEvents ?? []).reduce(
    (maximum, event) => Math.max(maximum, event.sequence),
    0
  );
  const clientEventId = `transfer:${createId("transfer")}`;
  const event: InventoryEvent = {
    id: createId("inventory_event"),
    sequence: maximumSequence + 1,
    restaurantId,
    inventoryItemId: item.id,
    eventType: "transfer",
    quantity: 0,
    canonicalUnit: item.canonical_unit,
    effectiveAt: now,
    recordedAt: now,
    actorUserId: input.actorUserId,
    source: "transfer_inventory",
    sourceReference: null,
    reasonCode: "station_transfer",
    clientEventId,
    idempotencyKey: `transfer_inventory:${clientEventId}`,
    supersedesEventId: null,
    metadata: {
      ...planned.metadata,
      from_storage_location_name: fromLocation.name,
      to_storage_location_name: toLocation.name,
      source_workflow: "transfer_inventory"
    },
    projectionApplied: true
  };
  state.inventoryEvents = [...(state.inventoryEvents ?? []), event];
  return { item, event };
}
