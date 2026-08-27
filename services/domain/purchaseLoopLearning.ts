/**
 * Bounded purchase-loop count-variance learning.
 *
 * Uses append-only count-phase `mise.purchase_loop_outcome.v1` evidence to pad
 * recommendation quantities when post-receive counts chronically fall short of
 * system quantity. Never invents inventory facts, never suppresses items, and
 * never changes purchase authority.
 */

import {
  PURCHASE_LOOP_COUNT_PHASE,
  PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION
} from "./purchaseLoopOutcome.ts";

export const PURCHASE_LOOP_COUNT_LEARNING_WINDOW_DAYS = 180;
export const PURCHASE_LOOP_COUNT_LEARNING_MAX_SAMPLES = 8;
export const PURCHASE_LOOP_COUNT_LEARNING_MIN_SAMPLES = 3;
/** Median counted/system ratio at or below this (after winsorize) counts as chronic short. */
export const PURCHASE_LOOP_COUNT_CHRONIC_THRESHOLD = 0.92;
export const PURCHASE_LOOP_COUNT_MIN_SHORT_COUNT = 3;
export const PURCHASE_LOOP_COUNT_WINSORIZE_MIN = 0.25;
export const PURCHASE_LOOP_COUNT_WINSORIZE_MAX = 1;
export const PURCHASE_LOOP_COUNT_MULTIPLIER_MAX = 1.25;

export type PurchaseLoopCountSample = {
  inventoryItemId: string;
  systemQuantityAtStart: number;
  countedQuantity: number;
  varianceFromSystem: number;
  measuredAt: string;
  countSessionId?: string | null;
  supplierOrderId?: string | null;
};

export type PurchaseLoopCountBias = {
  inventoryItemId: string;
  sampleCount: number;
  shortCount: number;
  medianCountRatio: number;
  multiplier: number;
  isChronic: boolean;
};

export type PurchaseLoopCountOutcomeSnippet = {
  id: string;
  restaurantId: string;
  measuredAt: string;
  actualResult: Record<string, unknown>;
};

/**
 * Flattens count-phase purchase-loop outcome lines into learning samples.
 * Ignores receive-phase rows and malformed payloads.
 */
export function extractPurchaseLoopCountSamples(
  outcomes: readonly PurchaseLoopCountOutcomeSnippet[],
  restaurantId: string
): PurchaseLoopCountSample[] {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) return [];

  const samples: PurchaseLoopCountSample[] = [];
  for (const outcome of outcomes) {
    if (outcome.restaurantId !== normalizedRestaurantId) continue;
    const measuredAt =
      typeof outcome.measuredAt === "string" && outcome.measuredAt.trim()
        ? outcome.measuredAt.trim()
        : "";
    if (!measuredAt) continue;
    const actual = outcome.actualResult ?? {};
    if (actual.evidenceVersion !== PURCHASE_LOOP_OUTCOME_EVIDENCE_VERSION) continue;
    if (actual.phase !== PURCHASE_LOOP_COUNT_PHASE) continue;
    const countSessionId = optionalString(actual.countSessionId);
    const lines = Array.isArray(actual.lines) ? actual.lines : [];
    for (const rawLine of lines) {
      if (!rawLine || typeof rawLine !== "object") continue;
      const line = rawLine as Record<string, unknown>;
      const inventoryItemId = optionalString(line.inventoryItemId);
      if (!inventoryItemId) continue;
      const systemQuantityAtStart = finiteNumber(line.systemQuantityAtStart);
      const countedQuantity = finiteNumber(line.countedQuantity);
      if (
        systemQuantityAtStart == null ||
        countedQuantity == null ||
        systemQuantityAtStart <= 0 ||
        countedQuantity < 0
      ) {
        continue;
      }
      const varianceFromSystem =
        finiteNumber(line.varianceFromSystem) ??
        countedQuantity - systemQuantityAtStart;
      samples.push({
        inventoryItemId,
        systemQuantityAtStart,
        countedQuantity,
        varianceFromSystem,
        measuredAt,
        countSessionId,
        supplierOrderId: optionalString(line.supplierOrderId)
      });
    }
  }
  return samples;
}

