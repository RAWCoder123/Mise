import type { InventoryItem } from "../../types/mise";

export const ADHOC_RECEIPT_UNIT_COST_MAX = 1_000_000;

export type AdhocReceiptUnitCostRefusal =
  | "cross_tenant"
  | "invalid_unit_cost"
  | "already_applied";

export type AdhocReceiptUnitCostProposal =
  | {
      ok: true;
      unitCost: number;
      previousUnitCost: number;
    }
  | {
      ok: false;
      reason: AdhocReceiptUnitCostRefusal;
    };

export interface AdhocReceiptUnitCostApplyResult {
  outcome: "applied" | "already_applied";
  inventoryItemId: string;
  unitCost: number;
  previousUnitCost: number;
}

/**
 * Ad-hoc receipt unit costs and estimated_unit_cost share the inventory item's
 * display/purchase unit (not the canonical ledger unit). Compare at four decimal
 * places so float noise does not re-apply an identical estimate.
 */
export function roundAdhocReceiptUnitCost(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function normalizeAdhocReceiptUnitCost(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (
    !Number.isFinite(numeric) ||
    numeric < 0 ||
    numeric > ADHOC_RECEIPT_UNIT_COST_MAX
  ) {
    return null;
  }
  return roundAdhocReceiptUnitCost(numeric);
}

export function unitCostsMatch(left: number, right: number): boolean {
  return roundAdhocReceiptUnitCost(left) === roundAdhocReceiptUnitCost(right);
}

/**
 * Reads a bounded unitCost from receipt ledger metadata. Missing or invalid
 * values fail closed to null — never invent a price.
 */
export function unitCostFromReceiptMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined | null
): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  return normalizeAdhocReceiptUnitCost(metadata.unitCost);
}

/**
 * Builds receipt metadata with an optional operator note and optional unit cost.
 * Empty optional fields are omitted so idempotency comparisons stay stable.
 */
export function buildAdhocReceiptMetadata(input: {
  note?: string | null;
  unitCost?: number | null;
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note) metadata.note = note;
  if (input.unitCost != null) {
    const unitCost = normalizeAdhocReceiptUnitCost(input.unitCost);
    if (unitCost == null) {
      throw new Error("Enter a valid unit cost.");
    }
    metadata.unitCost = unitCost;
  }
  return metadata;
}

/**
 * Decides whether an operator-entered ad-hoc receipt unit cost may rewrite the
 * item's estimated_unit_cost. Never invents a price.
 */
export function proposeAdhocReceiptUnitCostApply(input: {
  restaurantId: string;
  inventoryItem: Pick<InventoryItem, "id" | "restaurant_id" | "estimated_unit_cost">;
  unitCost: unknown;
}): AdhocReceiptUnitCostProposal {
  const restaurantId = input.restaurantId.trim();
  if (
    !restaurantId ||
    !input.inventoryItem.id.trim() ||
    input.inventoryItem.restaurant_id !== restaurantId
  ) {
    return { ok: false, reason: "cross_tenant" };
  }
  const unitCost = normalizeAdhocReceiptUnitCost(input.unitCost);
  if (unitCost == null) {
    return { ok: false, reason: "invalid_unit_cost" };
  }
  const previousUnitCost = Number.isFinite(input.inventoryItem.estimated_unit_cost)
    ? roundAdhocReceiptUnitCost(input.inventoryItem.estimated_unit_cost)
    : 0;
  if (unitCostsMatch(previousUnitCost, unitCost)) {
    return { ok: false, reason: "already_applied" };
  }
  return { ok: true, unitCost, previousUnitCost };
}
