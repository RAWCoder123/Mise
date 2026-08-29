/**
 * Ranked find for Settings → Recipes builder chips for POS dishes missing recipes.
 * Never invents menu names; only filters the caller-supplied list.
 */

export const RECIPE_MISSING_MENU_SEARCH_THRESHOLD = 5;

function normalizeSearchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(query: string): string[] {
  return normalizeSearchKey(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreMissingMenuMatch(itemName: string, query: string): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const dishKey = normalizeSearchKey(itemName);
  if (!dishKey) return null;

  if (dishKey === normalizedQuery) return 1000;

  let score = 0;
  if (dishKey.startsWith(normalizedQuery)) score = 800;
  else if (dishKey.includes(normalizedQuery)) score = 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => dishKey.includes(token));
    if (allTokensPresent) score = Math.max(score, 700);
    else if (score <= 0) return null;
  }

  return score > 0 ? score : null;
}

/**
 * Rank POS dishes that still need a recipe baseline.
 * Empty query preserves caller order (full list). Non-empty query ranks name matches.
 */
export function filterMissingMenuItemsBySearch(items: readonly string[], query: string): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normalizeSearchKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }

  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return unique;

  return unique
    .map((item, index) => {
      const score = scoreMissingMenuMatch(item, query);
      if (score == null) return null;
      return { item, score, index };
    })
    .filter((match): match is { item: string; score: number; index: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.item);
}
