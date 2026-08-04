import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "./hubLoadState";

export type InventoryCountLoadState = "loading" | "ready" | "error";

export type InventoryCountMutation = "start" | "save" | "submit" | "approve" | "cancel";

export type InventoryCountFailureReason =
  | "alreadyOpen"
  | "noItems"
  | "capacity"
  | "notInProgress"
  | "notSubmitted"
  | "alreadyClosed"
  | "notFound"
  | "invalidLines"
  | "unknownLine"
  | "quantityBounds"
  | "noteBounds"
  | "incomplete"
  | "saveEmpty"
  | "invalidQuantity"
  | "permission"
  | "unknown";

export type InventoryCountLineDraft = {
  inventoryItemId: string;
  countedQuantity: number;
  note: string | null;
};

export type InventoryCountLinePayloadResult =
  | { ok: true; lines: InventoryCountLineDraft[] }
  | { ok: false; reason: "invalidQuantity"; item: string }
  | { ok: false; reason: "noteTooLong" }
  | { ok: false; reason: "incomplete" }
  | { ok: false; reason: "saveEmpty" };

export function resolveInventoryCountLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): InventoryCountLoadState {
  return resolveRestaurantScopedHubLoadState(input);
}

export function presentInventoryCountStartCopy(
  state: InventoryCountLoadState,
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    startTitle: string;
    startBody: string;
  }
): { title: string; body: string; canStart: boolean } {
  if (state === "loading") {
    return { title: copy.loadingTitle, body: copy.loadingBody, canStart: false };
  }
  if (state === "error") {
    return {
      title: copy.unavailableTitle,
      body: copy.unavailableBody,
      canStart: false
    };
  }
  return { title: copy.startTitle, body: copy.startBody, canStart: true };
}

/**
 * Count mutations stay non-editable until the session hub proves ready.
 * Role membership alone is not enough after a soft-refresh denial/error.
 */
export function presentInventoryCountMutationActionsEditable(
  allowed: boolean,
  busy: boolean,
  hubReady: boolean
): boolean {
  return presentRestaurantScopedHubActionsEditable({
    allowed,
    hubReady,
    busy
  });
}

export function resolveInventoryCountFailureReason(error: unknown): InventoryCountFailureReason {
  const message = error instanceof Error ? error.message : "";
  if (!message.trim()) return "unknown";
  if (/Not authorized/i.test(message)) return "permission";
  if (/already open for this restaurant/i.test(message)) return "alreadyOpen";
  if (/Add inventory items before starting/i.test(message)) return "noItems";
  if (/at most 250 items/i.test(message)) return "capacity";
  if (/Only an in-progress count session can be (edited|submitted)/i.test(message)) {
    return "notInProgress";
  }
  if (/Submit the count session before approving/i.test(message)) return "notSubmitted";
  if (/already closed/i.test(message)) return "alreadyClosed";
  if (/Count session not found/i.test(message)) return "notFound";
  if (/Count every item before submitting/i.test(message)) return "incomplete";
  if (
    /Count lines payload|Provide at least one count line|Too many count lines/i.test(message)
  ) {
    return "invalidLines";
  }
  if (
    /not part of this session|Count line inventory_item_id|Count line is missing an inventory item/i.test(
      message
    )
  ) {
    return "unknownLine";
  }
  if (
    /Counted quantity|counted_quantity is invalid/i.test(message) ||
    /Counted quantity is outside supported limits/i.test(message)
  ) {
    return "quantityBounds";
  }
  if (
    /Count line note|Count session note is outside|notes are limited to 240/i.test(message)
  ) {
    return "noteBounds";
  }
  return "unknown";
}

export function presentInventoryCountFailureCopy(
  reason: InventoryCountFailureReason,
  copy: Record<InventoryCountFailureReason, { title: string; message: string }>
): { tone: "danger"; title: string; message: string } {
  const selected = copy[reason] ?? copy.unknown;
  return {
    tone: "danger",
    title: selected.title,
    message: selected.message
  };
}

export function presentInventoryCountSuccessCopy(
  mutation: InventoryCountMutation,
  copy: Record<InventoryCountMutation, string>
): { tone: "success"; title: string } {
  return {
    tone: "success",
    title: copy[mutation]
  };
}

export function buildInventoryCountLinePayload(input: {
  lines: readonly {
    inventory_item_id: string;
    item_name: string;
  }[];
  draftCounts: Readonly<Record<string, string>>;
  draftNotes: Readonly<Record<string, string>>;
  parseNumber: (value: string) => number | null;
  requireComplete: boolean;
}): InventoryCountLinePayloadResult {
  const lines: InventoryCountLineDraft[] = [];

  for (const line of input.lines) {
    const raw = input.draftCounts[line.inventory_item_id]?.trim() ?? "";
    if (!raw) continue;
    const countedQuantity = input.parseNumber(raw);
    if (countedQuantity == null || !Number.isFinite(countedQuantity) || countedQuantity < 0) {
      return { ok: false, reason: "invalidQuantity", item: line.item_name };
    }
    const noteRaw = input.draftNotes[line.inventory_item_id] ?? "";
    if (noteRaw.trim().length > 240) {
      return { ok: false, reason: "noteTooLong" };
    }
    lines.push({
      inventoryItemId: line.inventory_item_id,
      countedQuantity,
      note: noteRaw.trim() || null
    });
  }

  if (input.requireComplete && lines.length !== input.lines.length) {
    return { ok: false, reason: "incomplete" };
  }
  if (!input.requireComplete && lines.length < 1) {
    return { ok: false, reason: "saveEmpty" };
  }
  return { ok: true, lines };
}
