export type RecommendationQuantityDeltaBucket =
  | "unchanged"
  | "decreased"
  | "increased";

export interface RecommendationDecisionTelemetry {
  quantity_edited: boolean;
  quantity_delta_bucket: RecommendationQuantityDeltaBucket;
  dismiss_reason_present?: boolean;
}

/**
 * Scrubbed analytics for recommendation decisions.
 * Never emit raw accepted/original quantities — only edit direction buckets.
 */
export function buildRecommendationDecisionTelemetry(input: {
  originalQuantity?: number | null;
  acceptedQuantity?: number | null;
  dismissReasonPresent?: boolean;
}): RecommendationDecisionTelemetry {
  const original =
    typeof input.originalQuantity === "number" && Number.isFinite(input.originalQuantity)
      ? input.originalQuantity
      : null;
  const accepted =
    typeof input.acceptedQuantity === "number" && Number.isFinite(input.acceptedQuantity)
      ? input.acceptedQuantity
      : null;

  let quantity_edited = false;
  let quantity_delta_bucket: RecommendationQuantityDeltaBucket = "unchanged";

  if (original != null && accepted != null && original > 0) {
    const delta = accepted - original;
    if (Math.abs(delta) > 1e-9) {
      quantity_edited = true;
      quantity_delta_bucket = delta < 0 ? "decreased" : "increased";
    }
  }

  const telemetry: RecommendationDecisionTelemetry = {
    quantity_edited,
    quantity_delta_bucket
  };
  if (input.dismissReasonPresent !== undefined) {
    telemetry.dismiss_reason_present = Boolean(input.dismissReasonPresent);
  }
  return telemetry;
}
