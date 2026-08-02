/**
 * Explainable supplier fill-rate learning from receiving ledger metadata.
 * Pads order quantities when recent receives chronically short-ship, with
 * hard sample/window/multiplier bounds so one bad delivery cannot distort Mise.
 */

export const RECEIVE_FILL_LEARNING_WINDOW_DAYS = 180;
export const RECEIVE_FILL_LEARNING_MAX_SAMPLES = 8;
export const RECEIVE_FILL_LEARNING_MIN_SAMPLES = 3;
/** Median fill at or below this ratio (after winsorize) counts as chronic short-ship. */
export const RECEIVE_FILL_CHRONIC_THRESHOLD = 0.92;
export const RECEIVE_FILL_MIN_SHORT_SHIP_COUNT = 3;
export const RECEIVE_FILL_WINSORIZE_MIN = 0.25;
export const RECEIVE_FILL_WINSORIZE_MAX = 1;
export const RECEIVE_FILL_MULTIPLIER_MAX = 1.25;

export type ReceiveDiscrepancySample = {
  inventoryItemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  discrepancy: number;
  createdAt: string;
  supplierOrderId?: string | null;
};

export type ReceiveFillBias = {
  inventoryItemId: string;
  sampleCount: number;
  shortShipCount: number;
  medianFillRatio: number;
  multiplier: number;
  isChronic: boolean;
};

export type InventoryMovementReceiveSnippet = {
  inventory_item_id: string;
  reason: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export function extractReceiveSamplesFromMovements(
  movements: readonly InventoryMovementReceiveSnippet[]
): ReceiveDiscrepancySample[] {
  const samples: ReceiveDiscrepancySample[] = [];
  for (const movement of movements) {
    if (movement.reason !== "receiving") continue;
    const metadata = movement.metadata && typeof movement.metadata === "object" ? movement.metadata : null;
    if (!metadata) continue;
    const quantityOrdered = finiteNumber(metadata.quantity_ordered);
    const quantityReceived = finiteNumber(metadata.quantity_received);
    if (quantityOrdered == null || quantityReceived == null || quantityOrdered <= 0 || quantityReceived < 0) {
      continue;
    }
    const discrepancy =
      finiteNumber(metadata.discrepancy) ?? quantityReceived - quantityOrdered;
    const createdAt =
      typeof movement.created_at === "string" && movement.created_at.trim()
        ? movement.created_at
        : "";
    if (!createdAt) continue;
    const supplierOrderId =
      typeof metadata.supplier_order_id === "string" && metadata.supplier_order_id.trim()
        ? metadata.supplier_order_id.trim()
        : null;
    samples.push({
      inventoryItemId: movement.inventory_item_id,
      quantityOrdered,
      quantityReceived,
      discrepancy,
      createdAt,
      supplierOrderId
    });
  }
  return samples;
}

export function buildReceiveFillBiasByItem(
  samples: readonly ReceiveDiscrepancySample[],
  nowMs = Date.now()
): Map<string, ReceiveFillBias> {
  const byItem = new Map<string, ReceiveDiscrepancySample[]>();
  const oldest = nowMs - RECEIVE_FILL_LEARNING_WINDOW_DAYS * 86_400_000;
  const newest = nowMs + 86_400_000;

  for (const sample of samples.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const timestamp = Date.parse(sample.createdAt);
    if (!Number.isFinite(timestamp) || timestamp < oldest || timestamp > newest) continue;
    if (!(sample.quantityOrdered > 0) || !(sample.quantityReceived >= 0)) continue;
    if (!Number.isFinite(sample.quantityOrdered) || !Number.isFinite(sample.quantityReceived)) continue;
    const list = byItem.get(sample.inventoryItemId) ?? [];
    if (list.length >= RECEIVE_FILL_LEARNING_MAX_SAMPLES) continue;
    list.push(sample);
    byItem.set(sample.inventoryItemId, list);
  }

  const result = new Map<string, ReceiveFillBias>();
  for (const [inventoryItemId, itemSamples] of byItem) {
    if (itemSamples.length < RECEIVE_FILL_LEARNING_MIN_SAMPLES) continue;
    const fills = itemSamples.map((sample) =>
      clamp(
        sample.quantityReceived / sample.quantityOrdered,
        RECEIVE_FILL_WINSORIZE_MIN,
        RECEIVE_FILL_WINSORIZE_MAX
      )
    );
    const medianFillRatio = median(fills);
    const shortShipCount = itemSamples.filter(
      (sample) => sample.discrepancy < 0 || sample.quantityReceived < sample.quantityOrdered
    ).length;
    const isChronic =
      medianFillRatio <= RECEIVE_FILL_CHRONIC_THRESHOLD &&
      shortShipCount >= RECEIVE_FILL_MIN_SHORT_SHIP_COUNT;
    const multiplier = isChronic
      ? clamp(1 / medianFillRatio, 1, RECEIVE_FILL_MULTIPLIER_MAX)
      : 1;
    result.set(inventoryItemId, {
      inventoryItemId,
      sampleCount: itemSamples.length,
      shortShipCount,
      medianFillRatio,
      multiplier,
      isChronic
    });
  }
  return result;
}

/**
 * Inflate a base recommended quantity for chronic short-ships, then re-apply the
 * same absolute bounds used by approval-median learning so stacked learning cannot explode.
 */
export function applyReceiveFillBias(
  baseQuantity: number,
  bias: ReceiveFillBias | undefined,
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

export function receiveFillBiasReasonFragment(bias: ReceiveFillBias): string {
  const fillPercent = Math.round(bias.medianFillRatio * 100);
  return `Mise is padding for a stable short-ship pattern: recent receives averaged ~${fillPercent}% of ordered (median of ${bias.sampleCount} deliveries).`;
}

export function buildChronicShortShipInsightInput(bias: ReceiveFillBias): {
  insightType: "ordering";
  severity: "warning";
  fillPercent: number;
} | null {
  if (!bias.isChronic) return null;
  return {
    insightType: "ordering",
    severity: "warning",
    fillPercent: Math.round(bias.medianFillRatio * 100)
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
