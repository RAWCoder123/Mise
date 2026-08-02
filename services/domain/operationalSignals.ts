import { canonicalInventoryUnit, inventoryUnitsAreCompatible } from "./inventoryUnits";
import { projectedQuantityAfterSales } from "./posConsumption";
import {
  applyReceiveFillBias,
  buildChronicShortShipInsightInput,
  buildReceiveFillBiasByItem,
  receiveFillBiasReasonFragment,
  type ReceiveDiscrepancySample,
  type ReceiveFillBias
} from "./receiveDiscrepancyLearning";
import {
  applyLossBias,
  buildChronicCountShrinkInsightInput,
  buildChronicWasteInsightInput,
  buildCountShrinkBiasByItem,
  buildWasteBiasByItem,
  lossBiasReasonFragment,
  type CountVarianceSample,
  type LossBias,
  type WasteSample
} from "./wasteVarianceLearning";
import type { InsightPresentationDescriptor } from "../../types/presentation";

export interface OperationalInventoryItem {
  id: string;
  restaurant_id: string;
  item_name: string;
  supplier_name: string;
  unit: string;
  current_quantity: number;
  par_level: number;
  reorder_threshold: number;
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
  supplier_order_id?: string | null;
}

export interface OperationalRecommendation {
  restaurant_id: string;
  inventory_item_id: string;
  item_name: string;
  supplier_name: string;
  recommended_quantity: number;
  original_recommended_quantity: null;
  dismiss_reason: null;
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
  /** Quantity already deducted from on-hand for today's mapped POS usage, by inventory item. */
  appliedTodayConsumptionByItemId?: Record<string, number>;
  /** Receiving ledger samples (ordered vs received) for short-ship fill-rate learning. */
  receivingHistory?: ReceiveDiscrepancySample[];
  /** Waste ledger samples for chronic spoilage/loss learning. */
  wasteHistory?: WasteSample[];
  /** Manual count variance samples for chronic shrink learning. */
  countVarianceHistory?: CountVarianceSample[];
}

