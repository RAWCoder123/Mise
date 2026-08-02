/**
 * Explainable waste and count-shrink learning from inventory ledger history.
 * Pads order quantities when recent waste or negative count variance is chronic,
 * with hard sample/window/multiplier bounds so one abnormal event cannot distort Mise.
 */

export const LOSS_LEARNING_WINDOW_DAYS = 180;
export const LOSS_LEARNING_MAX_SAMPLES = 8;
export const LOSS_LEARNING_MIN_SAMPLES = 3;
/** Median loss ratio at or above this (after winsorize) counts as chronic. */
export const LOSS_CHRONIC_THRESHOLD = 0.08;
export const LOSS_WINSORIZE_MIN = 0;
export const LOSS_WINSORIZE_MAX = 0.35;
export const LOSS_MULTIPLIER_MAX = 1.2;

export type WasteSample = {
  inventoryItemId: string;
  quantityRemoved: number;
  quantityBefore: number;
  createdAt: string;
};

export type CountVarianceSample = {
  inventoryItemId: string;
  quantityBefore: number;
  quantityAfter: number;
  variance: number;
  createdAt: string;
  sessionId?: string | null;
};

export type LossBias = {
  inventoryItemId: string;
  sampleCount: number;
  medianLossRatio: number;
  multiplier: number;
  isChronic: boolean;
  source: "waste" | "count_variance" | "manager_correction";
};

export type InventoryMovementLossSnippet = {
  inventory_item_id: string;
  reason: string;
  created_at: string;
  quantity_before?: number | null;
  quantity_after?: number | null;
  metadata?: Record<string, unknown> | null;
};

export function extractWasteSamplesFromMovements(
  movements: readonly InventoryMovementLossSnippet[]
): WasteSample[] {
  const samples: WasteSample[] = [];
  for (const movement of movements) {
    if (movement.reason !== "waste") continue;
    const metadata = movement.metadata && typeof movement.metadata === "object" ? movement.metadata : null;
    const quantityRemoved =
      finiteNumber(metadata?.quantity_removed_applied) ??
      (() => {
        const before = finiteNumber(movement.quantity_before);
        const after = finiteNumber(movement.quantity_after);
        if (before == null || after == null || after > before) return null;
        return before - after;
      })();
    const quantityBefore =
      finiteNumber(movement.quantity_before) ??
      (quantityRemoved != null && finiteNumber(movement.quantity_after) != null
        ? finiteNumber(movement.quantity_after)! + quantityRemoved
        : null);
    if (quantityRemoved == null || quantityBefore == null) continue;
    if (!(quantityRemoved > 0) || !(quantityBefore > 0)) continue;
    const createdAt =
      typeof movement.created_at === "string" && movement.created_at.trim()
        ? movement.created_at
        : "";
    if (!createdAt) continue;
    samples.push({
      inventoryItemId: movement.inventory_item_id,
      quantityRemoved,
      quantityBefore,
      createdAt
    });
  }
  return samples;
}

export function extractCountVarianceSamplesFromMovements(
  movements: readonly InventoryMovementLossSnippet[]
): CountVarianceSample[] {
  const samples: CountVarianceSample[] = [];
  for (const movement of movements) {
    if (movement.reason !== "manual_count") continue;
    const quantityBefore = finiteNumber(movement.quantity_before);
    const quantityAfter = finiteNumber(movement.quantity_after);
    if (quantityBefore == null || quantityAfter == null) continue;
    if (!(quantityBefore > 0)) continue;
    const metadata = movement.metadata && typeof movement.metadata === "object" ? movement.metadata : null;
    const variance =
      finiteNumber(metadata?.variance_from_system) ?? quantityAfter - quantityBefore;
    // Learning cares about shrink (negative variance). Zero/positive counts are ignored.
    if (!(variance < 0)) continue;
    const createdAt =
      typeof movement.created_at === "string" && movement.created_at.trim()
        ? movement.created_at
        : "";
    if (!createdAt) continue;
    const sessionId =
      typeof metadata?.session_id === "string" && metadata.session_id.trim()
        ? metadata.session_id.trim()
        : null;
    samples.push({
      inventoryItemId: movement.inventory_item_id,
      quantityBefore,
      quantityAfter,
      variance,
      createdAt,
      sessionId
    });
  }
  return samples;
}

export function buildWasteBiasByItem(
  samples: readonly WasteSample[],
  nowMs = Date.now()
): Map<string, LossBias> {
  return buildLossBiasByItem(
    samples.map((sample) => ({
      inventoryItemId: sample.inventoryItemId,
      lossAmount: sample.quantityRemoved,
      baseline: sample.quantityBefore,
      createdAt: sample.createdAt
    })),
    "waste",
    nowMs
  );
}

export function buildCountShrinkBiasByItem(
  samples: readonly CountVarianceSample[],
  nowMs = Date.now()
): Map<string, LossBias> {
  return buildLossBiasByItem(
    samples.map((sample) => ({
      inventoryItemId: sample.inventoryItemId,
      lossAmount: Math.max(0, -sample.variance),
      baseline: sample.quantityBefore,
      createdAt: sample.createdAt
    })),
    "count_variance",
    nowMs
  );
}

