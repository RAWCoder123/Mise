import type { InventoryPrediction } from "../../types/mise";

/**
 * Deterministic forecast confidence for inventory recommendations.
 *
 * Combines demand-history evidence and verified-count freshness into a 0–1
 * score operators can scan beside coverage. Contaminated projections stay
 * null rather than inventing confidence. The ceiling is 0.92 so Mise never
 * claims certainty from rule-based evidence alone.
 *
 * This is an explainable evidence mix — not a fitted statistical model —
 * and deliberately omits urgency boosts (Critical/Low) so confidence stays
 * distinct from "how soon should I act."
 */
export const FORECAST_CONFIDENCE_CEILING = 0.92;

export function computeForecastConfidence(input: {
  contaminatedProjection: boolean;
  historySource: InventoryPrediction["historySource"];
  historySampleDays: number;
  countAgeHours: number | null;
  isTemporallyAuthoritative: boolean;
}): number | null {
  if (input.contaminatedProjection) {
    return null;
  }

  let score = 0.25;
  if (input.historySource === "restaurant_history") {
    const sampleDays = Math.max(0, input.historySampleDays);
    // Strong restaurant memory can contribute enough to reach the ceiling when
    // paired with a fresh temporally authoritative count — without borrowing
    // urgency or "has any sales" boosts that would confuse confidence with risk.
    score += Math.min(0.37, 0.12 + sampleDays * 0.02);
  } else if (input.historySource === "demo_fallback") {
    score += 0.12;
  } else if (input.historySource === "current_day") {
    score += 0.1;
  }

  if (input.countAgeHours !== null && input.countAgeHours <= 24) {
    score += 0.2;
  } else if (input.countAgeHours !== null && input.countAgeHours <= 72) {
    score += 0.1;
  }

  if (input.isTemporallyAuthoritative) {
    score += 0.1;
  }

  return Math.round(Math.min(FORECAST_CONFIDENCE_CEILING, score) * 100) / 100;
}
