import type { InventoryItem, SupplierItem } from "../../types/mise";

export type SupplierPackVerificationStatus = "draft" | "verified" | "rejected" | "expired";

export interface VerifiedSupplierPack {
  inventoryItemId: string;
  packQuantity: number;
}

const MAX_PACK_QUANTITY = 1_000_000;

/**
 * Round a needed inventory-unit quantity up to whole packs when a manager has
 * verified the catalog pack size. Unverified or missing packs keep ceil(need).
 */
export function roundOrderQuantityToPack(
  neededQuantity: number,
  packQuantity: number | null | undefined
): number {
  const need = Number.isFinite(neededQuantity) ? Math.max(0, neededQuantity) : 0;
  const base = Math.max(1, Math.ceil(need));
  if (
    packQuantity == null ||
    !Number.isFinite(packQuantity) ||
    packQuantity <= 1 ||
    packQuantity > MAX_PACK_QUANTITY
  ) {
    return base;
  }
  const pack = packQuantity;
  const packs = Math.max(1, Math.ceil(base / pack));
  return packs * pack;
}

export function isVerifiedSupplierPackQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_PACK_QUANTITY
  );
}

function itemNameKey(value: string) {
  return value.trim().toLowerCase();
}

function unitKey(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Prefer the preferred verified catalog row linked to the inventory item.
 * Fall back to a same-tenant supplier/name/unit match so legacy rows without
 * inventory_item_id still participate after managers verify them.
 */
export function resolveVerifiedPackQuantity(
  restaurantId: string,
  inventoryItem: Pick<InventoryItem, "id" | "item_name" | "unit" | "supplier_id">,
  supplierItems: readonly SupplierItem[]
): number | null {
  const linked = supplierItems
    .filter(
      (entry) =>
        entry.restaurant_id === restaurantId &&
        entry.inventory_item_id === inventoryItem.id &&
        entry.verification_status === "verified" &&
        isVerifiedSupplierPackQuantity(entry.pack_quantity)
    )
    .sort((left, right) => {
      if (left.preferred !== right.preferred) return left.preferred ? -1 : 1;
      return right.updated_at.localeCompare(left.updated_at) || right.id.localeCompare(left.id);
    });
  if (linked[0]) return linked[0].pack_quantity!;

  const name = itemNameKey(inventoryItem.item_name);
  const unit = unitKey(inventoryItem.unit);
  const matched = supplierItems
    .filter(
      (entry) =>
        entry.restaurant_id === restaurantId &&
        entry.verification_status === "verified" &&
        isVerifiedSupplierPackQuantity(entry.pack_quantity) &&
        entry.supplier_id === inventoryItem.supplier_id &&
        itemNameKey(entry.item_name) === name &&
        unitKey(entry.unit) === unit
    )
    .sort((left, right) => {
      if (left.preferred !== right.preferred) return left.preferred ? -1 : 1;
      return right.updated_at.localeCompare(left.updated_at) || right.id.localeCompare(left.id);
    });
  return matched[0]?.pack_quantity ?? null;
}

export function buildVerifiedPackByInventoryItemId(
  restaurantId: string,
  inventoryItems: readonly Pick<InventoryItem, "id" | "item_name" | "unit" | "supplier_id">[],
  supplierItems: readonly SupplierItem[]
): Map<string, number> {
  const packs = new Map<string, number>();
  for (const item of inventoryItems) {
    if (item.id && restaurantId) {
      const pack = resolveVerifiedPackQuantity(restaurantId, item, supplierItems);
      if (pack != null) packs.set(item.id, pack);
    }
  }
  return packs;
}

export function verifiedPackMapFromSnapshotEntries(
  entries: readonly VerifiedSupplierPack[] | null | undefined
): Map<string, number> {
  const packs = new Map<string, number>();
  for (const entry of entries ?? []) {
    if (
      typeof entry?.inventoryItemId === "string" &&
      entry.inventoryItemId.trim() &&
      isVerifiedSupplierPackQuantity(entry.packQuantity)
    ) {
      packs.set(entry.inventoryItemId, entry.packQuantity);
    }
  }
  return packs;
}

export function requireSupplierPackQuantity(value: unknown): number {
  if (!isVerifiedSupplierPackQuantity(typeof value === "number" ? value : Number(value))) {
    throw new Error(`Pack quantity must be greater than zero and no more than ${MAX_PACK_QUANTITY.toLocaleString()}.`);
  }
  return Number(value);
}

export const supplierPackQuantityLimits = {
  maxPackQuantity: MAX_PACK_QUANTITY
} as const;