export function extractManagerCorrectionSamplesFromMovements(
  movements: readonly InventoryMovementLossSnippet[]
): CountVarianceSample[] {
  const samples: CountVarianceSample[] = [];
  for (const movement of movements) {
    if (movement.reason !== "manager_correction") continue;
    const quantityBefore = finiteNumber(movement.quantity_before);
    const quantityAfter = finiteNumber(movement.quantity_after);
    if (quantityBefore == null || quantityAfter == null) continue;
    if (!(quantityBefore > 0)) continue;
    const variance = quantityAfter - quantityBefore;
    // Learning cares about downward manager corrections (system was high).
    if (!(variance < 0)) continue;
    const createdAt =
      typeof movement.created_at === "string" && movement.created_at.trim()
        ? movement.created_at
        : "";
    if (!createdAt) continue;
    samples.push({
      inventoryItemId: movement.inventory_item_id,
      quantityBefore,
      quantityAfter,
      variance,
      createdAt
    });
  }
  return samples;
}

export function buildManagerCorrectionBiasByItem(
  samples: readonly CountVarianceSample[],
  nowMs = Date.now()
): Map<string, LossBias> {
  return buildLossBiasByItem(
    samples.map((sample) => ({
      inventoryItemId: sample.inventoryItemId,
      lossAmount: Math.max(0, -sample.variance),
      baseline: sample.quantityBefore,
      createdAt: sample.createdAt
    })),
    "manager_correction",
    nowMs
  );
}

/**
 * Inflate a base recommended quantity for chronic waste/shrink, then re-apply the
 * same absolute bounds used by other learning layers so stacked learning cannot explode.
 */
export function applyLossBias(
  baseQuantity: number,
  bias: LossBias | undefined,
  bounds: { calculated: number; par: number }
): number | undefined {
  if (!bias?.isChronic || bias.multiplier <= 1) return undefined;
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) return undefined;
  const inflated = Math.max(1, Math.ceil(baseQuantity * bias.multiplier));
  const calculated = Math.max(1, bounds.calculated);
  const minimum = Math.max(1, calculated * 0.5);
  const maximum = Math.max(calculated * 1.75, Math.max(0, bounds.par) * 1.25, 1);
  const bounded = clamp(inflated, minimum, maximum);
  return Math.max(1, Math.ceil(bounded));
}

export function lossBiasReasonFragment(bias: LossBias): string {
  const lossPercent = Math.round(bias.medianLossRatio * 100);
  if (bias.source === "waste") {
    return `Mise is padding for a stable waste pattern: recent waste averaged ~${lossPercent}% of on-hand (median of ${bias.sampleCount} records).`;
  }
  if (bias.source === "manager_correction") {
    return `Mise is padding for a stable manager correction pattern: recent corrections averaged ~${lossPercent}% below system (median of ${bias.sampleCount} edits).`;
  }
  return `Mise is padding for a stable count shrink pattern: recent counts averaged ~${lossPercent}% below system (median of ${bias.sampleCount} counts).`;
}

export function buildChronicWasteInsightInput(bias: LossBias): {
  insightType: "waste";
  severity: "warning";
  lossPercent: number;
} | null {
  if (!bias.isChronic || bias.source !== "waste") return null;
  return {
    insightType: "waste",
    severity: "warning",
    lossPercent: Math.round(bias.medianLossRatio * 100)
  };
}

export function buildChronicCountShrinkInsightInput(bias: LossBias): {
  insightType: "inventory";
  severity: "warning";
  lossPercent: number;
} | null {
  if (!bias.isChronic || bias.source !== "count_variance") return null;
  return {
    insightType: "inventory",
    severity: "warning",
    lossPercent: Math.round(bias.medianLossRatio * 100)
  };
}

export function buildChronicManagerCorrectionInsightInput(bias: LossBias): {
  insightType: "inventory";
  severity: "warning";
  lossPercent: number;
} | null {
  if (!bias.isChronic || bias.source !== "manager_correction") return null;
  return {
    insightType: "inventory",
    severity: "warning",
    lossPercent: Math.round(bias.medianLossRatio * 100)
  };
}

type InternalLossSample = {
  inventoryItemId: string;
  lossAmount: number;
  baseline: number;
  createdAt: string;
};

function buildLossBiasByItem(
  samples: readonly InternalLossSample[],
  source: LossBias["source"],
  nowMs: number
): Map<string, LossBias> {
  const byItem = new Map<string, InternalLossSample[]>();
  const oldest = nowMs - LOSS_LEARNING_WINDOW_DAYS * 86_400_000;
  const newest = nowMs + 86_400_000;

  for (const sample of samples.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const timestamp = Date.parse(sample.createdAt);
    if (!Number.isFinite(timestamp) || timestamp < oldest || timestamp > newest) continue;
    if (!(sample.lossAmount > 0) || !(sample.baseline > 0)) continue;
    if (!Number.isFinite(sample.lossAmount) || !Number.isFinite(sample.baseline)) continue;
    const list = byItem.get(sample.inventoryItemId) ?? [];
    if (list.length >= LOSS_LEARNING_MAX_SAMPLES) continue;
    list.push(sample);
    byItem.set(sample.inventoryItemId, list);
  }

  const result = new Map<string, LossBias>();
  for (const [inventoryItemId, itemSamples] of byItem) {
    if (itemSamples.length < LOSS_LEARNING_MIN_SAMPLES) continue;
    const ratios = itemSamples.map((sample) =>
      clamp(sample.lossAmount / sample.baseline, LOSS_WINSORIZE_MIN, LOSS_WINSORIZE_MAX)
    );
    const medianLossRatio = median(ratios);
    const isChronic = medianLossRatio >= LOSS_CHRONIC_THRESHOLD;
    const multiplier = isChronic
      ? clamp(1 + medianLossRatio, 1, LOSS_MULTIPLIER_MAX)
      : 1;
    result.set(inventoryItemId, {
      inventoryItemId,
      sampleCount: itemSamples.length,
      medianLossRatio,
      multiplier,
      isChronic,
      source
    });
  }
  return result;
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
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
