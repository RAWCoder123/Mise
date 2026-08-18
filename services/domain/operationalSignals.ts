import { canonicalInventoryUnit, inventoryUnitsAreCompatible } from "./inventoryUnits.ts";
import {
  buildInventoryCountEvidence,
  dayResolutionConsumptionIsAfterCount,
  missingInventoryCountEvidence,
  verifiedCountSupersedes,
  type VerifiedCountCandidate
} from "./inventoryCountAuthority.ts";
import { toDateKeyInTimeZone } from "../../utils/format.ts";
import type { InsightPresentationDescriptor } from "../../types/presentation.ts";

export interface OperationalInventoryItem {
  id: string;
  restaurant_id: string;
  item_name: string;
  supplier_name: string;
  unit: string;
  current_quantity: number;
  par_level: number;
  reorder_threshold: number;
  /**
   * Row mutation time. Not physical-count evidence: it moves for policy, cost, and
   * supplier edits. Planning freshness comes from `inventoryCountEvents` instead.
   */
  last_updated?: string;
}

export interface OperationalSale {
  restaurant_id: string;
  sale_date: string;
  item_name: string;
  quantity_sold: number;
}

export interface OperationalRecipeMapping {
  restaurant_id: string;
  menu_item_name: string;
  inventory_item_id: string;
  quantity_used_per_sale: number;
  unit: string;
}

export interface OperationalRecommendationHistory {
  inventory_item_id: string;
  recommended_quantity: number;
  unit: string;
  status: string;
  created_at: string;
}

export interface OperationalRecommendation {
  restaurant_id: string;
  inventory_item_id: string;
  item_name: string;
  supplier_name: string;
  recommended_quantity: number;
  unit: string;
  reason: string;
  urgency: "low" | "medium" | "high";
  status: "pending";
  supplier_order_id: null;
}

export interface OperationalInsight {
  id: string;
  restaurant_id: string;
  insight_type: "sales" | "inventory" | "waste" | "cost" | "prep" | "ordering";
  title: string;
  description: string;
  why_it_matters: string | null;
  recommended_action: string;
  severity: "info" | "warning" | "urgent";
  created_at: string;
  presentation: InsightPresentationDescriptor;
}

export interface OperationalPlanningSnapshot {
  restaurantId: string;
  operatingDate: string;
  inventoryItems: OperationalInventoryItem[];
  sales: OperationalSale[];
  menuItemIngredients: OperationalRecipeMapping[];
  recommendationHistory: OperationalRecommendationHistory[];
  /**
   * Verified physical-count evidence from the append-only inventory ledger.
   * Absent evidence keeps planning fail-closed: nothing is treated as freshly counted.
   */
  inventoryCountEvents?: readonly VerifiedCountCandidate[];
  /** Restaurant timezone, used to place a count inside the correct operating day. */
  timeZone?: string | null;
}

