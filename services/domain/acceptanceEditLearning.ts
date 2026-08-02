/**
 * Explainable acceptance-edit learning from purchase recommendation decisions.
 * When managers chronically accept a different quantity than Mise originally
 * recommended, pad or trim future suggestions using the median accepted/original
 * ratio. Hard sample/window/multiplier bounds keep one abnormal approve from
 * distorting the restaurant model.
 */

export const ACCEPTANCE_EDIT_LEARNING_WINDOW_DAYS = 180;
export const ACCEPTANCE_EDIT_LEARNING_MAX_SAMPLES = 8;
export const ACCEPTANCE_EDIT_LEARNING_MIN_SAMPLES = 3;
/** Median accepted/original at or above this (after winsorize) counts as chronic increase. */
export const ACCEPTANCE_EDIT_CHRONIC_HIGH = 1.08;
/** Median accepted/original at or below this (after winsorize) counts as chronic decrease. */
export const ACCEPTANCE_EDIT_CHRONIC_LOW = 0.92;
export const ACCEPTANCE_EDIT_MIN_DIRECTION_COUNT = 3;
export const ACCEPTANCE_EDIT_WINSORIZE_MIN = 0.5;
export const ACCEPTANCE_EDIT_WINSORIZE_MAX = 1.5;
export const ACCEPTANCE_EDIT_MULTIPLIER_MAX = 1.25;
export const ACCEPTANCE_EDIT_MULTIPLIER_MIN = 0.8;

export type AcceptanceEditSample = {
  inventoryItemId: string;
  originalQuantity: number;
  acceptedQuantity: number;
  createdAt: string;
  unit?: string;
};

export type AcceptanceEditBias = {
  inventoryItemId: string;
  sampleCount: number;
  editCount: number;
  medianRatio: number;
  multiplier: number;
  isChronic: boolean;
  direction: "increase" | "decrease";
};

export type RecommendationAcceptanceSnippet = {
  inventory_item_id: string;
  recommended_quantity: number;
  original_recommended_quantity?: number | null;
  status: string;
  created_at: string;
  unit?: string;
};

export function extractAcceptanceEditSamplesFromRecommendations(
  history: readonly RecommendationAcceptanceSnippet[]
): AcceptanceEditSample[] {
  const samples: AcceptanceEditSample[] = [];
  for (const recommendation of history) {
    if (recommendation.status !== "approved" && recommendation.status !== "ordered") continue;
    const original = finiteNumber(recommendation.original_recommended_quantity);
    const accepted = finiteNumber(recommendation.recommended_quantity);
    if (original == null || accepted == null) continue;
    if (!(original > 0) || !(accepted > 0)) continue;
    const createdAt =
      typeof recommendation.created_at === "string" && recommendation.created_at.trim()
        ? recommendation.created_at
        : "";
    if (!createdAt) continue;
    samples.push({
      inventoryItemId: recommendation.inventory_item_id,
      originalQuantity: original,
      acceptedQuantity: accepted,
      createdAt,
      unit: typeof recommendation.unit === "string" ? recommendation.unit : undefined
    });
  }
  return samples;
}

