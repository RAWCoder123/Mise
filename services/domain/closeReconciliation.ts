import { toDateKeyInTimeZone } from "../../utils/format";
import type { InsightPresentationDescriptor } from "../../types/presentation";
import type { InventoryEvent } from "./inventoryLedger";
import {
  reconcileInventoryCount,
  type InventoryReconciliationThresholds
} from "./inventoryReconciliation";
import type { OperationalInsight } from "./operationalSignals";

/**
 * Closing-cycle reconciliation: waste, count variance, and stock risk that
 * must carry into tomorrow. Pure and storage-agnostic so open/mid cycles can
 * keep refreshing planning signals while close owns this evidence pass.
 *
 * Never invents waste, variance, or stockouts. Missing evidence is labeled
 * incomplete rather than treated as a clean close.
 */

export type CloseReconciliationStatus = "clean" | "attention" | "urgent" | "incomplete";

export type CloseReconciliationFindingCategory =
  | "waste"
  | "variance"
  | "stockout"
  | "data_quality";

export interface CloseReconciliationFinding {
  id: string;
  category: CloseReconciliationFindingCategory;
  severity: "info" | "warning" | "urgent";
  title: string;
  explanation: string;
  recommendedAction: string;
  inventoryItemId: string | null;
  itemName: string | null;
  evidenceReferences: string[];
}

export interface CloseReconciliationSummary {
  restaurantId: string;
  operatingDate: string;
  restaurantTimeZone: string;
  status: CloseReconciliationStatus;
  findings: CloseReconciliationFinding[];
  wasteEventCount: number;
  materialVarianceCount: number;
  alignedCountCount: number;
  blockedCountCount: number;
  criticalStockCount: number;
  unavailableSignals: string[];
  generatedAt: string;
}

export interface CloseReconciliationInventoryItem {
  id: string;
  restaurant_id: string;
  item_name: string;
  unit: string;
  current_quantity: number;
  reorder_threshold: number;
}

/** Canonical-unit thresholds shared with inventory count reconciliation proofs. */
export const CLOSE_RECONCILIATION_THRESHOLDS: InventoryReconciliationThresholds = {
  absoluteQuantity: 250,
  percentage: 0.1,
  percentageFloorQuantity: 1000
};

const MAX_FINDINGS = 5;

