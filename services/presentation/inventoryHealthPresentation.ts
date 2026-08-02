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

export type InventoryLocationHealthStatus = "Good" | "Watch" | "Low" | "Critical";

export interface InventoryLocationHealthRow {
  locationId: string;
  name: string;
  sortOrder: number;
  itemCount: number;
  /** Inventory item ids with positive quantity at this station (stable sorted). */
  stockedItemIds: string[];
  counts: InventoryHealthCounts;
  atRiskCount: number;
}

export interface InventoryLocationHealthBreakdown {
  locations: InventoryLocationHealthRow[];
  stationCount: number;
  stockedStationCount: number;
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

/**
 * Break restaurant-wide projected item status down by storage station.
 * An item contributes to every location where it has positive quantity.
 * Empty stations are retained so operators can see inactive lines.
 */
export function buildInventoryLocationHealthBreakdown(input: {
  locations: ReadonlyArray<{ id: string; name: string; sortOrder?: number }>;
  balances: ReadonlyArray<{
    inventoryItemId: string;
    storageLocationId: string;
    quantity: number;
  }>;
  itemStatuses: ReadonlyArray<{ itemId: string; status: InventoryLocationHealthStatus }>;
}): InventoryLocationHealthBreakdown {
  const statusByItemId = new Map<string, InventoryLocationHealthStatus>();
  for (const entry of input.itemStatuses) {
    const itemId = String(entry.itemId ?? "").trim();
    if (!itemId) continue;
    statusByItemId.set(itemId, normalizeStatus(entry.status));
  }

  const countsByLocation = new Map<string, InventoryHealthCounts>();
  const stockedItemIdsByLocation = new Map<string, Set<string>>();
  for (const balance of input.balances) {
    const locationId = String(balance.storageLocationId ?? "").trim();
    const itemId = String(balance.inventoryItemId ?? "").trim();
    const quantity = Number(balance.quantity);
    if (!locationId || !itemId || !Number.isFinite(quantity) || quantity <= 1e-9) continue;
    const status = statusByItemId.get(itemId);
    if (!status) continue;
    const counts = countsByLocation.get(locationId) ?? emptyHealthCounts();
    bumpHealthCount(counts, status);
    countsByLocation.set(locationId, counts);
    const stocked = stockedItemIdsByLocation.get(locationId) ?? new Set<string>();
    stocked.add(itemId);
    stockedItemIdsByLocation.set(locationId, stocked);
  }

  const locations = input.locations
    .map((location, index) => {
      const locationId = String(location.id ?? "").trim();
      const name = String(location.name ?? "").trim();
      if (!locationId || !name) return null;
      const counts = normalizeInventoryHealthCounts(
        countsByLocation.get(locationId) ?? emptyHealthCounts()
      );
      const stockedItemIds = [...(stockedItemIdsByLocation.get(locationId) ?? [])].sort((left, right) =>
        left.localeCompare(right)
      );
      const itemCount = getInventoryHealthTotal(counts);
      const sortOrder = Number.isFinite(Number(location.sortOrder))
        ? Number(location.sortOrder)
        : index;
      return {
        locationId,
        name,
        sortOrder,
        itemCount,
        stockedItemIds,
        counts,
        atRiskCount: counts.low + counts.critical
      } satisfies InventoryLocationHealthRow;
    })
    .filter((row): row is InventoryLocationHealthRow => row != null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return {
    locations,
    stationCount: locations.length,
    stockedStationCount: locations.filter((row) => row.itemCount > 0).length
  };
}

/**
 * Resolve stocked inventory item ids for a selected station filter.
 * Returns null when no station is selected (caller should leave the list unfiltered by station).
 */
export function resolveStationStockedItemIds(
  breakdown: InventoryLocationHealthBreakdown | null | undefined,
  locationId: string | null | undefined
): string[] | null {
  const normalizedLocationId = String(locationId ?? "").trim();
  if (!normalizedLocationId || !breakdown) return null;
  const row = breakdown.locations.find((location) => location.locationId === normalizedLocationId);
  if (!row) return null;
  return row.stockedItemIds;
}

/** Keep items that have positive quantity at the selected station. */
export function filterItemsByStationStock<T extends { id: string }>(
  items: readonly T[],
  stockedItemIds: readonly string[] | null | undefined
): T[] {
  if (stockedItemIds == null) return [...items];
  const allowed = new Set(stockedItemIds);
  return items.filter((item) => allowed.has(item.id));
}

export function buildInventoryLocationHealthAccessibilityLabel(input: {
  breakdown: InventoryLocationHealthBreakdown;
  labels: {
    stations: string;
    emptyStation: string;
    items: (count: number) => string;
    atRisk: (count: number) => string;
  };
}) {
  if (input.breakdown.stationCount === 0) return input.labels.stations;
  return input.breakdown.locations
    .map((row) => {
      if (row.itemCount === 0) {
        return `${row.name}: ${input.labels.emptyStation}`;
      }
      const risk =
        row.atRiskCount > 0 ? ` ${input.labels.atRisk(row.atRiskCount)}` : "";
      return `${row.name}: ${input.labels.items(row.itemCount)}.${risk}`;
    })
    .join(" ");
}

function emptyHealthCounts(): InventoryHealthCounts {
  return { good: 0, watch: 0, low: 0, critical: 0 };
}

function bumpHealthCount(counts: InventoryHealthCounts, status: InventoryLocationHealthStatus) {
  if (status === "Good") counts.good += 1;
  else if (status === "Watch") counts.watch += 1;
  else if (status === "Low") counts.low += 1;
  else counts.critical += 1;
}

function normalizeStatus(status: InventoryLocationHealthStatus): InventoryLocationHealthStatus {
  if (status === "Good" || status === "Watch" || status === "Low" || status === "Critical") {
    return status;
  }
  return "Watch";
}

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}