export function calculateOperationalSignals(snapshot: OperationalPlanningSnapshot) {
  const now = new Date().toISOString();
  const demand = historicalDailyDemand(snapshot.sales, snapshot.operatingDate);
  const todaySales = snapshot.sales.filter(
    (sale) => sale.restaurant_id === snapshot.restaurantId && sale.sale_date === snapshot.operatingDate
  );
  const handled = latestHandledByItem(snapshot.recommendationHistory);
  const learned = learnedQuantities(snapshot.recommendationHistory);
  const receiveBiasByItem = buildReceiveFillBiasByItem(snapshot.receivingHistory ?? []);
  const wasteBiasByItem = buildWasteBiasByItem(snapshot.wasteHistory ?? []);
  const countShrinkBiasByItem = buildCountShrinkBiasByItem(snapshot.countVarianceHistory ?? []);
  const recommendations: OperationalRecommendation[] = [];
  const insights: OperationalInsight[] = [];
  const chronicShortShipInsights: OperationalInsight[] = [];
  const chronicLossInsights: OperationalInsight[] = [];

  for (const item of snapshot.inventoryItems.filter((entry) => entry.restaurant_id === snapshot.restaurantId)) {
    const mappings = snapshot.menuItemIngredients.filter(
      (mapping) =>
        mapping.restaurant_id === snapshot.restaurantId &&
        mapping.inventory_item_id === item.id &&
        inventoryUnitsAreCompatible(item.unit, mapping.unit)
    );
    const todayUsage = mappings.reduce((sum, mapping) => {
      const sold = todaySales
        .filter((sale) => normalizeKey(sale.item_name) === normalizeKey(mapping.menu_item_name))
        .reduce((quantity, sale) => quantity + finiteNonNegative(sale.quantity_sold), 0);
      return sum + sold * finiteNonNegative(mapping.quantity_used_per_sale);
    }, 0);
    const baselineUsage = mappings.reduce((sum, mapping) => {
      return sum + (demand.get(normalizeKey(mapping.menu_item_name)) ?? 0) * finiteNonNegative(mapping.quantity_used_per_sale);
    }, 0);
    const appliedToday = finiteNonNegative(snapshot.appliedTodayConsumptionByItemId?.[item.id] ?? 0);
    const { projectedQuantity } = projectedQuantityAfterSales(
      item.current_quantity,
      todayUsage,
      appliedToday
    );
    const threshold = finiteNonNegative(item.reorder_threshold);
    const isCritical = projectedQuantity <= 0;
    const isLow = !isCritical && projectedQuantity <= threshold;
    const suggested = Math.max(1, Math.ceil(finiteNonNegative(item.par_level) - projectedQuantity));
    const recentHandled = handled.get(item.id);
    const changedAfterHandling = recentHandled && item.last_updated
      ? Date.parse(item.last_updated) > Date.parse(recentHandled.created_at)
      : false;
    const receiveBias = receiveBiasByItem.get(item.id);
    const wasteBias = wasteBiasByItem.get(item.id);
    const countShrinkBias = countShrinkBiasByItem.get(item.id);
    const chronicInsight = buildChronicShortShipInsight(item, receiveBias, now, snapshot.restaurantId);
    if (chronicInsight) chronicShortShipInsights.push(chronicInsight);
    const wasteInsight = buildChronicWasteInsight(item, wasteBias, now, snapshot.restaurantId);
    if (wasteInsight) chronicLossInsights.push(wasteInsight);
    const shrinkInsight = buildChronicCountShrinkInsight(item, countShrinkBias, now, snapshot.restaurantId);
    if (shrinkInsight) chronicLossInsights.push(shrinkInsight);

    if ((isCritical || isLow) && (!recentHandled || changedAfterHandling)) {
      const learnedQuantity = boundedLearnedQuantity(
        learned.get(`${item.id}\u001f${canonicalInventoryUnit(item.unit)}`),
        suggested,
        item.par_level
      );
      const afterApprovalLearning = learnedQuantity ?? suggested;
      const bounds = { calculated: suggested, par: item.par_level };
      const afterReceive = applyReceiveFillBias(afterApprovalLearning, receiveBias, bounds);
      const afterWaste = applyLossBias(afterReceive ?? afterApprovalLearning, wasteBias, bounds);
      const afterShrink = applyLossBias(afterWaste ?? afterReceive ?? afterApprovalLearning, countShrinkBias, bounds);
      const quantity = afterShrink ?? afterWaste ?? afterReceive ?? afterApprovalLearning;
      const coverage = baselineUsage > 0 ? projectedQuantity / baselineUsage : null;
      const baseReason = coverage === null
        ? `${item.item_name} is at or below its reorder level. Mise recommends restoring it to par.`
        : `${item.item_name} has about ${round(coverage)} service days of projected coverage based on mapped demand.`;
      const reasonFragments: string[] = [];
      if (receiveBias?.isChronic && afterReceive != null && afterReceive !== afterApprovalLearning) {
        reasonFragments.push(receiveFillBiasReasonFragment(receiveBias));
      }
      if (wasteBias?.isChronic && afterWaste != null && afterWaste !== (afterReceive ?? afterApprovalLearning)) {
        reasonFragments.push(lossBiasReasonFragment(wasteBias));
      }
      if (
        countShrinkBias?.isChronic &&
        afterShrink != null &&
        afterShrink !== (afterWaste ?? afterReceive ?? afterApprovalLearning)
      ) {
        reasonFragments.push(lossBiasReasonFragment(countShrinkBias));
      }
      const reason = reasonFragments.length
        ? `${baseReason} ${reasonFragments.join(" ")}`
        : baseReason;
      recommendations.push({
        restaurant_id: snapshot.restaurantId,
        inventory_item_id: item.id,
        item_name: item.item_name,
        supplier_name: item.supplier_name,
        recommended_quantity: quantity,
        original_recommended_quantity: null,
        dismiss_reason: null,
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
        why_it_matters: "Low ingredient coverage can interrupt prep or service.",
        recommended_action: `Review the ${item.supplier_name} order and add ${quantity} ${item.unit}.`,
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
        why_it_matters: "Excess stock can tie up cash or increase waste risk.",
        recommended_action: `Delay the next ${item.item_name.toLowerCase()} order unless sales increase.`,
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

  // Prefer chronic short-ship / loss insights ahead of lower-priority sales spikes inside the insight cap.
  insights.unshift(...chronicLossInsights.slice(0, 2));
  insights.unshift(...chronicShortShipInsights.slice(0, 2));

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
      why_it_matters: "Linked ingredients may deplete faster than the usual ordering rhythm.",
      recommended_action: `Review inventory tied to ${sale.item_name.toLowerCase()} before the next prep window.`,
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

  return { recommendations: recommendations.slice(0, 250), insights: dedupeInsights(insights).slice(0, 8) };
}

export function buildRecommendationInserts(
  restaurantId: string,
  inventoryItems: OperationalInventoryItem[],
  sales: OperationalSale[],
  menuItemIngredients: OperationalRecipeMapping[],
  recommendationHistory: OperationalRecommendationHistory[] = [],
  operatingDate = new Date().toISOString().slice(0, 10),
  appliedTodayConsumptionByItemId: Record<string, number> = {},
  receivingHistory: ReceiveDiscrepancySample[] = [],
  wasteHistory: WasteSample[] = [],
  countVarianceHistory: CountVarianceSample[] = []
) {
  return calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems,
    sales,
    menuItemIngredients,
    recommendationHistory,
    appliedTodayConsumptionByItemId,
    receivingHistory,
    wasteHistory,
    countVarianceHistory
  }).recommendations;
}

export function buildInsightsFromData(
  restaurantId: string,
  inventoryItems: OperationalInventoryItem[],
  sales: OperationalSale[],
  menuItemIngredients: OperationalRecipeMapping[],
  operatingDate = new Date().toISOString().slice(0, 10),
  appliedTodayConsumptionByItemId: Record<string, number> = {},
  receivingHistory: ReceiveDiscrepancySample[] = [],
  wasteHistory: WasteSample[] = [],
  countVarianceHistory: CountVarianceSample[] = []
) {
  return calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems,
    sales,
    menuItemIngredients,
    recommendationHistory: [],
    appliedTodayConsumptionByItemId,
    receivingHistory,
    wasteHistory,
    countVarianceHistory
  }).insights;
}

