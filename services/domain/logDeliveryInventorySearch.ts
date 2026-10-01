/**
 * Ranked find for More → Log Delivery inventory picker.
 * Never invents stock items; only filters the caller-supplied list.
 * Empty query returns the full uncapped caller order (no soft-cap).
 */

export type LogDeliveryInventorySearchFields = {
  id: string;
  item_name: string;
  category?: string | null;
  supplier_name?: string | null;
  unit?: string | null;
};

function normalizeSearchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(query: string): string[] {
  return normalizeSearchKey(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreLogDeliveryItemMatch(
  item: LogDeliveryInventorySearchFields,
  query: string
): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const nameKey = normalizeSearchKey(item.item_name);
  if (!nameKey) return null;

  if (nameKey === normalizedQuery) return 1000;

  let score = 0;
  if (nameKey.startsWith(normalizedQuery)) score = 800;
  else if (nameKey.includes(normalizedQuery)) score = 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => nameKey.includes(token));
    if (allTokensPresent) score = Math.max(score, 700);
  }

  const idKey = normalizeSearchKey(item.id);
  const categoryKey = normalizeSearchKey(item.category ?? "");
  const supplierKey = normalizeSearchKey(item.supplier_name ?? "");
  const unitKey = normalizeSearchKey(item.unit ?? "");

  if (idKey && idKey === normalizedQuery) score = Math.max(score, 950);
  else if (idKey && idKey.includes(normalizedQuery)) score = Math.max(score, 500);

  if (categoryKey.includes(normalizedQuery)) score = Math.max(score, 350);
  if (supplierKey.includes(normalizedQuery)) score = Math.max(score, 300);
  if (unitKey && unitKey.includes(normalizedQuery)) score = Math.max(score, 250);

  return score > 0 ? score : null;
}

/**
 * Rank inventory items for Log Delivery search / browse.
 * Empty query preserves caller order (full list, uncapped). Non-empty query
 * ranks name, id, category, supplier, and unit matches without inventing rows.
 */
export function filterLogDeliveryInventoryBySearch<T extends LogDeliveryInventorySearchFields>(
  items: readonly T[],
  query: string
): T[] {
  const unique: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const id = item.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(item);
  }

  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return unique;

  return unique
    .map((item, index) => {
      const score = scoreLogDeliveryItemMatch(item, query);
      if (score == null) return null;
      return { item, score, index };
    })
    .filter((match): match is { item: T; score: number; index: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.item);
}