export function calculateOperationalSignals(snapshot: OperationalPlanningSnapshot) {
  const now = new Date().toISOString();
  const timeZone = snapshot.timeZone;
  const countEvidence = buildInventoryCountEvidence({
    restaurantId: snapshot.restaurantId,
    items: snapshot.inventoryItems.filter((item) => item.restaurant_id === snapshot.restaurantId),
    countEvents: snapshot.inventoryCountEvents ?? [],
    generatedAt: now,
    resolveOperatingDate: timeZone
      ? (iso) => toDateKeyInTimeZone(new Date(iso), timeZone)
      : undefined
  });
  const demand = historicalDailyDemand(snapshot.sales, snapshot.operatingDate);
  const todaySales = snapshot.sales.filter(
    (sale) => sale.restaurant_id === snapshot.restaurantId && sale.sale_date === snapshot.operatingDate
  );
  const handled = latestHandledByItem(snapshot.recommendationHistory);
  const learned = learnedQuantities(snapshot.recommendationHistory);
  const recommendations: OperationalRecommendation[] = [];
  const insights: OperationalInsight[] = [];

  for (const item of snapshot.inventoryItems.filter((entry) => entry.restaurant_id === snapshot.restaurantId)) {
    const mappings = snapshot.menuItemIngredients.filter(
      (mapping) =>
        mapping.restaurant_id === snapshot.restaurantId &&
        mapping.inventory_item_id === item.id &&
        inventoryUnitsAreCompatible(item.unit, mapping.unit)
    );
    const mappedTodayUsage = mappings.reduce((sum, mapping) => {
      const sold = todaySales
        .filter((sale) => normalizeKey(sale.item_name) === normalizeKey(mapping.menu_item_name))
        .reduce((quantity, sale) => quantity + finiteNonNegative(sale.quantity_sold), 0);
      return sum + sold * finiteNonNegative(mapping.quantity_used_per_sale);
    }, 0);
    const baselineUsage = mappings.reduce((sum, mapping) => {
      return sum + (demand.get(normalizeKey(mapping.menu_item_name)) ?? 0) * finiteNonNegative(mapping.quantity_used_per_sale);
    }, 0);
    const itemCountEvidence =
      countEvidence.get(item.id) ?? missingInventoryCountEvidence(snapshot.restaurantId, item.id);
    // `current_quantity` here was last overwritten by an invalid future-dated count.
    // The numeric basis is untrustworthy, so this item produces no quantity-based
    // recommendation or insight until a real recount re-anchors the projection.
    if (itemCountEvidence.status === "contaminated") continue;
    // A verified count taken inside today's operating day already observed part of
    // today's day-resolution POS sales, so those sales must not deplete it again.
    const todayUsage =
      itemCountEvidence.status !== "verified" ||
      dayResolutionConsumptionIsAfterCount(
        itemCountEvidence.countedOperatingDate,
        snapshot.operatingDate
      )
        ? mappedTodayUsage
        : 0;
    const projectedQuantity = Math.max(0, finiteNonNegative(item.current_quantity) - todayUsage);
    const threshold = finiteNonNegative(item.reorder_threshold);
    const isCritical = projectedQuantity <= 0;
    const isLow = !isCritical && projectedQuantity <= threshold;
    const suggested = Math.max(1, Math.ceil(finiteNonNegative(item.par_level) - projectedQuantity));
    const recentHandled = handled.get(item.id);
    // Only a newer verified physical count releases a handled recommendation;
    // policy, cost, supplier, and metadata edits never do.
    const recountedAfterHandling = recentHandled
      ? verifiedCountSupersedes(itemCountEvidence, recentHandled.created_at)
      : false;

    if ((isCritical || isLow) && (!recentHandled || recountedAfterHandling)) {
      const learnedQuantity = boundedLearnedQuantity(
        learned.get(`${item.id}\u001f${canonicalInventoryUnit(item.unit)}`),
        suggested,
        item.par_level
      );
      const quantity = learnedQuantity ?? suggested;
      const coverage = baselineUsage > 0 ? projectedQuantity / baselineUsage : null;
      const reason = coverage === null
        ? `${item.item_name} is at or below its reorder level. Mise recommends restoring it to par.`
        : `${item.item_name} has about ${round(coverage)} service days of projected coverage based on mapped demand.`;
      recommendations.push({
        restaurant_id: snapshot.restaurantId,
        inventory_item_id: item.id,
        item_name: item.item_name,
        supplier_name: item.supplier_name,
        recommended_quantity: quantity,
        unit: item.unit,
        reason,
        urgency: isCritical ? "high" : "medium",
        status: "pending",
        supplier_order_id: null
      });
      insights.push({
        id: `insight_low_${item.id}`,
        restaurant_id: snapshot.restaurantId,
        insight_type: "inventory",
        title: isCritical ? `${item.item_name} may run out today` : `${item.item_name} is below its normal level`,
        description: `${item.item_name} is projected at ${round(projectedQuantity)} ${item.unit} after mapped POS demand.`,
        why_it_matters: "This can interrupt prep or force an 86 mid-service.",
        recommended_action: `Check the walk-in, then add ${quantity} ${item.unit} on the next ${item.supplier_name} ticket.`,
        severity: isCritical ? "urgent" : "warning",
        created_at: now,
        presentation: {
          code: "insight.rule.inventory.stock_risk",
          values: {
            itemName: item.item_name,
            projectedQuantity,
            unit: item.unit,
            supplierName: item.supplier_name,
            suggestedOrderQuantity: quantity,
            status: isCritical ? "Critical" : "Low"
          }
        }
      });
    } else if (baselineUsage > 0 && projectedQuantity > baselineUsage * 3) {
      insights.push({
        id: `insight_overstock_${item.id}`,
        restaurant_id: snapshot.restaurantId,
        insight_type: "waste",
        title: `${item.item_name} may be overstocked`,
        description: `${round(projectedQuantity)} ${item.unit} is more than three service days of mapped demand.`,
        why_it_matters: "Extra on hand can spoil or tie up cash before the next rush needs it.",
        recommended_action: `Skip or trim the next ${item.item_name.toLowerCase()} order unless tonight’s sales stay hot.`,
        severity: "info",
        created_at: now,
        presentation: {
          code: "insight.rule.waste.overstock",
          values: {
            itemName: item.item_name,
            quantity: projectedQuantity,
            unit: item.unit
          }
        }
      });
    }
  }

  for (const sale of todaySales) {
    const baseline = demand.get(normalizeKey(sale.item_name));
    if (!baseline || sale.quantity_sold < baseline * 1.2) continue;
    const lift = Math.round(((sale.quantity_sold - baseline) / baseline) * 100);
    insights.push({
      id: `insight_spike_${normalizeKey(sale.item_name).replace(/\s+/g, "_")}`,
      restaurant_id: snapshot.restaurantId,
      insight_type: "sales",
      title: `${sale.item_name} demand is rising`,
      description: `${sale.item_name} sold ${lift}% more than its recent service-day baseline.`,
      why_it_matters: "Pull prep forward or you may 86 linked dishes before the next order lands.",
      recommended_action: `Before the next prep window, confirm walk-in counts for ingredients tied to ${sale.item_name.toLowerCase()}.`,
      severity: "warning",
      created_at: now,
      presentation: {
        code: "insight.rule.sales.demand_rising",
        values: {
          itemName: sale.item_name,
          liftPercent: lift
        }
      }
    });
  }

  const topSale = [...todaySales].sort((a, b) => b.quantity_sold - a.quantity_sold)[0];
  if (topSale) {
    const lowLinked = snapshot.inventoryItems.find((item) => {
      if (item.restaurant_id !== snapshot.restaurantId) return false;
      const linked = snapshot.menuItemIngredients.some(
        (mapping) =>
          mapping.restaurant_id === snapshot.restaurantId &&
          mapping.inventory_item_id === item.id &&
          normalizeKey(mapping.menu_item_name) === normalizeKey(topSale.item_name)
      );
      if (!linked) return false;
      return insights.some(
        (insight) =>
          insight.id === `insight_low_${item.id}` &&
          (insight.severity === "urgent" || insight.severity === "warning")
      );
    });
    if (lowLinked) {
      insights.push({
        id: `insight_prep_${normalizeKey(topSale.item_name).replace(/\s+/g, "_")}`,
        restaurant_id: snapshot.restaurantId,
        insight_type: "prep",
        title: `${topSale.item_name} depends on low stock`,
        description: `${topSale.item_name} is selling hard and uses ${lowLinked.item_name.toLowerCase()}, which is already below reorder.`,
        why_it_matters: "A top seller can get 86'd mid-service if this ingredient runs out.",
        recommended_action: `Before prep, put ${lowLinked.item_name.toLowerCase()} on the next ${lowLinked.supplier_name} ticket.`,
        severity: "urgent",
        created_at: now,
        presentation: {
          code: "insight.rule.prep.low_stock",
          values: {
            menuItemName: topSale.item_name,
            inventoryItemName: lowLinked.item_name,
            supplierName: lowLinked.supplier_name
          }
        }
      });
    }
  }

  return { recommendations: recommendations.slice(0, 250), insights: dedupeInsights(insights).slice(0, 8) };
}