function buildChronicShortShipInsight(
  item: OperationalInventoryItem,
  bias: ReceiveFillBias | undefined,
  createdAt: string,
  restaurantId: string
): OperationalInsight | null {
  if (!bias) return null;
  const marker = buildChronicShortShipInsightInput(bias);
  if (!marker) return null;
  const fillPercent = marker.fillPercent;
  return {
    id: `insight_shortship_${item.id}`,
    restaurant_id: restaurantId,
    insight_type: "ordering",
    title: `${item.item_name} is often short-shipped`,
    description: `Recent ${item.supplier_name} deliveries for ${item.item_name} averaged about ${fillPercent}% of the ordered quantity across ${bias.sampleCount} receives.`,
    why_it_matters: "Chronic short-ships leave less on hand than Mise ordered and can create avoidable stockouts.",
    recommended_action: `Order slightly more from ${item.supplier_name}, or confirm counts carefully when receiving.`,
    severity: "warning",
    created_at: createdAt,
    presentation: {
      code: "insight.rule.ordering.chronic_short_ship",
      values: {
        itemName: item.item_name,
        supplierName: item.supplier_name,
        fillPercent,
        sampleCount: bias.sampleCount
      }
    }
  };
}

function buildChronicWasteInsight(
  item: OperationalInventoryItem,
  bias: LossBias | undefined,
  createdAt: string,
  restaurantId: string
): OperationalInsight | null {
  if (!bias) return null;
  const marker = buildChronicWasteInsightInput(bias);
  if (!marker) return null;
  return {
    id: `insight_waste_${item.id}`,
    restaurant_id: restaurantId,
    insight_type: "waste",
    title: `${item.item_name} has a chronic waste pattern`,
    description: `Recent waste records for ${item.item_name} averaged about ${marker.lossPercent}% of on-hand across ${bias.sampleCount} events.`,
    why_it_matters: "Repeated waste silently reduces usable stock and can make par-based orders too light.",
    recommended_action: `Review prep and storage for ${item.item_name}, and confirm the next order covers expected loss.`,
    severity: "warning",
    created_at: createdAt,
    presentation: {
      code: "insight.rule.waste.chronic_waste",
      values: {
        itemName: item.item_name,
        lossPercent: marker.lossPercent,
        sampleCount: bias.sampleCount
      }
    }
  };
}

function buildChronicCountShrinkInsight(
  item: OperationalInventoryItem,
  bias: LossBias | undefined,
  createdAt: string,
  restaurantId: string
): OperationalInsight | null {
  if (!bias) return null;
  const marker = buildChronicCountShrinkInsightInput(bias);
  if (!marker) return null;
  return {
    id: `insight_count_shrink_${item.id}`,
    restaurant_id: restaurantId,
    insight_type: "inventory",
    title: `${item.item_name} often shrinks between counts`,
    description: `Recent inventory counts for ${item.item_name} averaged about ${marker.lossPercent}% below system across ${bias.sampleCount} counts.`,
    why_it_matters: "Unexplained shrink means Mise’s on-hand is drifting high and orders may understock the next service.",
    recommended_action: `Investigate count process and theft/spoilage risk for ${item.item_name}, then recount before ordering.`,
    severity: "warning",
    created_at: createdAt,
    presentation: {
      code: "insight.rule.inventory.chronic_count_shrink",
      values: {
        itemName: item.item_name,
        lossPercent: marker.lossPercent,
        sampleCount: bias.sampleCount
      }
    }
  };
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
