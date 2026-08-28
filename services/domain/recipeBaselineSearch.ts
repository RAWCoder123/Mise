/**
 * Ranked find for Settings → Recipes mapped dishes.
 * Matches dish name and linked ingredient names without inventing inventory facts.
 */

export const RECIPE_BASELINE_SEARCH_THRESHOLD = 5;

export type RecipeBaselineSearchFields = {
  menu_item_name: string;
  linkedInventoryItems?: readonly string[] | null;
  ingredients?: readonly { itemName: string }[] | null;
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

function recipeBaselineExtraSearchText(item: RecipeBaselineSearchFields): string {
  const linked = item.linkedInventoryItems ?? [];
  const ingredientNames = (item.ingredients ?? []).map((ingredient) => ingredient.itemName);
  return [...linked, ...ingredientNames].filter(Boolean).join(" ");
}

function scoreRecipeBaselineMatch(item: RecipeBaselineSearchFields, query: string): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const dishKey = normalizeSearchKey(item.menu_item_name);
  const extraKey = normalizeSearchKey(recipeBaselineExtraSearchText(item));
  if (!dishKey && !extraKey) return null;

  if (dishKey === normalizedQuery) return 1000;

  let score = 0;
  if (dishKey.startsWith(normalizedQuery)) score = 800;
  else if (dishKey.includes(normalizedQuery)) score = 600;

  if (extraKey === normalizedQuery) score = Math.max(score, 900);
  else if (extraKey.startsWith(normalizedQuery)) score = Math.max(score, 700);
  else if (extraKey.includes(normalizedQuery)) score = Math.max(score, 500);

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const haystack = `${dishKey} ${extraKey}`.trim();
    const allTokensPresent = tokens.every((token) => haystack.includes(token));
    if (allTokensPresent) score = Math.max(score, 650);
    else if (score <= 0) return null;
  }

  return score > 0 ? score : null;
}

/**
 * Rank mapped recipe baselines for Settings → Recipes dish find.
 * Empty query preserves caller order. Non-empty query matches dish or ingredient names.
 */
export function filterRecipeBaselineItemsBySearch<T extends RecipeBaselineSearchFields>(
  items: readonly T[],
  query: string
): T[] {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return [...items];

  return items
    .map((item, index) => {
      const score = scoreRecipeBaselineMatch(item, query);
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