export function buildRecommendationInserts(
  restaurantId: string,
  inventoryItems: OperationalInventoryItem[],
  sales: OperationalSale[],
  menuItemIngredients: OperationalRecipeMapping[],
  recommendationHistory: OperationalRecommendationHistory[] = [],
  operatingDate = new Date().toISOString().slice(0, 10),
  countEvidence: {
    inventoryCountEvents?: readonly VerifiedCountCandidate[];
    timeZone?: string | null;
  } = {}
) {
  return calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems,
    sales,
    menuItemIngredients,
    recommendationHistory,
    inventoryCountEvents: countEvidence.inventoryCountEvents,
    timeZone: countEvidence.timeZone
  }).recommendations;
}

export function buildInsightsFromData(
  restaurantId: string,
  inventoryItems: OperationalInventoryItem[],
  sales: OperationalSale[],
  menuItemIngredients: OperationalRecipeMapping[],
  operatingDate = new Date().toISOString().slice(0, 10),
  countEvidence: {
    inventoryCountEvents?: readonly VerifiedCountCandidate[];
    timeZone?: string | null;
  } = {}
) {
  return calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems,
    sales,
    menuItemIngredients,
    recommendationHistory: [],
    inventoryCountEvents: countEvidence.inventoryCountEvents,
    timeZone: countEvidence.timeZone
  }).insights;
}

