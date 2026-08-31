import type { InventoryItem } from "../../types/mise";
import { addDaysToDateKey, toDateKeyInTimeZone } from "../../utils/format";
import type { InventoryEvent } from "./inventoryLedger";
import {
  HIGH_ATTENTION_WASTE_REASON_CODES,
  isWasteReasonCode,
  type WasteReasonCode
} from "./wasteReasonCodes";

export type WasteAnalysisStatus = "no_data" | "monitoring" | "attention";
export type WasteAnalysisTrend = "no_baseline" | "up" | "down" | "flat";
export type WasteAnalysisReason =
  | "no_records"
  | "repeat_item"
  | "cost_increase"
  | "unpriced_records"
  | "new_records"
  | "dominant_spoilage"
  | "within_baseline";
export type WasteAnalysisAction =
  | "start_logging"
  | "review_repeat_item"
  | "review_spoilage"
  | "complete_cost_setup"
  | "keep_logging";

export interface WasteAnalysisItem {
  inventoryItemId: string;
  itemName: string;
  category: string;
  eventCount: number;
  distinctDayCount: number;
  quantity: number | null;
  canonicalUnit: InventoryEvent["canonicalUnit"] | null;
  estimatedCost: number | null;
  costComplete: boolean;
  shareOfEstimatedCost: number | null;
  lastWastedAt: string;
}

export interface WasteAnalysisReasonBreakdown {
  reasonCode: WasteReasonCode | null;
  eventCount: number;
  estimatedCost: number | null;
  costComplete: boolean;
  shareOfEvents: number;
  shareOfEstimatedCost: number | null;
}

export interface WasteAnalysisEvent {
  id: string;
  inventoryItemId: string;
  itemName: string | null;
  quantity: number;
  canonicalUnit: InventoryEvent["canonicalUnit"];
  estimatedCost: number | null;
  effectiveAt: string;
  recordedAt: string;
  reasonCode: WasteReasonCode | null;
  note: string | null;
}

export interface WasteAnalysisSummary {
  restaurantId: string;
  operatingDate: string;
  windowDays: number;
  windowStart: string;
  priorWindowStart: string;
  priorWindowEnd: string;
  status: WasteAnalysisStatus;
  reasons: WasteAnalysisReason[];
  recommendedAction: WasteAnalysisAction;
  primaryItemId: string | null;
  eventCount: number;
  itemCount: number;
  estimatedCost: number | null;
  costComplete: boolean;
  pricedEventCount: number;
  unpricedEventCount: number;
  unmatchedEventCount: number;
  priorEventCount: number;
  priorEstimatedCost: number | null;
  priorCostComplete: boolean;
  trend: WasteAnalysisTrend;
  topItems: WasteAnalysisItem[];
  topReasons: WasteAnalysisReasonBreakdown[];
  recentEvents: WasteAnalysisEvent[];
  historyTruncated: boolean;
}

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 31;
const COST_TREND_THRESHOLD = 0.1;
const MIN_COST_INCREASE = 5;

/**
 * Turns append-only waste evidence into a bounded, deterministic operating
 * summary. Quantities are costed only through the item's verified canonical
 * conversion; incomplete setup remains visible instead of being estimated.
 */
