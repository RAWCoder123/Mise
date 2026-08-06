import type { InventoryItem } from "../../types/mise";

export interface InventoryBarcodeMatchOptions {
  /** Max matches to return after ranking. Defaults to 20. */
  limit?: number;
}

export interface InventoryBarcodeMatchResult {
  matches: InventoryItem[];
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
 * Match a scanned or typed barcode against inventory items by id, item name, or supplier name.
 * Exact normalized matches rank above substring matches; id hits rank above name/supplier.
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

  type Ranked = { item: InventoryItem; score: number };
  const ranked: Ranked[] = [];

  for (const item of items) {
    const idToken = normalizeInventoryBarcodeToken(item.id);
    const nameToken = normalizeInventoryBarcodeToken(item.item_name);
    const supplierToken = normalizeInventoryBarcodeToken(item.supplier_name);

    let score = 0;
    if (idToken && idToken === needle) score = Math.max(score, 300);
    else if (idToken && idToken.includes(needle)) score = Math.max(score, 220);

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
