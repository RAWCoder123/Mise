import type { InventoryItem, SupplierItem } from "../../types/mise";

export interface InventoryBarcodeMatchOptions {
  /** Max matches to return after ranking. Defaults to 20. */
  limit?: number;
  /**
   * Optional supplier catalog rows used to match scanned codes against
   * `supplier_sku`. Resolved to inventory items by durable inventory_item_id
   * or by same-tenant supplier_id + item_name + unit.
   */
  supplierItems?: readonly SupplierItem[];
}

export interface InventoryBarcodeMatchResult {
  matches: InventoryItem[];
}

export interface InventoryBarcodeSkuHint {
  inventoryItemId: string;
  supplierSku: string;
}

/** Normalize barcode / inventory tokens for comparison (case, punctuation, whitespace). */
export function normalizeInventoryBarcodeToken(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Resolve supplier catalog SKUs onto inventory item ids for barcode matching.
 * Prefers an explicit inventory_item_id; otherwise matches supplier_id + name + unit.
 */
export function buildInventoryBarcodeSkuHints(
  items: readonly InventoryItem[],
  supplierItems: readonly SupplierItem[]
): InventoryBarcodeSkuHint[] {
  if (items.length === 0 || supplierItems.length === 0) return [];

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const itemsByIdentity = new Map<string, InventoryItem>();
  for (const item of items) {
    const key = inventoryIdentityKey(item.supplier_id, item.item_name, item.unit);
    if (!itemsByIdentity.has(key)) itemsByIdentity.set(key, item);
  }

  const hints: InventoryBarcodeSkuHint[] = [];
  const seen = new Set<string>();

  for (const supplierItem of supplierItems) {
    const sku = typeof supplierItem.supplier_sku === "string" ? supplierItem.supplier_sku.trim() : "";
    if (!sku) continue;

    let inventoryItem: InventoryItem | undefined;
    const linkedId =
      typeof supplierItem.inventory_item_id === "string" ? supplierItem.inventory_item_id.trim() : "";
    if (linkedId) {
      inventoryItem = itemsById.get(linkedId);
    }
    if (!inventoryItem && supplierItem.supplier_id) {
      inventoryItem = itemsByIdentity.get(
        inventoryIdentityKey(supplierItem.supplier_id, supplierItem.item_name, supplierItem.unit)
      );
    }
    if (!inventoryItem) continue;

    const dedupeKey = `${inventoryItem.id}\u001f${normalizeInventoryBarcodeToken(sku)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    hints.push({ inventoryItemId: inventoryItem.id, supplierSku: sku });
  }

  return hints;
}

function inventoryIdentityKey(supplierId: string, itemName: string, unit: string) {
  return [
    supplierId.trim().toLowerCase(),
    itemName.trim().toLowerCase(),
    unit.trim().toLowerCase()
  ].join("\u001f");
}

/**
 * Match a scanned or typed barcode against inventory items by supplier SKU, id,
 * item name, or supplier name. Exact normalized matches rank above substring
 * matches; id and SKU hits rank above name/supplier.
 */
export function matchInventoryBarcode(
  code: string,
  items: readonly InventoryItem[],
  options: InventoryBarcodeMatchOptions = {}
): InventoryBarcodeMatchResult {
  const needle = normalizeInventoryBarcodeToken(code);
  if (!needle || items.length === 0) return { matches: [] };

  const limit =
    typeof options.limit === "number" && Number.isFinite(options.limit)
      ? Math.max(1, Math.floor(options.limit))
      : 20;

  const skuHints = buildInventoryBarcodeSkuHints(items, options.supplierItems ?? []);
  const skuTokensByItemId = new Map<string, string[]>();
  for (const hint of skuHints) {
    const token = normalizeInventoryBarcodeToken(hint.supplierSku);
    if (!token) continue;
    const existing = skuTokensByItemId.get(hint.inventoryItemId) ?? [];
    existing.push(token);
    skuTokensByItemId.set(hint.inventoryItemId, existing);
  }

  type Ranked = { item: InventoryItem; score: number };
  const ranked: Ranked[] = [];

  for (const item of items) {
    const idToken = normalizeInventoryBarcodeToken(item.id);
    const nameToken = normalizeInventoryBarcodeToken(item.item_name);
    const supplierToken = normalizeInventoryBarcodeToken(item.supplier_name);
    const skuTokens = skuTokensByItemId.get(item.id) ?? [];

    let score = 0;
    if (idToken && idToken === needle) score = Math.max(score, 300);
    else if (idToken && idToken.includes(needle)) score = Math.max(score, 220);

    for (const skuToken of skuTokens) {
      if (skuToken === needle) score = Math.max(score, 280);
      else if (skuToken.includes(needle)) score = Math.max(score, 210);
      else if (needle.includes(skuToken) && skuToken.length >= 4) {
        score = Math.max(score, 190);
      }
    }

    if (nameToken && nameToken === needle) score = Math.max(score, 200);
    else if (nameToken && nameToken.includes(needle)) score = Math.max(score, 140);
    else if (nameToken && needle.includes(nameToken) && nameToken.length >= 4) {
      score = Math.max(score, 120);
    }

    if (supplierToken && supplierToken === needle) score = Math.max(score, 160);
    else if (supplierToken && supplierToken.includes(needle)) score = Math.max(score, 100);
    else if (supplierToken && needle.includes(supplierToken) && supplierToken.length >= 4) {
      score = Math.max(score, 90);
    }

    if (score > 0) ranked.push({ item, score });
  }

  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.item.item_name.localeCompare(right.item.item_name);
  });

  return { matches: ranked.slice(0, limit).map((entry) => entry.item) };
}
