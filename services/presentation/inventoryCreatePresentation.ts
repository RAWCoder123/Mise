export type InventoryCreateAccessState = "loading" | "missing" | "readonly" | "ready";

export type InventoryCreateFailureReason =
  | "validation"
  | "duplicate"
  | "capacity"
  | "itemName"
  | "category"
  | "unit"
  | "supplier"
  | "quantity"
  | "unknown";

export function resolveInventoryCreateAccessState(input: {
  sessionReady: boolean;
  restaurantId: string | null | undefined;
  canManage: boolean;
}): InventoryCreateAccessState {
  if (!input.sessionReady) return "loading";
  if (!input.restaurantId) return "missing";
  if (!input.canManage) return "readonly";
  return "ready";
}

export function presentInventoryCreateFormEditable(
  state: InventoryCreateAccessState,
  saving: boolean
): boolean {
  return state === "ready" && !saving;
}

export function resolveInventoryCreateFailureReason(error: unknown): InventoryCreateFailureReason {
  const message = error instanceof Error ? error.message : "";
  if (!message.trim()) return "unknown";
  if (/already exists/i.test(message)) return "duplicate";
  if (/maximum of \d+ inventory items/i.test(message)) return "capacity";
  if (/Item name/i.test(message)) return "itemName";
  if (/Category/i.test(message)) return "category";
  if (/^Unit\b|Unit must/i.test(message)) return "unit";
  if (/Supplier name/i.test(message)) return "supplier";
  if (
    /Current quantity|Par level|Reorder threshold|Estimated unit cost|must be between 0 and|must be zero or greater/i.test(
      message
    )
  ) {
    return "quantity";
  }
  if (/Inventory item details are required|is required/i.test(message)) return "validation";
  return "unknown";
}

export function presentInventoryCreateFailureCopy(
  reason: InventoryCreateFailureReason,
  copy: Record<InventoryCreateFailureReason, { title: string; message: string }>
): { tone: "danger"; title: string; message: string } {
  const selected = copy[reason] ?? copy.unknown;
  return {
    tone: "danger",
    title: selected.title,
    message: selected.message
  };
}
