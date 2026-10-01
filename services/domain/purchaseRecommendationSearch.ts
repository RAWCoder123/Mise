/**
 * Ranked find for the Orders review recommendation lane.
 * Never invents recommendations; only filters the caller-supplied pending list.
 * Quantity drafts for filtered-out rows must remain in the caller's draft state.
 */

export const PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD = 5;

export type PurchaseRecommendationSearchFields = {
  id: string;
  item_name: string;
  supplier_name: string;
  reason?: string | null;
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

function scoreTextMatch(haystack: string, query: string): number | null {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return 0;

  const key = normalizeSearchKey(haystack);
  if (!key) return null;

  if (key === normalizedQuery) return 1000;

  let score = 0;
  if (key.startsWith(normalizedQuery)) score = 800;
  else if (key.includes(normalizedQuery)) score = 600;

  const tokens = tokenize(query);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) => key.includes(token));
    if (allTokensPresent) score = Math.max(score, 700);
  }

  return score > 0 ? score : null;
}

function scoreRecommendationMatch(
  recommendation: PurchaseRecommendationSearchFields,
  query: string
): number | null {
  const itemScore = scoreTextMatch(recommendation.item_name, query);
  const supplierScore = scoreTextMatch(recommendation.supplier_name, query);
  const reasonScore = scoreTextMatch(recommendation.reason ?? "", query);
  const unitScore = scoreTextMatch(recommendation.unit ?? "", query);
  if (
    itemScore == null &&
    supplierScore == null &&
    reasonScore == null &&
    unitScore == null
  ) {
    return null;
  }
  // Prefer item-name hits, then supplier, then reason/unit.
  return Math.max(
    itemScore != null ? itemScore + 40 : 0,
    supplierScore != null ? supplierScore + 20 : 0,
    reasonScore ?? 0,
    unitScore != null ? Math.min(unitScore, 250) : 0
  );
}

/**
 * Rank pending purchase recommendations for the Orders review lane.
 * Empty query preserves caller order. Non-empty query matches item, supplier,
 * reason, or unit without inventing rows or clearing draft quantities.
 */
export function filterPurchaseRecommendationsBySearch<
  T extends PurchaseRecommendationSearchFields
>(recommendations: readonly T[], query: string): T[] {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return [...recommendations];

  return recommendations
    .map((recommendation, index) => {
      const score = scoreRecommendationMatch(recommendation, query);
      if (score == null) return null;
      return { recommendation, score, index };
    })
    .filter(
      (match): match is { recommendation: T; score: number; index: number } =>
        match != null
    )
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.recommendation);
}
