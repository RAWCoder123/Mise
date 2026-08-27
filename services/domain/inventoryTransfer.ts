import type { RestaurantRole } from "../../types/mise";

export const MAIN_STORAGE_LOCATION_NAME = "Main";
export const STORAGE_LOCATION_NAME_MAX_CHARACTERS = 80;
export const INVENTORY_TRANSFER_NOTE_MAX_CHARACTERS = 240;

/** Staff may move observed stock between stations; location create stays manager+. */
export const INVENTORY_TRANSFER_ROLES: readonly RestaurantRole[] = [
  "owner",
  "admin",
  "manager",
  "staff"
];

export const STORAGE_LOCATION_MANAGE_ROLES: readonly RestaurantRole[] = [
  "owner",
  "admin",
  "manager"
];

export function canTransferInventory(role: RestaurantRole | null | undefined): boolean {
  return Boolean(role && INVENTORY_TRANSFER_ROLES.includes(role));
}

export function canManageStorageLocations(role: RestaurantRole | null | undefined): boolean {
  return Boolean(role && STORAGE_LOCATION_MANAGE_ROLES.includes(role));
}

export type LocationBalanceInput = {
  storageLocationId: string;
  quantity: number;
};

export type PlannedInventoryTransfer = {
  onHandQuantity: number;
  quantityMoved: number;
  seededMainQuantity: number | null;
  reason: "transfer";
  sourceWorkflow: "transfer_inventory";
  balanceUpdates: Array<{
    storageLocationId: string;
    quantityBefore: number;
    quantityAfter: number;
  }>;
  metadata: {
    from_storage_location_id: string;
    to_storage_location_id: string;
    quantity_moved: number;
    note?: string;
    seeded_main?: boolean;
  };
};

export function planStorageLocationCreate(input: { name: string }) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw new Error("Storage location name is required.");
  }
  if (name.length > STORAGE_LOCATION_NAME_MAX_CHARACTERS) {
    throw new Error(
      `Storage location name is limited to ${STORAGE_LOCATION_NAME_MAX_CHARACTERS} characters.`
    );
  }
  if (name.toLowerCase() === MAIN_STORAGE_LOCATION_NAME.toLowerCase()) {
    throw new Error(`"${MAIN_STORAGE_LOCATION_NAME}" is reserved and created automatically.`);
  }
  return { name };
}

/**
 * Plans a station-to-station move. Restaurant on-hand stays unchanged; only
 * per-location balances move. Empty balances seed onto Main before the move.
 */
export function planInventoryTransfer(input: {
  onHandQuantity: number;
  balances: LocationBalanceInput[];
  fromStorageLocationId: string;
  toStorageLocationId: string;
  quantity: number;
  note?: string | null;
  mainStorageLocationId?: string | null;
}): PlannedInventoryTransfer {
  const onHandQuantity = Number(input.onHandQuantity);
  const quantityMoved = Number(input.quantity);
  const fromStorageLocationId = String(input.fromStorageLocationId ?? "").trim();
  const toStorageLocationId = String(input.toStorageLocationId ?? "").trim();

  if (!Number.isFinite(onHandQuantity) || onHandQuantity < 0) {
    throw new Error("Inventory on-hand quantity is invalid.");
  }
  if (!fromStorageLocationId || !toStorageLocationId) {
    throw new Error("Choose both a source and destination storage location.");
  }
  if (fromStorageLocationId === toStorageLocationId) {
    throw new Error("Choose different storage locations for a transfer.");
  }
  if (!Number.isFinite(quantityMoved) || quantityMoved <= 0) {
    throw new Error("Transfer quantity must be greater than zero.");
  }

  const working = new Map<string, number>();
  for (const balance of input.balances) {
    const locationId = String(balance.storageLocationId ?? "").trim();
    const quantity = Number(balance.quantity);
    if (!locationId || !Number.isFinite(quantity) || quantity < 0) {
      throw new Error("Location balance data is invalid.");
    }
    working.set(locationId, quantity);
  }

  let seededMainQuantity: number | null = null;
  if (working.size === 0) {
    const mainId = String(input.mainStorageLocationId ?? fromStorageLocationId).trim();
    if (!mainId) {
      throw new Error("Main storage location is required to seed balances.");
    }
    working.set(mainId, onHandQuantity);
    seededMainQuantity = onHandQuantity;
  }

  const fromBefore = working.get(fromStorageLocationId) ?? 0;
  const toBefore = working.get(toStorageLocationId) ?? 0;
  if (fromBefore < quantityMoved) {
    throw new Error("Insufficient quantity at the source storage location.");
  }

  const fromAfter = fromBefore - quantityMoved;
  const toAfter = toBefore + quantityMoved;
  working.set(fromStorageLocationId, fromAfter);
  working.set(toStorageLocationId, toAfter);

  const note =
    typeof input.note === "string" && input.note.trim() ? input.note.trim() : undefined;

  return {
    onHandQuantity,
    quantityMoved,
    seededMainQuantity,
    reason: "transfer",
    sourceWorkflow: "transfer_inventory",
    balanceUpdates: [
      {
        storageLocationId: fromStorageLocationId,
        quantityBefore: fromBefore,
        quantityAfter: fromAfter
      },
      {
        storageLocationId: toStorageLocationId,
        quantityBefore: toBefore,
        quantityAfter: toAfter
      }
    ],
    metadata: {
      from_storage_location_id: fromStorageLocationId,
      to_storage_location_id: toStorageLocationId,
      quantity_moved: quantityMoved,
      ...(note ? { note } : {}),
      ...(seededMainQuantity != null ? { seeded_main: true } : {})
    }
  };
}

export function reconcileLocationBalancesForDisplay(input: {
  onHandQuantity: number;
  balances: Array<{ storageLocationId: string; name: string; quantity: number }>;
}) {
  const onHandQuantity = Number(input.onHandQuantity);
  const allocatedQuantity = input.balances.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const unallocatedQuantity = Math.max(0, onHandQuantity - allocatedQuantity);
  return {
    onHandQuantity,
    allocatedQuantity,
    unallocatedQuantity,
    matchesOnHand: Math.abs(onHandQuantity - allocatedQuantity) < 1e-9,
    balances: input.balances
  };
}
