import type {
  InventoryCountLine,
  InventoryCountSession,
  InventoryCountSessionStatus,
  InventoryItem,
  RestaurantRole
} from "../../types/mise";

export const INVENTORY_COUNT_SESSION_OPEN_STATUSES = ["in_progress", "submitted"] as const;
export type InventoryCountSessionOpenStatus = (typeof INVENTORY_COUNT_SESSION_OPEN_STATUSES)[number];

/** Staff may begin, save, and submit counts; only managers+ may approve or cancel. */
export const INVENTORY_COUNT_DRAFT_ROLES: readonly RestaurantRole[] = [
  "owner",
  "admin",
  "manager",
  "staff"
];
export const INVENTORY_COUNT_APPROVE_ROLES: readonly RestaurantRole[] = ["owner", "admin", "manager"];

export function canDraftInventoryCountSession(role: RestaurantRole | null | undefined): boolean {
  return Boolean(role && INVENTORY_COUNT_DRAFT_ROLES.includes(role));
}

export function canApproveInventoryCountSession(role: RestaurantRole | null | undefined): boolean {
  return Boolean(role && INVENTORY_COUNT_APPROVE_ROLES.includes(role));
}

export function canCancelInventoryCountSession(role: RestaurantRole | null | undefined): boolean {
  return canApproveInventoryCountSession(role);
}

export type InventoryCountLineInput = {
  inventoryItemId: string;
  countedQuantity: number;
  note?: string | null;
};

export type PlannedCountLineApproval = {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  systemQuantityAtStart: number;
  countedQuantity: number;
  quantityBefore: number;
  quantityAfter: number;
  variance: number;
  changed: boolean;
  note: string | null;
};

export type CountSessionProgressSummary = {
  totalLines: number;
  countedLines: number;
  remainingLines: number;
  varianceLines: number;
  isComplete: boolean;
  canSubmit: boolean;
  canApprove: boolean;
};

export function isOpenCountSessionStatus(status: InventoryCountSessionStatus): status is InventoryCountSessionOpenStatus {
  return status === "in_progress" || status === "submitted";
}

export function summarizeCountSessionProgress(
  lines: readonly Pick<InventoryCountLine, "counted_quantity" | "system_quantity_at_start">[]
): CountSessionProgressSummary {
  const totalLines = lines.length;
  const countedLines = lines.filter((line) => line.counted_quantity != null).length;
  const remainingLines = Math.max(0, totalLines - countedLines);
  const varianceLines = lines.filter((line) => {
    if (line.counted_quantity == null) return false;
    return Number(line.counted_quantity) !== Number(line.system_quantity_at_start);
  }).length;
  const isComplete = totalLines > 0 && remainingLines === 0;
  return {
    totalLines,
    countedLines,
    remainingLines,
    varianceLines,
    isComplete,
    canSubmit: isComplete,
    canApprove: isComplete
  };
}

export function planCountSessionApprovals(input: {
  inventoryItems: readonly InventoryItem[];
  lines: readonly InventoryCountLine[];
}): PlannedCountLineApproval[] {
  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  const planned: PlannedCountLineApproval[] = [];

  for (const line of input.lines) {
    if (line.counted_quantity == null) {
      throw new Error("Every count line must have a counted quantity before approval.");
    }
    const countedQuantity = Number(line.counted_quantity);
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0 || countedQuantity > 1_000_000) {
      throw new Error("Counted quantity is outside supported limits.");
    }
    const item = itemsById.get(line.inventory_item_id);
    if (!item) {
      throw new Error("Count line references an inventory item that is no longer available.");
    }
    const quantityBefore = Number(item.current_quantity);
    const quantityAfter = countedQuantity;
    const note =
      typeof line.note === "string" && line.note.trim() ? line.note.trim() : null;
    if (note && note.length > 240) {
      throw new Error("Count line note is outside supported limits.");
    }
    planned.push({
      inventoryItemId: item.id,
      itemName: item.item_name,
      unit: item.unit,
      systemQuantityAtStart: Number(line.system_quantity_at_start),
      countedQuantity,
      quantityBefore,
      quantityAfter,
      variance: quantityAfter - quantityBefore,
      changed: quantityAfter !== quantityBefore,
      note
    });
  }

  return planned;
}

