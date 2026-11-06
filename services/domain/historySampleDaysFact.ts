import type { InventoryPrediction } from "../../types/mise";

/**
 * Deterministic history-sample-days fact for inventory recommendations.
 *
 * Operators already see sample-day counts buried in basis prose
 * ("Based on N recent service days"). This fact exposes the same restaurant
 * demand-memory sample count as a scannable number beside coverage — only when
 * Mise actually has restaurant_history evidence and the projection is not
 * contaminated. Demo fallback, current-day-only, still-learning, and
 * contaminated projections stay null rather than inventing a sample count.
 *
 * The value matches `InventoryPrediction.historySampleDays` whenever that
 * field is an eligible restaurant-history sample count, so forecast-confidence
 * and basis copy that read the raw sample days stay coherent with the detail
 * fact. This is an explainable evidence count — not a fitted model.
 */
export function computeHistorySampleDaysFact(input: {
  contaminatedProjection: boolean;
  historySource: InventoryPrediction["historySource"];
  historySampleDays: number;
}): number | null {
  if (input.contaminatedProjection) {
    return null;
  }
  if (input.historySource !== "restaurant_history") {
    return null;
  }
  if (!(input.historySampleDays > 0)) {
    return null;
  }
  if (!Number.isFinite(input.historySampleDays)) {
    return null;
  }

  return Math.floor(input.historySampleDays);
}
