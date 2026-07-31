export const INVENTORY_WASTE_NOTE_MAX_CHARACTERS = 240;

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
  };
};

export function planInventoryWaste(input: {
  quantityBefore: number;
  quantityRemoved: number;
  note?: string | null;
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
      floored
    }
  };
}
