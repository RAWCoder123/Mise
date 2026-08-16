import type { RecommendationSourceEvidence } from "../types/mise";

export function blockedRecommendationEvidence(
  _inventoryItemId: string,
  generatedAt = "2026-01-01T00:00:00.000Z"
): RecommendationSourceEvidence {
  return {
    version: 1,
    mode: "legacy",
    countEvent: null,
    salesThrough: null,
    posLocationId: null,
    mappingIds: [],
    recipeVersionIds: [],
    planningRevision: null,
    generatedAt,
    correlationId: "00000000-0000-0000-0000-000000000000"
  };
}
