/**
 * Shared deep-link for reviewing actionable restaurant memories.
 * Insights and Daily Report surface learning summaries; this route is where
 * managers confirm, correct, or dismiss the underlying memory statements.
 */
export const RESTAURANT_MEMORY_REVIEW_HREF = "/more/restaurant-memory" as const;

export function resolveLearningMemoryReviewHref(): typeof RESTAURANT_MEMORY_REVIEW_HREF {
  return RESTAURANT_MEMORY_REVIEW_HREF;
}
