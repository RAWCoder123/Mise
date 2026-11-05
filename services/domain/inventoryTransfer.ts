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

export type PlannedLocationBalanceReconcile = {
  onHandQuantity: number;
  allocatedBefore: number;
  delta: number;
  changed: boolean;
  seededMain: boolean;
  balanceUpdates: Array<{
    storageLocationId: string;
    quantityBefore: number;
    quantityAfter: number;
  }>;
};

/**
 * Keep per-location balances mathematically aligned with restaurant on-hand.
 * Increases land on Main; decreases reduce Main first, then other stations by id.
 */
export function planLocationBalanceReconcile(input: {
  onHandQuantity: number;
  balances: LocationBalanceInput[];
  mainStorageLocationId: string;
}): PlannedLocationBalanceReconcile {
  const onHandQuantity = Number(input.onHandQuantity);
  const mainStorageLocationId = String(input.mainStorageLocationId ?? "").trim();

  if (!Number.isFinite(onHandQuantity) || onHandQuantity < 0) {
    throw new Error("Inventory on-hand quantity is invalid.");
  }
  if (!mainStorageLocationId) {
    throw new Error("Main storage location is required to reconcile balances.");
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

  if (working.size === 0) {
    return {
      onHandQuantity,
      allocatedBefore: 0,
      delta: onHandQuantity,
      changed: true,
      seededMain: true,
      balanceUpdates: [
        {
          storageLocationId: mainStorageLocationId,
          quantityBefore: 0,
          quantityAfter: onHandQuantity
        }
      ]
    };
  }

  const allocatedBefore = [...working.values()].reduce((sum, quantity) => sum + quantity, 0);
  const delta = onHandQuantity - allocatedBefore;
  if (Math.abs(delta) < 1e-9) {
    return {
      onHandQuantity,
      allocatedBefore,
      delta: 0,
      changed: false,
      seededMain: false,
      balanceUpdates: []
    };
  }

  const beforeSnapshot = new Map(working);
  if (!working.has(mainStorageLocationId)) {
    working.set(mainStorageLocationId, 0);
    beforeSnapshot.set(mainStorageLocationId, 0);
  }

  if (delta > 0) {
    working.set(mainStorageLocationId, (working.get(mainStorageLocationId) ?? 0) + delta);
  } else {
    let remaining = -delta;
    const reductionOrder = [
      mainStorageLocationId,
      ...[...working.keys()]
        .filter((locationId) => locationId !== mainStorageLocationId)
        .sort((a, b) => a.localeCompare(b))
    ];
    for (const locationId of reductionOrder) {
      if (remaining <= 1e-12) break;
      const current = working.get(locationId) ?? 0;
      const remove = Math.min(current, remaining);
      working.set(locationId, current - remove);
      remaining -= remove;
    }
  }

  const balanceUpdates = [...working.entries()]
    .map(([storageLocationId, quantityAfter]) => ({
      storageLocationId,
      quantityBefore: beforeSnapshot.get(storageLocationId) ?? 0,
      quantityAfter
    }))
    .filter((row) => Math.abs(row.quantityAfter - row.quantityBefore) >= 1e-9)
    .sort((a, b) => {
      if (a.storageLocationId === mainStorageLocationId) return -1;
      if (b.storageLocationId === mainStorageLocationId) return 1;
      return a.storageLocationId.localeCompare(b.storageLocationId);
    });

  return {
    onHandQuantity,
    allocatedBefore,
    delta,
    changed: balanceUpdates.length > 0,
    seededMain: false,
    balanceUpdates
  };
}

export type PlannedReceiveLocationPutaway = {
  mainStorageLocationId: string;
  storageLocationId: string;
  quantityReceived: number;
  balanceUpdates: Array<{
    storageLocationId: string;
    quantityBefore: number;
    quantityAfter: number;
  }>;
};

/**
 * After on-hand reconcile lands receive increases on Main, move the received
 * quantity onto the chosen put-away station without changing restaurant on-hand.
 */
export function planReceiveLocationPutaway(input: {
  mainStorageLocationId: string;
  storageLocationId: string;
  quantityReceived: number;
  balances: LocationBalanceInput[];
}): PlannedReceiveLocationPutaway | null {
  const mainStorageLocationId = String(input.mainStorageLocationId ?? "").trim();
  const storageLocationId = String(input.storageLocationId ?? "").trim();
  const quantityReceived = Number(input.quantityReceived);

  if (!mainStorageLocationId || !storageLocationId) {
    throw new Error("Storage location is required for receive put-away.");
  }
  if (!Number.isFinite(quantityReceived) || quantityReceived < 0) {
    throw new Error("Received quantity must be zero or greater.");
  }
  if (quantityReceived === 0 || storageLocationId === mainStorageLocationId) {
    return null;
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

  const mainBefore = working.get(mainStorageLocationId) ?? 0;
  if (mainBefore + 1e-12 < quantityReceived) {
    throw new Error("Insufficient Main quantity available for receive put-away.");
  }
  const targetBefore = working.get(storageLocationId) ?? 0;
  const mainAfter = mainBefore - quantityReceived;
  const targetAfter = targetBefore + quantityReceived;

  return {
    mainStorageLocationId,
    storageLocationId,
    quantityReceived,
    balanceUpdates: [
      {
        storageLocationId: mainStorageLocationId,
        quantityBefore: mainBefore,
        quantityAfter: mainAfter
      },
      {
        storageLocationId,
        quantityBefore: targetBefore,
        quantityAfter: targetAfter
      }
    ]
  };
}