export function buildCloseReconciliation(input: {
  restaurantId: string;
  operatingDate: string;
  restaurantTimeZone: string;
  inventoryItems: readonly CloseReconciliationInventoryItem[];
  inventoryEvents: readonly InventoryEvent[];
  /** Optional post-recompute stock-risk item ids; never invents when omitted. */
  stockRiskItemIds?: readonly string[];
  thresholds?: InventoryReconciliationThresholds;
  generatedAt?: string;
  now?: Date;
}): CloseReconciliationSummary {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Close reconciliation requires a restaurant.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.operatingDate)) {
    throw new Error("Close reconciliation requires a valid operating date.");
  }
  const timeZone = input.restaurantTimeZone.trim();
  if (!timeZone) throw new Error("Close reconciliation requires a restaurant timezone.");

  for (const item of input.inventoryItems) {
    if (item.restaurant_id !== restaurantId) {
      throw new Error("Close reconciliation received a cross-restaurant inventory item.");
    }
  }
  for (const event of input.inventoryEvents) {
    if (event.restaurantId !== restaurantId) {
      throw new Error("Close reconciliation received a cross-restaurant inventory event.");
    }
  }

  const generatedAt =
    typeof input.generatedAt === "string" && Number.isFinite(Date.parse(input.generatedAt))
      ? input.generatedAt
      : (input.now instanceof Date && Number.isFinite(input.now.getTime())
          ? input.now
          : new Date()
        ).toISOString();
  const thresholds = input.thresholds ?? CLOSE_RECONCILIATION_THRESHOLDS;
  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  const unavailableSignals: string[] = [];
  const findings: CloseReconciliationFinding[] = [];

  const superseded = new Set(
    input.inventoryEvents
      .filter((event) => event.eventType === "correction" && event.supersedesEventId)
      .map((event) => event.supersedesEventId!)
  );

  const dayEvents = input.inventoryEvents.filter((event) => {
    if (superseded.has(event.id)) return false;
    const parsed = Date.parse(event.effectiveAt);
    if (!Number.isFinite(parsed)) return false;
    return toDateKeyInTimeZone(new Date(parsed), timeZone) === input.operatingDate;
  });

  const wasteEvents = dayEvents.filter(
    (event) => event.eventType === "waste" && Number.isFinite(event.quantity) && event.quantity > 0
  );
  if (wasteEvents.length === 0) {
    unavailableSignals.push("operating-day waste records");
    findings.push({
      id: `close-waste-gap:${input.operatingDate}`,
      category: "data_quality",
      severity: "info",
      title: "Waste evidence was not recorded today",
      explanation:
        "Mise is not treating a missing waste log as zero waste. Closing reconciliation stays incomplete until trim or spoilage is recorded or explicitly confirmed absent.",
      recommendedAction: "Log waste before close, or confirm there was none after the final prep.",
      inventoryItemId: null,
      itemName: null,
      evidenceReferences: ["data-gap:waste"]
    });
  } else {
    const byItem = new Map<string, InventoryEvent[]>();
    for (const event of wasteEvents) {
      const bucket = byItem.get(event.inventoryItemId) ?? [];
      bucket.push(event);
      byItem.set(event.inventoryItemId, bucket);
    }
    const ranked = [...byItem.entries()]
      .map(([inventoryItemId, events]) => {
        const item = itemsById.get(inventoryItemId);
        const quantity = events.reduce((sum, event) => sum + event.quantity, 0);
        return { inventoryItemId, events, item, quantity };
      })
      .sort((left, right) => right.quantity - left.quantity || left.inventoryItemId.localeCompare(right.inventoryItemId));
    const top = ranked[0]!;
    const itemName = top.item?.item_name ?? "an inventory item";
    const unit = top.item?.unit ?? top.events[0]?.canonicalUnit ?? "units";
    findings.push({
      id: `close-waste:${input.operatingDate}:${top.inventoryItemId}`,
      category: "waste",
      severity: ranked.some((entry) => entry.events.length >= 2) ? "warning" : "info",
      title: `${wasteEvents.length} waste entr${wasteEvents.length === 1 ? "y" : "ies"} recorded at close`,
      explanation: `${formatQuantity(top.quantity)} ${unit} of ${itemName} accounts for the largest share of today's waste evidence.`,
      recommendedAction: `Review ${itemName.toLowerCase()} prep and storage before tomorrow's order or count.`,
      inventoryItemId: top.inventoryItemId,
      itemName: top.item?.item_name ?? null,
      evidenceReferences: wasteEvents.slice(0, 5).map((event) => `inventory-event:${event.id}`)
    });
  }

  const countEvents = dayEvents
    .filter((event) => event.eventType === "count")
    .slice()
    .sort((left, right) => left.sequence - right.sequence);
  let materialVarianceCount = 0;
  let alignedCountCount = 0;
  let blockedCountCount = 0;
  if (countEvents.length === 0) {
    unavailableSignals.push("operating-day physical counts");
  } else {
    for (const count of countEvents) {
      const itemEvents = input.inventoryEvents.filter(
        (event) => event.inventoryItemId === count.inventoryItemId
      );
      const result = reconcileInventoryCount({
        events: itemEvents,
        countEventId: count.id,
        thresholds
      });
      const item = itemsById.get(count.inventoryItemId);
      if (result.status === "blocked") {
        blockedCountCount += 1;
        findings.push({
          id: `close-variance-blocked:${count.id}`,
          category: "variance",
          severity: "warning",
          title: `${item?.item_name ?? "Counted item"} could not be reconciled`,
          explanation: `The closing count is retained, but variance is blocked: ${result.reasons.join(", ")}.`,
          recommendedAction: "Resolve the ledger conflict before treating the count as aligned.",
          inventoryItemId: count.inventoryItemId,
          itemName: item?.item_name ?? null,
          evidenceReferences: [`inventory-event:${count.id}`, ...result.reasons.map((reason) => `conflict:${reason}`)]
        });
        continue;
      }
      if (result.status === "aligned") {
        alignedCountCount += 1;
        continue;
      }
      materialVarianceCount += 1;
      const direction = result.varianceQuantity > 0 ? "above" : "below";
      findings.push({
        id: `close-variance:${count.id}`,
        category: "variance",
        severity: "urgent",
        title: `${item?.item_name ?? "Counted item"} shows a material count variance`,
        explanation: `Observed ${formatQuantity(result.observedQuantity)} ${count.canonicalUnit} is ${direction} the ledger projection of ${formatQuantity(result.expectedQuantity)} ${count.canonicalUnit} (${formatQuantity(Math.abs(result.varianceQuantity))} ${count.canonicalUnit} / ${Math.round(result.variancePercentage * 100)}%).`,
        recommendedAction: "Investigate shrink, receiving misses, or recipe mapping before the next service day.",
        inventoryItemId: count.inventoryItemId,
        itemName: item?.item_name ?? null,
        evidenceReferences: [`inventory-event:${count.id}`]
      });
    }
  }

  const stockRiskIds = new Set(
    (input.stockRiskItemIds ?? []).filter((id) => typeof id === "string" && id.trim())
  );
  const criticalItems = input.inventoryItems
    .filter((item) => {
      if (stockRiskIds.has(item.id)) return true;
      if (!Number.isFinite(item.current_quantity) || !Number.isFinite(item.reorder_threshold)) {
        return false;
      }
      return item.current_quantity <= item.reorder_threshold;
    })
    .sort(
      (left, right) =>
        left.current_quantity - right.current_quantity || left.item_name.localeCompare(right.item_name)
    );
  if (criticalItems.length > 0) {
    const top = criticalItems[0]!;
    findings.push({
      id: `close-stock:${input.operatingDate}:${top.id}`,
      category: "stockout",
      severity: "urgent",
      title: `${criticalItems.length} item${criticalItems.length === 1 ? "" : "s"} carry stock risk into tomorrow`,
      explanation: `${top.item_name} is at ${formatQuantity(top.current_quantity)} ${top.unit} against a reorder threshold of ${formatQuantity(top.reorder_threshold)} ${top.unit}.`,
      recommendedAction: "Confirm a count or approve replenishment before the next open.",
      inventoryItemId: top.id,
      itemName: top.item_name,
      evidenceReferences: criticalItems.slice(0, 5).map((item) => `inventory-item:${item.id}`)
    });
  }

  const rankedFindings = findings
    .slice()
    .sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || left.id.localeCompare(right.id))
    .slice(0, MAX_FINDINGS);

  const status = deriveStatus({
    findings: rankedFindings,
    wasteEventCount: wasteEvents.length,
    countEventCount: countEvents.length,
    materialVarianceCount,
    criticalStockCount: criticalItems.length
  });

  return {
    restaurantId,
    operatingDate: input.operatingDate,
    restaurantTimeZone: timeZone,
    status,
    findings: rankedFindings,
    wasteEventCount: wasteEvents.length,
    materialVarianceCount,
    alignedCountCount,
    blockedCountCount,
    criticalStockCount: criticalItems.length,
    unavailableSignals,
    generatedAt
  };
}

