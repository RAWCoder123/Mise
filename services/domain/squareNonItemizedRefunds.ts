/**
 * Operator-facing attention for cash-only / non-itemized Square refunds.
 * Inventory is never auto-adjusted from these diagnostics.
 */

export const NON_ITEMIZED_REFUND_ATTENTION_KEY = "nonItemizedRefundAttention";

export interface NonItemizedSquareRefundAttention {
  orderCount: number;
  refundAmountTotal: number;
  sampleOrderIds: string[];
  detectedAt: string;
  windowFrom: string;
  windowTo: string;
  importId: string | null;
}

function asFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function asIsoOrDateString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  return trimmed;
}

function asSampleOrderIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || trimmed.length > 128) continue;
    ids.push(trimmed);
    if (ids.length >= 5) break;
  }
  return ids;
}

export function readNonItemizedSquareRefundAttention(
  settings: Record<string, unknown> | null | undefined
): NonItemizedSquareRefundAttention | null {
  if (!settings || typeof settings !== "object") return null;
  const raw = settings[NON_ITEMIZED_REFUND_ATTENTION_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const orderCount = asFiniteNumber(record.orderCount);
  const refundAmountTotal = asFiniteNumber(record.refundAmountTotal);
  const detectedAt = asIsoOrDateString(record.detectedAt);
  const windowFrom = asIsoOrDateString(record.windowFrom);
  const windowTo = asIsoOrDateString(record.windowTo);
  if (
    orderCount == null ||
    orderCount <= 0 ||
    orderCount > 100000 ||
    refundAmountTotal == null ||
    refundAmountTotal < 0 ||
    refundAmountTotal > 10_000_000 ||
    !detectedAt ||
    !windowFrom ||
    !windowTo
  ) {
    return null;
  }
  const importId =
    record.importId === null
      ? null
      : typeof record.importId === "string" && record.importId.length <= 64
        ? record.importId
        : null;
  return {
    orderCount: Math.floor(orderCount),
    refundAmountTotal: Math.round(refundAmountTotal * 100) / 100,
    sampleOrderIds: asSampleOrderIds(record.sampleOrderIds),
    detectedAt,
    windowFrom,
    windowTo,
    importId
  };
}
