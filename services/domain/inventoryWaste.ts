import type { RestaurantRole } from "../../types/mise";
import type { LocationBalanceInput } from "./inventoryTransfer";

export const INVENTORY_WASTE_NOTE_MAX_CHARACTERS = 240;

/** Staff may record observed spoilage immediately; count/par edits stay manager+. */
export const INVENTORY_WASTE_RECORD_ROLES: readonly RestaurantRole[] = [
  "owner",
  "admin",
  "manager",
  "staff"
];

export function canRecordInventoryWaste(role: RestaurantRole | null | undefined): boolean {
  return Boolean(role && INVENTORY_WASTE_RECORD_ROLES.includes(role));
}

export type PlannedInventoryWaste = {
  quantityBefore: number;
  quantityRemovedRequested: number;
  quantityRemovedApplied: number;
  quantityAfter: number;
  floored: boolean;
  reason: "waste";
  sourceWorkflow: "record_waste";
  metadata: {
    note?: string;
    quantity_removed_requested: number;
    quantity_removed_applied: number;
    floored: boolean;
    storage_location_id?: string;
    storage_location_name?: string;
  };
};

export function planInventoryWaste(input: {
  quantityBefore: number;
  quantityRemoved: number;
  note?: string | null;
  storageLocationId?: string | null;
  storageLocationName?: string | null;
}): PlannedInventoryWaste {
  const quantityBefore = Number(input.quantityBefore);
  const quantityRemovedRequested = Number(input.quantityRemoved);
  if (!Number.isFinite(quantityBefore) || quantityBefore < 0) {
    throw new Error("Inventory on-hand quantity is invalid.");
  }
  if (!Number.isFinite(quantityRemovedRequested) || quantityRemovedRequested <= 0) {
    throw new Error("Waste quantity must be greater than zero.");
  }

  const quantityRemovedApplied = Math.min(quantityRemovedRequested, quantityBefore);
  const quantityAfter = Math.max(0, quantityBefore - quantityRemovedApplied);
  const floored = quantityRemovedRequested > quantityBefore;
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : undefined;
  const storageLocationId =
    typeof input.storageLocationId === "string" && input.storageLocationId.trim()
      ? input.storageLocationId.trim()
      : undefined;
  const storageLocationName =
    typeof input.storageLocationName === "string" && input.storageLocationName.trim()
      ? input.storageLocationName.trim()
      : undefined;

  return {
    quantityBefore,
    quantityRemovedRequested,
    quantityRemovedApplied,
    quantityAfter,
    floored,
    reason: "waste",
    sourceWorkflow: "record_waste",
    metadata: {
      ...(note ? { note } : {}),
      quantity_removed_requested: quantityRemovedRequested,
      quantity_removed_applied: quantityRemovedApplied,
      floored,
      ...(storageLocationId ? { storage_location_id: storageLocationId } : {}),
      ...(storageLocationName ? { storage_location_name: storageLocationName } : {})
    }
  };
}

/**
 * Ensure the chosen station can cover the waste that will actually be applied.
 * Empty balances mean all on-hand is treated as Main.
 */
export function assertWasteStationAvailability(input: {
  onHandQuantity: number;
  quantityRemovedApplied: number;
  storageLocationId: string;
  mainStorageLocationId: string;
  balancesBefore: LocationBalanceInput[];
}): void {
  const onHandQuantity = Number(input.onHandQuantity);
  const quantityRemovedApplied = Number(input.quantityRemovedApplied);
  const storageLocationId = String(input.storageLocationId ?? "").trim();
  const mainStorageLocationId = String(input.mainStorageLocationId ?? "").trim();

  if (!storageLocationId || !mainStorageLocationId) {
    throw new Error("Storage location is required to record waste.");
  }
  if (!Number.isFinite(onHandQuantity) || onHandQuantity < 0) {
    throw new Error("Inventory on-hand quantity is invalid.");
  }
  if (!Number.isFinite(quantityRemovedApplied) || quantityRemovedApplied <= 0) {
    throw new Error("Waste quantity must be greater than zero.");
  }

  const working = new Map<string, number>();
  for (const balance of input.balancesBefore) {
    const locationId = String(balance.storageLocationId ?? "").trim();
    const quantity = Number(balance.quantity);
    if (!locationId || !Number.isFinite(quantity) || quantity < 0) {
      throw new Error("Location balance data is invalid.");
    }
    working.set(locationId, quantity);
  }

  const sourceAvailable =
    working.size === 0
      ? storageLocationId === mainStorageLocationId
        ? onHandQuantity
        : 0
      : (working.get(storageLocationId) ?? 0);

  if (sourceAvailable + 1e-12 < quantityRemovedApplied) {
    throw new Error("Insufficient quantity at the selected storage location.");
  }
}

export type PlannedWasteLocationDeduction = {
  mainStorageLocationId: string;
  storageLocationId: string;
  quantityMovedToMain: number;
  balanceUpdates: Array<{
    storageLocationId: string;
    quantityBefore: number;
    quantityAfter: number;
  }>;
};

/**
 * After on-hand reconcile reduces Main first, restore Main and take the waste
 * from the operator-selected station without changing restaurant on-hand.
 */
export function planWasteLocationDeduction(input: {
  mainStorageLocationId: string;
  storageLocationId: string;
  quantityRemoved: number;
  mainQuantityBefore: number;
  balancesAfterReconcile: LocationBalanceInput[];
}): PlannedWasteLocationDeduction | null {
  const mainStorageLocationId = String(input.mainStorageLocationId ?? "").trim();
  const storageLocationId = String(input.storageLocationId ?? "").trim();
  const quantityRemoved = Number(input.quantityRemoved);
  const mainQuantityBefore = Number(input.mainQuantityBefore);

  if (!mainStorageLocationId || !storageLocationId) {
    throw new Error("Storage location is required for waste station attribution.");
  }
  if (!Number.isFinite(quantityRemoved) || quantityRemoved < 0) {
    throw new Error("Waste quantity must be zero or greater.");
  }
  if (!Number.isFinite(mainQuantityBefore) || mainQuantityBefore < 0) {
    throw new Error("Main storage quantity is invalid.");
  }
  if (quantityRemoved === 0 || storageLocationId === mainStorageLocationId) {
    return null;
  }

  const working = new Map<string, number>();
  for (const balance of input.balancesAfterReconcile) {
    const locationId = String(balance.storageLocationId ?? "").trim();
    const quantity = Number(balance.quantity);
    if (!locationId || !Number.isFinite(quantity) || quantity < 0) {
      throw new Error("Location balance data is invalid.");
    }
    working.set(locationId, quantity);
  }

  const quantityMovedToMain = Math.min(quantityRemoved, mainQuantityBefore);
  if (quantityMovedToMain <= 1e-12) {
    return null;
  }

  const sourceBefore = working.get(storageLocationId) ?? 0;
  if (sourceBefore + 1e-12 < quantityMovedToMain) {
    throw new Error("Insufficient quantity at the selected storage location.");
  }
  const mainBefore = working.get(mainStorageLocationId) ?? 0;
  const sourceAfter = sourceBefore - quantityMovedToMain;
  const mainAfter = mainBefore + quantityMovedToMain;

  return {
    mainStorageLocationId,
    storageLocationId,
    quantityMovedToMain,
    balanceUpdates: [
      {
        storageLocationId: mainStorageLocationId,
        quantityBefore: mainBefore,
        quantityAfter: mainAfter
      },
      {
        storageLocationId,
        quantityBefore: sourceBefore,
        quantityAfter: sourceAfter
      }
    ]
  };
}