/**
 * Turns close findings into planning insights so Insights/Home can show them
 * without a separate store. Uses opaque presentation so locale screens keep
 * the grounded English evidence rather than inventing a new rule family.
 */
export function closeReconciliationInsights(
  summary: CloseReconciliationSummary
): OperationalInsight[] {
  return summary.findings.map((finding) => {
    const insightType =
      finding.category === "waste"
        ? "waste"
        : finding.category === "stockout"
          ? "inventory"
          : finding.category === "variance"
            ? "inventory"
            : "cost";
    const presentation: InsightPresentationDescriptor = {
      code: "insight.evidence.opaque",
      values: {
        insightType,
        rawTitle: finding.title,
        rawDescription: finding.explanation,
        rawWhyItMatters:
          finding.category === "data_quality"
            ? "Closing without evidence leaves tomorrow's open guessing."
            : "Closing reconciliation only reports what the ledger already recorded.",
        rawRecommendedAction: finding.recommendedAction
      }
    };
    return {
      id: `insight_${finding.id}`,
      restaurant_id: summary.restaurantId,
      insight_type: insightType,
      title: finding.title,
      description: finding.explanation,
      why_it_matters:
        finding.category === "data_quality"
          ? "Closing without evidence leaves tomorrow's open guessing."
          : "Closing reconciliation only reports what the ledger already recorded.",
      recommended_action: finding.recommendedAction,
      severity: finding.severity,
      created_at: summary.generatedAt,
      presentation
    };
  });
}

export function mergeCloseReconciliationInsights(
  planningInsights: readonly OperationalInsight[],
  closeInsights: readonly OperationalInsight[],
  limit = 8
): OperationalInsight[] {
  const merged = [...closeInsights, ...planningInsights];
  const seen = new Set<string>();
  const result: OperationalInsight[] = [];
  for (const insight of merged) {
    if (seen.has(insight.id)) continue;
    seen.add(insight.id);
    result.push(insight);
    if (result.length >= limit) break;
  }
  return result;
}

function deriveStatus(input: {
  findings: readonly CloseReconciliationFinding[];
  wasteEventCount: number;
  countEventCount: number;
  materialVarianceCount: number;
  criticalStockCount: number;
}): CloseReconciliationStatus {
  if (input.findings.some((finding) => finding.severity === "urgent") || input.materialVarianceCount > 0 || input.criticalStockCount > 0) {
    return "urgent";
  }
  if (input.findings.some((finding) => finding.severity === "warning")) {
    return "attention";
  }
  if (input.wasteEventCount === 0 || input.countEventCount === 0) {
    return "incomplete";
  }
  return "clean";
}

function severityRank(severity: CloseReconciliationFinding["severity"]) {
  if (severity === "urgent") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}