export function buildAcceptanceEditBiasByItem(
  samples: readonly AcceptanceEditSample[],
  nowMs = Date.now()
): Map<string, AcceptanceEditBias> {
  const byItem = new Map<string, AcceptanceEditSample[]>();
  const oldest = nowMs - ACCEPTANCE_EDIT_LEARNING_WINDOW_DAYS * 86_400_000;
  const newest = nowMs + 86_400_000;

  for (const sample of samples.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const timestamp = Date.parse(sample.createdAt);
    if (!Number.isFinite(timestamp) || timestamp < oldest || timestamp > newest) continue;
    if (!(sample.originalQuantity > 0) || !(sample.acceptedQuantity > 0)) continue;
    if (!Number.isFinite(sample.originalQuantity) || !Number.isFinite(sample.acceptedQuantity)) {
      continue;
    }
    const list = byItem.get(sample.inventoryItemId) ?? [];
    if (list.length >= ACCEPTANCE_EDIT_LEARNING_MAX_SAMPLES) continue;
    list.push(sample);
    byItem.set(sample.inventoryItemId, list);
  }

  const result = new Map<string, AcceptanceEditBias>();
  for (const [inventoryItemId, itemSamples] of byItem) {
    if (itemSamples.length < ACCEPTANCE_EDIT_LEARNING_MIN_SAMPLES) continue;
    const ratios = itemSamples.map((sample) =>
      clamp(
        sample.acceptedQuantity / sample.originalQuantity,
        ACCEPTANCE_EDIT_WINSORIZE_MIN,
        ACCEPTANCE_EDIT_WINSORIZE_MAX
      )
    );
    const medianRatio = median(ratios);
    const increaseCount = itemSamples.filter(
      (sample) => sample.acceptedQuantity > sample.originalQuantity + 1e-9
    ).length;
    const decreaseCount = itemSamples.filter(
      (sample) => sample.acceptedQuantity < sample.originalQuantity - 1e-9
    ).length;
    const chronicIncrease =
      medianRatio >= ACCEPTANCE_EDIT_CHRONIC_HIGH &&
      increaseCount >= ACCEPTANCE_EDIT_MIN_DIRECTION_COUNT;
    const chronicDecrease =
      medianRatio <= ACCEPTANCE_EDIT_CHRONIC_LOW &&
      decreaseCount >= ACCEPTANCE_EDIT_MIN_DIRECTION_COUNT;
    if (!chronicIncrease && !chronicDecrease) continue;
    const direction: AcceptanceEditBias["direction"] = chronicIncrease ? "increase" : "decrease";
    const multiplier = clamp(
      medianRatio,
      ACCEPTANCE_EDIT_MULTIPLIER_MIN,
      ACCEPTANCE_EDIT_MULTIPLIER_MAX
    );
    result.set(inventoryItemId, {
      inventoryItemId,
      sampleCount: itemSamples.length,
      editCount: chronicIncrease ? increaseCount : decreaseCount,
      medianRatio,
      multiplier,
      isChronic: true,
      direction
    });
  }
  return result;
}

/**
 * Adjust a base recommended quantity for chronic acceptance edits, then re-apply
 * the same absolute bounds used by other learning layers.
 */
export function applyAcceptanceEditBias(
  baseQuantity: number,
  bias: AcceptanceEditBias | undefined,
  bounds: { calculated: number; par: number }
): number | undefined {
  if (!bias?.isChronic || !(bias.multiplier > 0) || Math.abs(bias.multiplier - 1) < 1e-9) {
    return undefined;
  }
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) return undefined;
  const adjusted = Math.max(1, Math.ceil(baseQuantity * bias.multiplier));
  const calculated = Math.max(1, bounds.calculated);
  const minimum = Math.max(1, calculated * 0.5);
  const maximum = Math.max(calculated * 1.75, Math.max(0, bounds.par) * 1.25, 1);
  const bounded = clamp(adjusted, minimum, maximum);
  if (Math.abs(bounded - baseQuantity) < 1e-9) return undefined;
  return Math.max(1, Math.ceil(bounded));
}

export function acceptanceEditBiasReasonFragment(bias: AcceptanceEditBias): string {
  const acceptPercent = Math.round(bias.medianRatio * 100);
  if (bias.direction === "increase") {
    return `Mise is padding for a stable acceptance-edit pattern: managers recently approved about ${acceptPercent}% of the original suggestion (median of ${bias.sampleCount} decisions).`;
  }
  return `Mise is trimming for a stable acceptance-edit pattern: managers recently approved about ${acceptPercent}% of the original suggestion (median of ${bias.sampleCount} decisions).`;
}

export function buildChronicAcceptanceEditInsightInput(bias: AcceptanceEditBias): {
  insightType: "ordering";
  severity: "warning";
  acceptPercent: number;
  direction: "increase" | "decrease";
} | null {
  if (!bias.isChronic) return null;
  return {
    insightType: "ordering",
    severity: "warning",
    acceptPercent: Math.round(bias.medianRatio * 100),
    direction: bias.direction
  };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return 1;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