export function buildWasteAnalysis(input: {
  restaurantId: string;
  operatingDate: string;
  restaurantTimeZone: string;
  inventoryItems: readonly InventoryItem[];
  events: readonly InventoryEvent[];
  windowDays?: number;
  historyTruncated?: boolean;
}): WasteAnalysisSummary {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Waste analysis requires a restaurant.");
  requireDateKey(input.operatingDate);
  requireTimeZone(input.restaurantTimeZone);
  requireTenantScope(restaurantId, input.inventoryItems, input.events);

  const windowDays = normalizedWindowDays(input.windowDays);
  const windowStart = addDaysToDateKey(input.operatingDate, -(windowDays - 1));
  const priorWindowEnd = addDaysToDateKey(windowStart, -1);
  const priorWindowStart = addDaysToDateKey(priorWindowEnd, -(windowDays - 1));
  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  const supersededEventIds = new Set(
    input.events
      .filter((event) => event.eventType === "correction" && event.supersedesEventId)
      .map((event) => event.supersedesEventId!)
  );

  const wasteEvidence = input.events
    .filter(
      (event) =>
        event.eventType === "waste" &&
        !supersededEventIds.has(event.id) &&
        Number.isFinite(event.quantity) &&
        event.quantity > 0
    )
    .flatMap((event) => {
      const parsed = new Date(event.effectiveAt);
      if (!Number.isFinite(parsed.getTime())) return [];
      return [{ event, date: toDateKeyInTimeZone(parsed, input.restaurantTimeZone) }];
    });

  const currentEvidence = wasteEvidence.filter(
    ({ date }) => date >= windowStart && date <= input.operatingDate
  );
  const priorEvidence = wasteEvidence.filter(
    ({ date }) => date >= priorWindowStart && date <= priorWindowEnd
  );
  const currentTotals = summarizeWindow(currentEvidence, itemsById);
  const priorTotals = summarizeWindow(priorEvidence, itemsById);
  const topItems = summarizeItems(currentEvidence, itemsById, currentTotals.estimatedCost);
  const topReasons = summarizeReasons(currentEvidence, itemsById, currentTotals.estimatedCost);
  const repeatedItem = topItems.find(
    (item) => item.eventCount >= 2 && item.distinctDayCount >= 2
  );
  const dominantSpoilage = hasDominantSpoilage(topReasons, currentEvidence.length);
  const trend = wasteTrend(currentTotals, priorTotals);
  const costIncrease =
    trend === "up" &&
    currentTotals.estimatedCost !== null &&
    priorTotals.estimatedCost !== null &&
    currentTotals.estimatedCost - priorTotals.estimatedCost >= MIN_COST_INCREASE;

  const reasons: WasteAnalysisReason[] = [];
  if (currentEvidence.length === 0) reasons.push("no_records");
  if (repeatedItem) reasons.push("repeat_item");
  if (dominantSpoilage) reasons.push("dominant_spoilage");
  if (costIncrease) reasons.push("cost_increase");
  if (currentTotals.unpricedEventCount > 0) reasons.push("unpriced_records");
  if (currentEvidence.length > 0 && priorEvidence.length === 0) reasons.push("new_records");
  if (currentEvidence.length > 0 && reasons.length === 0) reasons.push("within_baseline");

  const status: WasteAnalysisStatus =
    currentEvidence.length === 0
      ? "no_data"
      : repeatedItem || costIncrease || dominantSpoilage
        ? "attention"
        : "monitoring";
  const primaryItemId = repeatedItem?.inventoryItemId ?? topItems[0]?.inventoryItemId ?? null;
  const recommendedAction: WasteAnalysisAction =
    status === "no_data"
      ? "start_logging"
      : repeatedItem
        ? "review_repeat_item"
        : dominantSpoilage
          ? "review_spoilage"
          : currentTotals.pricedEventCount === 0 && currentTotals.unpricedEventCount > 0
            ? "complete_cost_setup"
            : "keep_logging";

  return {
    restaurantId,
    operatingDate: input.operatingDate,
    windowDays,
    windowStart,
    priorWindowStart,
    priorWindowEnd,
    status,
    reasons,
    recommendedAction,
    primaryItemId,
    eventCount: currentEvidence.length,
    itemCount: new Set(currentEvidence.map(({ event }) => event.inventoryItemId)).size,
    estimatedCost: currentTotals.estimatedCost,
    costComplete: currentTotals.costComplete,
    pricedEventCount: currentTotals.pricedEventCount,
    unpricedEventCount: currentTotals.unpricedEventCount,
    unmatchedEventCount: currentTotals.unmatchedEventCount,
    priorEventCount: priorEvidence.length,
    priorEstimatedCost: priorTotals.estimatedCost,
    priorCostComplete: priorTotals.costComplete,
    trend,
    topItems,
    topReasons,
    recentEvents: currentEvidence
      .slice()
      .sort(
        (left, right) =>
          right.event.effectiveAt.localeCompare(left.event.effectiveAt) ||
          right.event.recordedAt.localeCompare(left.event.recordedAt) ||
          left.event.id.localeCompare(right.event.id)
      )
      .slice(0, 20)
      .map(({ event }) => {
        const item = itemsById.get(event.inventoryItemId);
        return {
          id: event.id,
          inventoryItemId: event.inventoryItemId,
          itemName: item?.item_name ?? null,
          quantity: event.quantity,
          canonicalUnit: event.canonicalUnit,
          estimatedCost: estimateEventCost(event, item),
          effectiveAt: event.effectiveAt,
          recordedAt: event.recordedAt,
          reasonCode: normalizeStoredWasteReason(event.reasonCode),
          note: noteFromMetadata(event.metadata)
        };
      }),
    historyTruncated: Boolean(input.historyTruncated)
  };
}