export function applyCountApprovalsToInventory(
  inventoryItems: readonly InventoryItem[],
  approvals: readonly PlannedCountLineApproval[],
  lastUpdated: string
): InventoryItem[] {
  const byId = new Map(approvals.map((approval) => [approval.inventoryItemId, approval]));
  return inventoryItems.map((item) => {
    const approval = byId.get(item.id);
    if (!approval) return item;
    return {
      ...item,
      current_quantity: approval.quantityAfter,
      last_updated: lastUpdated
    };
  });
}

export function isCountSessionEligibleInventoryItem(item: Pick<
  InventoryItem,
  "canonical_unit" | "canonical_quantity_per_unit" | "canonical_unit_verification_status"
>): boolean {
  const conversion = item.canonical_quantity_per_unit;
  return (
    item.canonical_unit_verification_status === "verified" &&
    (item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each") &&
    conversion != null &&
    Number.isFinite(conversion) &&
    conversion > 0
  );
}

export function buildCountSessionLinesFromInventory(
  restaurantId: string,
  sessionId: string,
  inventoryItems: readonly InventoryItem[],
  nowIso: string
): InventoryCountLine[] {
  const eligibleItems = inventoryItems.filter(isCountSessionEligibleInventoryItem);
  if (eligibleItems.length < 1) {
    throw new Error("Verify canonical units for inventory items before starting a count session.");
  }
  if (eligibleItems.length > 250) {
    throw new Error("Count sessions support at most 250 items.");
  }
  return eligibleItems.map((item, index) => ({
    id: `${sessionId}_line_${index + 1}`,
    restaurant_id: restaurantId,
    session_id: sessionId,
    inventory_item_id: item.id,
    item_name: item.item_name,
    unit: item.unit,
    system_quantity_at_start: item.current_quantity,
    counted_quantity: null,
    note: null,
    created_at: nowIso,
    updated_at: nowIso
  }));
}

export function mergeCountLineUpdates(
  lines: readonly InventoryCountLine[],
  updates: readonly InventoryCountLineInput[]
): InventoryCountLine[] {
  if (updates.length < 1) throw new Error("Provide at least one count line to save.");
  if (updates.length > 250) throw new Error("Too many count lines in one save.");

  const updatesByItemId = new Map<string, { countedQuantity: number; note: string | null; noteProvided: boolean }>();
  for (const update of updates) {
    const itemId = update.inventoryItemId.trim();
    if (!itemId) throw new Error("Count line is missing an inventory item.");
    const quantity = Number(update.countedQuantity);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) {
      throw new Error("Counted quantity must be between 0 and 1,000,000.");
    }
    const noteProvided = Object.prototype.hasOwnProperty.call(update, "note");
    let note: string | null = null;
    if (noteProvided) {
      if (update.note === null || update.note === undefined) {
        note = null;
      } else if (typeof update.note !== "string") {
        throw new Error("Count line note must be text.");
      } else {
        const normalized = update.note.trim();
        if (normalized.length > 240) {
          throw new Error("Count line note is limited to 240 characters.");
        }
        note = normalized || null;
      }
    }
    updatesByItemId.set(itemId, { countedQuantity: quantity, note, noteProvided });
  }

  let matched = 0;
  const next = lines.map((line) => {
    const update = updatesByItemId.get(line.inventory_item_id);
    if (!update) return line;
    matched += 1;
    return {
      ...line,
      counted_quantity: update.countedQuantity,
      note: update.noteProvided ? update.note : line.note,
      updated_at: new Date().toISOString()
    };
  });
  if (matched !== updatesByItemId.size) {
    throw new Error("One or more count lines are not part of this session.");
  }
  return next;
}

export function assertSessionMutable(session: Pick<InventoryCountSession, "status">, action: "save" | "submit" | "approve" | "cancel") {
  if (action === "save" || action === "submit") {
    if (session.status !== "in_progress") {
      throw new Error("Only an in-progress count session can be edited or submitted.");
    }
    return;
  }
  if (action === "approve") {
    if (session.status !== "submitted") {
      throw new Error("Submit the count session before approving adjustments.");
    }
    return;
  }
  if (!isOpenCountSessionStatus(session.status)) {
    throw new Error("This count session is already closed.");
  }
}

/** Stable operator-facing reasons for count-session RPC and client validation failures. */
export type InventoryCountSessionFailureReason =
  | "unverified_canonical_units"
  | "item_cap_exceeded"
  | "already_open"
  | "session_not_found"
  | "not_editable"
  | "incomplete_lines"
  | "already_closed"
  | "submit_required"
  | "planning_conflict"
  | "permission_denied"
  | "quantity_outside_limits"
  | "line_not_in_session"
  | "item_unavailable"
  | "note_outside_limits"
  | "lines_payload_invalid"
  | "unknown";

