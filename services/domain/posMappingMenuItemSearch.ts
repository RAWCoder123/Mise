/**
 * Ranked find for Settings → POS mappings expanded menu-item picker.
 * Never invents menu items; only filters the caller-supplied choice list.
 */

export const POS_MAPPING_MENU_ITEM_SEARCH_THRESHOLD = 8;

export type PosMappingMenuItemSearchFields = {
  id: string;
  name: string;
  category?: string | null;
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

function scoreMenuItemMatch(item: PosMappingMenuItemSearchFields, query: string): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const nameKey = normalizeSearchKey(item.name);
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
  if (categoryKey.includes(normalizedQuery)) score = Math.max(score, 350);

  return score > 0 ? score : null;
}

/**
 * Rank active menu items for POS mapping review.
 * Empty query preserves caller order (full deduped list). Non-empty query ranks
 * name and category matches without inventing rows.
 */
export function filterPosMappingMenuItemsBySearch<T extends PosMappingMenuItemSearchFields>(
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
      const score = scoreMenuItemMatch(item, query);
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
