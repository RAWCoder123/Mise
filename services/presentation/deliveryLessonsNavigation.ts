/**
 * Shared deep-link for measured supplier-delivery lessons.
 * Insights and Daily Report surface reliability attention; this route is where
 * operators review append-only receive outcomes (distinct from Restaurant Memory).
 */
export const DELIVERY_LESSONS_REVIEW_HREF = "/more/delivery-outcomes" as const;

export function resolveDeliveryLessonsReviewHref(): typeof DELIVERY_LESSONS_REVIEW_HREF {
  return DELIVERY_LESSONS_REVIEW_HREF;
}

/** Offer the CTA only when attention outcomes were measured (not on load failure). */
export function shouldOfferDeliveryLessonsReview(attentionCount: number | null | undefined): boolean {
  return typeof attentionCount === "number" && Number.isFinite(attentionCount) && attentionCount > 0;
}
