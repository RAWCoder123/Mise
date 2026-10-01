/**
 * Ranked find for supplier order drafts / sent / history lanes.
 * Never invents orders; only filters the caller-supplied lane list.
 */

export const SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD = 5;

export type SupplierOrderSearchFields = {
  id: string;
  supplier_name: string;
  order_message?: string | null;
  operator_note?: string | null;
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

function scoreSupplierOrderMatch(
  order: SupplierOrderSearchFields,
  query: string
): number | null {
  const supplierScore = scoreTextMatch(order.supplier_name, query);
  const messageScore = scoreTextMatch(order.order_message ?? "", query);
  const noteScore = scoreTextMatch(order.operator_note ?? "", query);
  if (supplierScore == null && messageScore == null && noteScore == null) return null;
  // Prefer supplier-name hits over message/note hits when scores tie-break via Math.max.
  return Math.max(supplierScore ?? 0, messageScore ?? 0, noteScore ?? 0);
}

/**
 * Rank supplier orders for drafts / sent / history lane find.
 * Empty query preserves caller order. Non-empty query matches supplier, message, or note.
 */
export function filterSupplierOrdersBySearch<T extends SupplierOrderSearchFields>(
  orders: readonly T[],
  query: string
): T[] {
  const normalizedQuery = normalizeSearchKey(query);
  if (!normalizedQuery) return [...orders];

  return orders
    .map((order, index) => {
      const score = scoreSupplierOrderMatch(order, query);
      if (score == null) return null;
      return { order, score, index };
    })
    .filter((match): match is { order: T; score: number; index: number } => match != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .map((match) => match.order);
}