/**
 * Builds per-item chronic undercount bias from count-phase samples.
 * Requires enough recent short samples before any multiplier > 1 is applied.
 */
export function buildPurchaseLoopCountBiasByItem(
  samples: readonly PurchaseLoopCountSample[],
  nowMs = Date.now()
): Map<string, PurchaseLoopCountBias> {
  const byItem = new Map<string, PurchaseLoopCountSample[]>();
  const oldest = nowMs - PURCHASE_LOOP_COUNT_LEARNING_WINDOW_DAYS * 86_400_000;
  const newest = nowMs + 86_400_000;

  for (const sample of samples.slice().sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))) {
    const timestamp = Date.parse(sample.measuredAt);
    if (!Number.isFinite(timestamp) || timestamp < oldest || timestamp > newest) continue;
    if (!(sample.systemQuantityAtStart > 0) || !(sample.countedQuantity >= 0)) continue;
    if (!Number.isFinite(sample.systemQuantityAtStart) || !Number.isFinite(sample.countedQuantity)) {
      continue;
    }
    const inventoryItemId = sample.inventoryItemId.trim();
    if (!inventoryItemId) continue;
    const list = byItem.get(inventoryItemId) ?? [];
    if (list.length >= PURCHASE_LOOP_COUNT_LEARNING_MAX_SAMPLES) continue;
    list.push(sample);
    byItem.set(inventoryItemId, list);
  }

  const result = new Map<string, PurchaseLoopCountBias>();
  for (const [inventoryItemId, itemSamples] of byItem) {
    if (itemSamples.length < PURCHASE_LOOP_COUNT_LEARNING_MIN_SAMPLES) continue;
    const ratios = itemSamples.map((sample) =>
      clamp(
        sample.countedQuantity / sample.systemQuantityAtStart,
        PURCHASE_LOOP_COUNT_WINSORIZE_MIN,
        PURCHASE_LOOP_COUNT_WINSORIZE_MAX
      )
    );
    const medianCountRatio = median(ratios);
    const shortCount = itemSamples.filter(
      (sample) =>
        sample.varianceFromSystem < -0.000001 ||
        sample.countedQuantity < sample.systemQuantityAtStart
    ).length;
    const isChronic =
      medianCountRatio <= PURCHASE_LOOP_COUNT_CHRONIC_THRESHOLD &&
      shortCount >= PURCHASE_LOOP_COUNT_MIN_SHORT_COUNT;
    const multiplier = isChronic
      ? clamp(1 / medianCountRatio, 1, PURCHASE_LOOP_COUNT_MULTIPLIER_MAX)
      : 1;
    result.set(inventoryItemId, {
      inventoryItemId,
      sampleCount: itemSamples.length,
      shortCount,
      medianCountRatio,
      multiplier,
      isChronic
    });
  }
  return result;
}

/**
 * Inflate a base recommended quantity for chronic post-receive undercounts, then
 * re-apply the same absolute bounds used by approval-median learning.
 */
export function applyPurchaseLoopCountBias(
  baseQuantity: number,
  bias: PurchaseLoopCountBias | undefined,
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

export function purchaseLoopCountBiasReasonFragment(bias: PurchaseLoopCountBias): string {
  const countPercent = Math.round(bias.medianCountRatio * 100);
  return `Mise is padding for a stable post-receive count shortfall: recent counts averaged ~${countPercent}% of system quantity (median of ${bias.sampleCount} purchase-loop counts).`;
}

export function buildChronicCountShortInsightInput(bias: PurchaseLoopCountBias): {
  insightType: "ordering";
  severity: "warning";
  countPercent: number;
} | null {
  if (!bias.isChronic) return null;
  return {
    insightType: "ordering",
    severity: "warning",
    countPercent: Math.round(bias.medianCountRatio * 100)
  };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