function summarizeWindow(
  evidence: ReadonlyArray<{ event: InventoryEvent; date: string }>,
  itemsById: ReadonlyMap<string, InventoryItem>
) {
  let estimatedCost = 0;
  let pricedEventCount = 0;
  let unpricedEventCount = 0;
  let unmatchedEventCount = 0;
  for (const { event } of evidence) {
    const item = itemsById.get(event.inventoryItemId);
    if (!item) unmatchedEventCount += 1;
    const cost = estimateEventCost(event, item);
    if (cost === null) {
      unpricedEventCount += 1;
    } else {
      estimatedCost += cost;
      pricedEventCount += 1;
    }
  }
  return {
    eventCount: evidence.length,
    estimatedCost: pricedEventCount > 0 ? roundCurrency(estimatedCost) : evidence.length === 0 ? 0 : null,
    pricedEventCount,
    unpricedEventCount,
    unmatchedEventCount,
    costComplete: unpricedEventCount === 0
  };
}

function summarizeItems(
  evidence: ReadonlyArray<{ event: InventoryEvent; date: string }>,
  itemsById: ReadonlyMap<string, InventoryItem>,
  totalEstimatedCost: number | null
): WasteAnalysisItem[] {
  const groups = new Map<
    string,
    {
      item: InventoryItem;
      events: InventoryEvent[];
      dates: Set<string>;
      units: Set<InventoryEvent["canonicalUnit"]>;
      estimatedCost: number;
      pricedEventCount: number;
    }
  >();
  for (const { event, date } of evidence) {
    const item = itemsById.get(event.inventoryItemId);
    if (!item) continue;
    const group = groups.get(item.id) ?? {
      item,
      events: [],
      dates: new Set<string>(),
      units: new Set<InventoryEvent["canonicalUnit"]>(),
      estimatedCost: 0,
      pricedEventCount: 0
    };
    group.events.push(event);
    group.dates.add(date);
    group.units.add(event.canonicalUnit);
    const eventCost = estimateEventCost(event, item);
    if (eventCost !== null) {
      group.estimatedCost += eventCost;
      group.pricedEventCount += 1;
    }
    groups.set(item.id, group);
  }

  return [...groups.values()]
    .map((group) => {
      const canonicalUnit = group.units.size === 1 ? [...group.units][0]! : null;
      const estimatedCost =
        group.pricedEventCount > 0 ? roundCurrency(group.estimatedCost) : null;
      return {
        inventoryItemId: group.item.id,
        itemName: group.item.item_name,
        category: group.item.category,
        eventCount: group.events.length,
        distinctDayCount: group.dates.size,
        quantity:
          canonicalUnit === null
            ? null
            : roundQuantity(group.events.reduce((sum, event) => sum + event.quantity, 0)),
        canonicalUnit,
        estimatedCost,
        costComplete: group.pricedEventCount === group.events.length,
        shareOfEstimatedCost:
          estimatedCost !== null && totalEstimatedCost !== null && totalEstimatedCost > 0
            ? roundRate(estimatedCost / totalEstimatedCost)
            : null,
        lastWastedAt: group.events
          .map((event) => event.effectiveAt)
          .sort((left, right) => right.localeCompare(left))[0]!
      } satisfies WasteAnalysisItem;
    })
    .sort(
      (left, right) =>
        (right.estimatedCost ?? -1) - (left.estimatedCost ?? -1) ||
        right.eventCount - left.eventCount ||
        right.lastWastedAt.localeCompare(left.lastWastedAt) ||
        left.itemName.localeCompare(right.itemName)
    )
    .slice(0, 12);
}

