/**
 * Ranked find for Settings → Recipes builder inventory chips.
 * Never invents stock items; only filters the caller-supplied list.
 */

export const RECIPE_INVENTORY_CHIP_SEARCH_THRESHOLD = 7;

export type RecipeInventoryChipFields = {
  id: string;
  item_name: string;
  category?: string | null;
  supplier_name?: string | null;
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

function scoreInventoryChipMatch(item: RecipeInventoryChipFields, query: string): number | null {
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

  const categoryKey = normalizeSearchKey(item.category ?? "");
  const supplierKey = normalizeSearchKey(item.supplier_name ?? "");
  if (categoryKey.includes(normalizedQuery)) score = Math.max(score, 350);
  if (supplierKey.includes(normalizedQuery)) score = Math.max(score, 300);

  return score > 0 ? score : null;
}

/**
 * Rank inventory items for recipe-builder chips.
 * Empty query preserves caller order (full list). Non-empty query ranks name,
 * category, and supplier matches without inventing rows.
 */
export function filterInventoryItemsForRecipeBuilder<T extends RecipeInventoryChipFields>(
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
      const score = scoreInventoryChipMatch(item, query);
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
