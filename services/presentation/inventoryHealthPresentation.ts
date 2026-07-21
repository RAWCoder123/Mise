export interface InventoryHealthCounts {
  good: number;
  watch: number;
  low: number;
  critical: number;
}

export type InventoryHealthStatusKey = keyof InventoryHealthCounts;
export type InventoryHealthLegendValueMode = "percentage" | "count";

export interface InventoryHealthLabels {
  good: string;
  watch: string;
  low: string;
  critical: string;
  wellStocked: string;
  empty: string;
}

export const inventoryHealthStatusOrder: readonly InventoryHealthStatusKey[] = [
  "good",
  "watch",
  "low",
  "critical"
];

export function normalizeInventoryHealthCounts(counts: InventoryHealthCounts): InventoryHealthCounts {
  return {
    good: normalizeCount(counts.good),
    watch: normalizeCount(counts.watch),
    low: normalizeCount(counts.low),
    critical: normalizeCount(counts.critical)
  };
}

export function getInventoryHealthTotal(counts: InventoryHealthCounts) {
  const normalized = normalizeInventoryHealthCounts(counts);
  return inventoryHealthStatusOrder.reduce((total, status) => total + normalized[status], 0);
}

export function getWellStockedPercentage(counts: InventoryHealthCounts) {
  const normalized = normalizeInventoryHealthCounts(counts);
  const total = getInventoryHealthTotal(normalized);
  return total === 0 ? 0 : Math.round((normalized.good / total) * 100);
}

export function getInventoryHealthPercentages(counts: InventoryHealthCounts): InventoryHealthCounts {
  const normalized = normalizeInventoryHealthCounts(counts);
  const total = getInventoryHealthTotal(normalized);

  if (total === 0) return { good: 0, watch: 0, low: 0, critical: 0 };

  return {
    good: Math.round((normalized.good / total) * 100),
    watch: Math.round((normalized.watch / total) * 100),
    low: Math.round((normalized.low / total) * 100),
    critical: Math.round((normalized.critical / total) * 100)
  };
}

export function buildInventoryHealthAccessibilityLabel({
  counts,
  labels,
  formatCount,
  formatPercentage
}: {
  counts: InventoryHealthCounts;
  labels: InventoryHealthLabels;
  formatCount: (value: number) => string;
  formatPercentage: (value: number) => string;
}) {
  const normalized = normalizeInventoryHealthCounts(counts);
  const total = getInventoryHealthTotal(normalized);
  if (total === 0) return labels.empty;

  return `${labels.wellStocked}: ${formatPercentage(getWellStockedPercentage(normalized))}. ${labels.good}: ${formatCount(normalized.good)}. ${labels.watch}: ${formatCount(normalized.watch)}. ${labels.low}: ${formatCount(normalized.low)}. ${labels.critical}: ${formatCount(normalized.critical)}.`;
}

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}