function summarizeReasons(
  evidence: ReadonlyArray<{ event: InventoryEvent; date: string }>,
  itemsById: ReadonlyMap<string, InventoryItem>,
  totalEstimatedCost: number | null
): WasteAnalysisReasonBreakdown[] {
  if (evidence.length === 0) return [];

  const groups = new Map<
    string,
    {
      reasonCode: WasteReasonCode | null;
      eventCount: number;
      estimatedCost: number;
      pricedEventCount: number;
    }
  >();

  for (const { event } of evidence) {
    const reasonCode = normalizeStoredWasteReason(event.reasonCode);
    const key = reasonCode ?? "";
    const group = groups.get(key) ?? {
      reasonCode,
      eventCount: 0,
      estimatedCost: 0,
      pricedEventCount: 0
    };
    group.eventCount += 1;
    const eventCost = estimateEventCost(event, itemsById.get(event.inventoryItemId));
    if (eventCost !== null) {
      group.estimatedCost += eventCost;
      group.pricedEventCount += 1;
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const estimatedCost =
        group.pricedEventCount > 0 ? roundCurrency(group.estimatedCost) : null;
      return {
        reasonCode: group.reasonCode,
        eventCount: group.eventCount,
        estimatedCost,
        costComplete: group.pricedEventCount === group.eventCount,
        shareOfEvents: roundRate(group.eventCount / evidence.length),
        shareOfEstimatedCost:
          estimatedCost !== null && totalEstimatedCost !== null && totalEstimatedCost > 0
            ? roundRate(estimatedCost / totalEstimatedCost)
            : null
      } satisfies WasteAnalysisReasonBreakdown;
    })
    .sort(
      (left, right) =>
        right.eventCount - left.eventCount ||
        (right.estimatedCost ?? -1) - (left.estimatedCost ?? -1) ||
        compareReasonCodes(left.reasonCode, right.reasonCode)
    );
}

function hasDominantSpoilage(
  topReasons: readonly WasteAnalysisReasonBreakdown[],
  eventCount: number
) {
  if (eventCount < 2) return false;
  const attentionCount = topReasons
    .filter(
      (entry) =>
        entry.reasonCode !== null && HIGH_ATTENTION_WASTE_REASON_CODES.has(entry.reasonCode)
    )
    .reduce((sum, entry) => sum + entry.eventCount, 0);
  return attentionCount / eventCount >= 0.5;
}

function normalizeStoredWasteReason(value: string | null): WasteReasonCode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return isWasteReasonCode(normalized) ? normalized : null;
}

function compareReasonCodes(
  left: WasteReasonCode | null,
  right: WasteReasonCode | null
) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function estimateEventCost(event: InventoryEvent, item: InventoryItem | undefined) {
  if (!item) return null;
  if (
    item.canonical_unit_verification_status !== "verified" ||
    item.canonical_unit !== event.canonicalUnit ||
    !Number.isFinite(item.canonical_quantity_per_unit) ||
    (item.canonical_quantity_per_unit ?? 0) <= 0 ||
    !Number.isFinite(item.estimated_unit_cost) ||
    item.estimated_unit_cost < 0
  ) {
    return null;
  }
  const nativeQuantity = event.quantity / item.canonical_quantity_per_unit!;
  return roundCurrency(nativeQuantity * item.estimated_unit_cost);
}

function wasteTrend(
  current: ReturnType<typeof summarizeWindow>,
  prior: ReturnType<typeof summarizeWindow>
): WasteAnalysisTrend {
  if (
    prior.eventCount === 0 ||
    !current.costComplete ||
    !prior.costComplete ||
    current.estimatedCost === null ||
    prior.estimatedCost === null ||
    prior.estimatedCost <= 0
  ) {
    return "no_baseline";
  }
  const change = (current.estimatedCost - prior.estimatedCost) / prior.estimatedCost;
  if (Math.abs(change) < COST_TREND_THRESHOLD) return "flat";
  return change > 0 ? "up" : "down";
}

function noteFromMetadata(metadata: Readonly<Record<string, unknown>>) {
  const note = metadata.note;
  return typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null;
}

function normalizedWindowDays(value: number | undefined) {
  if (value === undefined) return DEFAULT_WINDOW_DAYS;
  if (!Number.isInteger(value) || value < 1 || value > MAX_WINDOW_DAYS) {
    throw new Error("Waste analysis window is outside supported limits.");
  }
  return value;
}

function requireTenantScope(
  restaurantId: string,
  items: readonly InventoryItem[],
  events: readonly InventoryEvent[]
) {
  if (
    items.some((item) => item.restaurant_id !== restaurantId) ||
    events.some((event) => event.restaurantId !== restaurantId)
  ) {
    throw new Error("Waste analysis received cross-restaurant evidence.");
  }
}

function requireDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Waste analysis requires an operating date.");
  }
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Waste analysis requires an operating date.");
  }
}

function requireTimeZone(value: string) {
  if (!value.trim()) throw new Error("Waste analysis requires a restaurant timezone.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error("Waste analysis requires a valid restaurant timezone.");
  }
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundRate(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}