function historicalDailyDemand(sales: OperationalSale[], operatingDate: string) {
  const days = [...new Set(sales.filter((sale) => sale.sale_date < operatingDate).map((sale) => sale.sale_date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 28);
  if (days.length < 7) return new Map<string, number>();
  const selectedDays = new Set(days);
  const totals = new Map<string, Map<string, number>>();
  for (const sale of sales) {
    if (!selectedDays.has(sale.sale_date) || sale.quantity_sold <= 0) continue;
    const key = normalizeKey(sale.item_name);
    const daily = totals.get(key) ?? new Map<string, number>();
    daily.set(sale.sale_date, (daily.get(sale.sale_date) ?? 0) + finiteNonNegative(sale.quantity_sold));
    totals.set(key, daily);
  }
  const result = new Map<string, number>();
  for (const [key, daily] of totals) {
    if (daily.size < 3) continue;
    result.set(key, robustAverage(days.map((day) => daily.get(day) ?? 0)));
  }
  return result;
}

function robustAverage(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const trimmed = sorted.length >= 10 ? sorted.slice(1, -1) : sorted;
  return trimmed.length ? trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length : 0;
}

function latestHandledByItem(history: OperationalRecommendationHistory[]) {
  const result = new Map<string, OperationalRecommendationHistory>();
  history
    .filter((entry) => ["approved", "dismissed", "ordered"].includes(entry.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .forEach((entry) => {
      if (!result.has(entry.inventory_item_id)) result.set(entry.inventory_item_id, entry);
    });
  return result;
}

function learnedQuantities(history: OperationalRecommendationHistory[]) {
  const samples = new Map<string, number[]>();
  const oldest = Date.now() - 180 * 86_400_000;
  for (const entry of history.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (!["approved", "ordered"].includes(entry.status)) continue;
    const timestamp = Date.parse(entry.created_at);
    if (!Number.isFinite(timestamp) || timestamp < oldest || timestamp > Date.now() + 86_400_000) continue;
    const key = `${entry.inventory_item_id}\u001f${canonicalInventoryUnit(entry.unit)}`;
    const values = samples.get(key) ?? [];
    if (values.length < 8 && entry.recommended_quantity > 0) values.push(entry.recommended_quantity);
    samples.set(key, values);
  }
  const result = new Map<string, number>();
  for (const [key, values] of samples) {
    if (values.length < 3) continue;
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    result.set(key, values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2);
  }
  return result;
}

function boundedLearnedQuantity(learned: number | undefined, calculated: number, par: number) {
  if (!learned || !Number.isFinite(learned)) return undefined;
  const minimum = Math.max(1, calculated * 0.5);
  const maximum = Math.max(calculated * 1.75, par * 1.25, 1);
  return learned >= minimum && learned <= maximum ? Math.max(1, Math.ceil(learned)) : undefined;
}

function dedupeInsights(insights: OperationalInsight[]) {
  const seen = new Set<string>();
  return insights.filter((insight) => {
    const key = `${insight.insight_type}\u001f${insight.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
