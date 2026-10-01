import type { SupplierItem } from "../../types/mise";

export interface SupplierCatalogLine {
  id: string;
  restaurantId: string;
  supplierId: string | null;
  supplierName: string;
  itemName: string;
  unit: string;
  supplierSku: string | null;
  packSize: string | null;
  preferred: boolean;
  estimatedUnitCost: number;
}

export interface SupplierCatalogGroup {
  supplierKey: string;
  supplierId: string | null;
  supplierName: string;
  preferredCount: number;
  lines: SupplierCatalogLine[];
}

/**
 * Builds a read-only supplier catalog browse model from SELECT-backed
 * `supplier_items`. Never invents pack labels, SKUs, preference, or costs —
 * null/empty catalog evidence stays null/empty for the operator.
 */
export function buildSupplierCatalogBrowse(
  restaurantId: string,
  items: readonly SupplierItem[]
): SupplierCatalogGroup[] {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) return [];

  const groups = new Map<string, SupplierCatalogGroup>();

  for (const item of items) {
    if (item.restaurant_id !== normalizedRestaurantId) continue;
    const line = toCatalogLine(normalizedRestaurantId, item);
    if (!line) continue;

    const supplierKey = line.supplierId
      ? `id:${line.supplierId}`
      : `name:${supplierSortKey(line.supplierName)}`;
    const existing = groups.get(supplierKey);
    if (existing) {
      existing.lines.push(line);
      if (line.preferred) existing.preferredCount += 1;
      continue;
    }

    groups.set(supplierKey, {
      supplierKey,
      supplierId: line.supplierId,
      supplierName: line.supplierName,
      preferredCount: line.preferred ? 1 : 0,
      lines: [line]
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      lines: [...group.lines].sort(compareCatalogLines)
    }))
    .sort((left, right) => {
      const nameDelta = compareStrings(
        supplierSortKey(left.supplierName),
        supplierSortKey(right.supplierName)
      );
      if (nameDelta) return nameDelta;
      return compareStrings(left.supplierKey, right.supplierKey);
    });
}

function toCatalogLine(
  restaurantId: string,
  item: SupplierItem
): SupplierCatalogLine | null {
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const itemName = typeof item.item_name === "string" ? item.item_name.trim() : "";
  const supplierName =
    typeof item.supplier_name === "string" ? item.supplier_name.trim().replace(/\s+/g, " ") : "";
  const unit = typeof item.unit === "string" ? item.unit.trim() : "";
  if (!id || !itemName || !supplierName || !unit) return null;

  const supplierId =
    typeof item.supplier_id === "string" && item.supplier_id.trim()
      ? item.supplier_id.trim()
      : item.supplier_id === null || item.supplier_id === undefined
        ? null
        : null;

  const supplierSku =
    typeof item.supplier_sku === "string" && item.supplier_sku.trim()
      ? item.supplier_sku.trim()
      : null;
  const packSize =
    typeof item.pack_size === "string" && item.pack_size.trim()
      ? item.pack_size.trim()
      : null;
  const estimatedUnitCost =
    typeof item.estimated_unit_cost === "number" && Number.isFinite(item.estimated_unit_cost)
      ? Math.max(0, item.estimated_unit_cost)
      : 0;

  return {
    id,
    restaurantId,
    supplierId,
    supplierName,
    itemName,
    unit,
    supplierSku,
    packSize,
    preferred: Boolean(item.preferred),
    estimatedUnitCost
  };
}

function compareCatalogLines(left: SupplierCatalogLine, right: SupplierCatalogLine) {
  if (left.preferred !== right.preferred) return left.preferred ? -1 : 1;
  const nameDelta = compareStrings(
    supplierSortKey(left.itemName),
    supplierSortKey(right.itemName)
  );
  if (nameDelta) return nameDelta;
  return compareStrings(left.id, right.id);
}

function supplierSortKey(value: string) {
  return value.toLocaleLowerCase("en-US");
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, "en-US");
}
