export type InventoryDetailLoadState = "loading" | "ready" | "error";

export type InventoryDetailMutationNoticeReason =
  | "noWorkspace"
  | "viewOnlyInventory"
  | "viewOnlyOrdering"
  | "reviewFields"
  | "updated"
  | "saveFailed"
  | "added"
  | "addFailed"
  | "reviewWaste"
  | "wasteRecorded"
  | "wasteNothingOnHand"
  | "wasteLocationMissing"
  | "wasteLocationInsufficient"
  | "wasteFailed"
  | "reviewTransfer"
  | "transferRecorded"
  | "transferInsufficient"
  | "transferSameLocation"
  | "transferLocationMissing"
  | "transferFailed"
  | "locationAdded"
  | "locationFailed"
  | "locationsUnavailable"
  | "loadFailed";

export type InventoryDetailSecondaryLoadState = "ready" | "unavailable" | "empty";

export function resolveInventoryDetailSecondaryLoadState(input: {
  loadError: boolean;
  count: number;
}): InventoryDetailSecondaryLoadState {
  if (input.loadError) return "unavailable";
  if (input.count <= 0) return "empty";
  return "ready";
}

export function isInventoryDetailStationActionBlocked(
  state: InventoryDetailSecondaryLoadState
): boolean {
  return state === "unavailable";
}

export function presentInventoryDetailSecondaryLoadCopy(
  state: InventoryDetailSecondaryLoadState,
  copy: {
    unavailableTitle: string;
    unavailableBody: string;
  }
): { title: string; message: string } | null {
  if (state !== "unavailable") return null;
  return {
    title: copy.unavailableTitle,
    message: copy.unavailableBody
  };
}

export function resolveInventoryDetailLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): InventoryDetailLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentInventoryDetailMissingCopy(
  state: InventoryDetailLoadState,
  copy: {
    loading: string;
    unavailable: string;
    notFound: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return copy.notFound;
}

export function presentInventoryDetailMutationBusy(busy: boolean): boolean {
  return busy;
}

export function presentInventoryDetailMutationActionsEditable(
  canMutate: boolean,
  busy: boolean,
  hubReady: boolean
): boolean {
  return canMutate && !busy && hubReady;
}

export function resolveInventoryDetailWasteFailureReason(
  error: unknown
): InventoryDetailMutationNoticeReason {
  const message = error instanceof Error ? error.message : "";
  if (/insufficient quantity at the selected storage location/i.test(message)) {
    return "wasteLocationInsufficient";
  }
  if (/nothing on hand to record as waste/i.test(message)) {
    return "wasteNothingOnHand";
  }
  if (/create a storage location before recording waste/i.test(message)) {
    return "wasteLocationMissing";
  }
  return "wasteFailed";
}

export function resolveInventoryDetailTransferFailureReason(
  error: unknown
): InventoryDetailMutationNoticeReason {
  const message = error instanceof Error ? error.message : "";
  if (/insufficient quantity at the source storage location/i.test(message)) {
    return "transferInsufficient";
  }
  if (/choose different storage locations for a transfer/i.test(message)) {
    return "transferSameLocation";
  }
  if (/create a storage location before transferring stock/i.test(message)) {
    return "transferLocationMissing";
  }
  return "transferFailed";
}

export function resolveInventoryDetailSaveFailureReason(
  error: unknown
): InventoryDetailMutationNoticeReason {
  const message = error instanceof Error ? error.message : "";
  if (!message.trim()) return "saveFailed";
  if (/inventory item not found/i.test(message)) return "saveFailed";
  return "saveFailed";
}

export function presentInventoryDetailMutationNoticeCopy(
  reason: InventoryDetailMutationNoticeReason,
  copy: Record<InventoryDetailMutationNoticeReason, { title: string; message: string }>
): {
  tone: "danger" | "success" | "warning" | "neutral" | "caution";
  title: string;
  message: string;
} {
  const selected = copy[reason] ?? copy.loadFailed;
  if (
    reason === "updated" ||
    reason === "added" ||
    reason === "wasteRecorded" ||
    reason === "transferRecorded" ||
    reason === "locationAdded"
  ) {
    return { tone: "success", title: selected.title, message: selected.message };
  }
  if (
    reason === "viewOnlyInventory" ||
    reason === "viewOnlyOrdering" ||
    reason === "noWorkspace"
  ) {
    return { tone: "neutral", title: selected.title, message: selected.message };
  }
  if (
    reason === "reviewFields" ||
    reason === "reviewWaste" ||
    reason === "reviewTransfer" ||
    reason === "wasteNothingOnHand" ||
    reason === "wasteLocationMissing" ||
    reason === "wasteLocationInsufficient" ||
    reason === "transferInsufficient" ||
    reason === "transferSameLocation" ||
    reason === "transferLocationMissing"
  ) {
    return { tone: "caution", title: selected.title, message: selected.message };
  }
  if (reason === "locationsUnavailable") {
    return { tone: "warning", title: selected.title, message: selected.message };
  }
  return { tone: "danger", title: selected.title, message: selected.message };
}
