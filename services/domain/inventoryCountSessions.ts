import type { InventoryCountLine, InventoryCountSession, InventoryCountSessionStatus, InventoryItem } from "../../types/mise";

export const INVENTORY_COUNT_SESSION_OPEN_STATUSES = ["in_progress", "submitted"] as const;
export type InventoryCountSessionOpenStatus = (typeof INVENTORY_COUNT_SESSION_OPEN_STATUSES)[number];

export type InventoryCountLineInput = {
  inventoryItemId: string;
  countedQuantity: number;
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
    planned.push({
      inventoryItemId: item.id,
      itemName: item.item_name,
      unit: item.unit,
      systemQuantityAtStart: Number(line.system_quantity_at_start),
      countedQuantity,
      quantityBefore,
      quantityAfter,
      variance: quantityAfter - quantityBefore,
      changed: quantityAfter !== quantityBefore
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

export function buildCountSessionLinesFromInventory(
  restaurantId: string,
  sessionId: string,
  inventoryItems: readonly InventoryItem[],
  nowIso: string
): InventoryCountLine[] {
  if (inventoryItems.length < 1) {
    throw new Error("Add inventory items before starting a count session.");
  }
  if (inventoryItems.length > 250) {
    throw new Error("Count sessions support at most 250 items.");
  }
  return inventoryItems.map((item, index) => ({
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

  const updatesByItemId = new Map<string, number>();
  for (const update of updates) {
    const itemId = update.inventoryItemId.trim();
    if (!itemId) throw new Error("Count line is missing an inventory item.");
    const quantity = Number(update.countedQuantity);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) {
      throw new Error("Counted quantity must be between 0 and 1,000,000.");
    }
    updatesByItemId.set(itemId, quantity);
  }

  let matched = 0;
  const next = lines.map((line) => {
    if (!updatesByItemId.has(line.inventory_item_id)) return line;
    matched += 1;
    return {
      ...line,
      counted_quantity: updatesByItemId.get(line.inventory_item_id) ?? null,
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