export type InventoryCountSessionOperation = "start" | "save" | "submit" | "approve" | "cancel";

export type InventoryCountSessionClientFailureReason =
  | "note_outside_limits"
  | "incomplete_lines";

/** Client-side count validation that must not surface as a raw RPC string. */
export class InventoryCountSessionClientError extends Error {
  readonly reason: InventoryCountSessionClientFailureReason;

  constructor(reason: InventoryCountSessionClientFailureReason) {
    super(reason);
    this.name = "InventoryCountSessionClientError";
    this.reason = reason;
  }
}

function extractCountSessionErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
}

function extractCountSessionErrorCode(error: unknown): string {
  if (error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "";
}

/** Maps Postgres/demo/client count-session failures onto stable reason codes. */
export function inventoryCountSessionFailureReasonFrom(error: unknown): InventoryCountSessionFailureReason {
  if (error instanceof InventoryCountSessionClientError) return error.reason;

  const code = extractCountSessionErrorCode(error);
  const message = extractCountSessionErrorMessage(error);

  if (code === "42501" || /not authorized/i.test(message)) return "permission_denied";
  if (code === "40001" || /planning snapshot changed/i.test(message)) return "planning_conflict";
  if (/already open/i.test(message)) return "already_open";
  if (/canonical unit/i.test(message)) return "unverified_canonical_units";
  if (/at most 250|too many count lines/i.test(message)) return "item_cap_exceeded";
  if (/count session not found/i.test(message)) return "session_not_found";
  if (/only an in-progress count session/i.test(message)) return "not_editable";
  if (/count every item/i.test(message)) return "incomplete_lines";
  if (/already closed/i.test(message)) return "already_closed";
  if (/submit the count session before approving/i.test(message)) return "submit_required";
  if (/counted quantity|quantity is outside supported limits/i.test(message)) {
    return "quantity_outside_limits";
  }
  if (/not part of this session/i.test(message)) return "line_not_in_session";
  if (/no longer available/i.test(message)) return "item_unavailable";
  if (/note is (outside supported limits|limited to)/i.test(message)) return "note_outside_limits";
  if (/count lines payload|provide at least one count line|missing an inventory item|note must be text/i.test(message)) {
    return "lines_payload_invalid";
  }
  return "unknown";
}

/** Catalog key for a count-session failure reason + mutation operation. */
export function inventoryCountSessionFailureMessageKey(
  reason: InventoryCountSessionFailureReason,
  operation: InventoryCountSessionOperation
) {
  switch (reason) {
    case "unverified_canonical_units":
      return "inventory.count.startError" as const;
    case "item_cap_exceeded":
      return "inventory.count.failure.itemCap" as const;
    case "already_open":
      return "inventory.count.failure.alreadyOpen" as const;
    case "session_not_found":
      return "inventory.count.failure.sessionNotFound" as const;
    case "not_editable":
      return "inventory.count.failure.notEditable" as const;
    case "incomplete_lines":
      return "inventory.count.incomplete" as const;
    case "already_closed":
      return "inventory.count.failure.alreadyClosed" as const;
    case "submit_required":
      return "inventory.count.failure.submitRequired" as const;
    case "planning_conflict":
      return "inventory.count.failure.planningConflict" as const;
    case "permission_denied":
      return "inventory.count.failure.permissionDenied" as const;
    case "quantity_outside_limits":
      return "inventory.count.failure.quantityLimits" as const;
    case "line_not_in_session":
      return "inventory.count.failure.lineMissing" as const;
    case "item_unavailable":
      return "inventory.count.failure.itemUnavailable" as const;
    case "note_outside_limits":
      return "inventory.count.noteTooLong" as const;
    case "lines_payload_invalid":
      return "inventory.count.failure.linesInvalid" as const;
    case "unknown":
    default:
      if (operation === "start") return "inventory.count.startErrorGeneric" as const;
      if (operation === "save") return "inventory.count.saveError" as const;
      if (operation === "submit") return "inventory.count.submitError" as const;
      if (operation === "approve") return "inventory.count.approveError" as const;
      return "inventory.count.cancelError" as const;
  }
}
