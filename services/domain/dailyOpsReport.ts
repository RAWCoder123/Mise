import type {
  Insight,
  InsightSeverity,
  InsightType,
  InventoryOutlookItem,
  LearningMemorySummary,
  PosSale,
  TodaySummary
} from "../../types/mise";
import type { OperationalTodayTask } from "./todayTasks";
import type { RecordedSalesTrendPoint } from "./salesTrends";
import {
  buildDailyCloseoutSummary,
  type DailyCloseoutSummary
} from "./dailyCloseout";
import type { SupplierReliabilitySummary } from "./supplierReliability";
import type { WasteAnalysisSummary } from "./wasteAnalysis";
import { isActiveInventoryItem } from "./inventoryActivity";

export type DailyOpsSignalType = "waste" | "prep" | "inventory" | "sales" | "cost";

export interface DailyOpsInventoryHealth {
  good: number;
  watch: number;
  low: number;
  critical: number;
}

export interface DailyOpsDeliveryLine {
  id: string;
  itemName: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  at: string | null;
}

export interface DailyOpsManagerAction {
  id: string;
  title: string;
  detail: string;
  route: "/today" | "/inventory" | "/orders" | "/insights" | "/ask-mise";
  severity: InsightSeverity;
}

export interface DailyOpsReportInput {
  restaurantName: string;
  operatingDate: string;
  restaurantTimeZone: string;
  restaurantCurrency: string;
  summary: TodaySummary;
  inventoryHealth: DailyOpsInventoryHealth;
  operationalTasks: readonly OperationalTodayTask[];
  insights: readonly Insight[];
  learningMemory?: LearningMemorySummary | null;
  salesTrend?: readonly RecordedSalesTrendPoint[] | null;
  inventoryOutlooks?: readonly InventoryOutlookItem[] | null;
  operatorTasksOpen?: number;
  deliveries?: readonly DailyOpsDeliveryLine[] | null;
  supplierReliability?: SupplierReliabilitySummary | null;
  wasteAnalysis?: WasteAnalysisSummary | null;
  askBriefingText?: string | null;
  now?: Date;
}

export interface DailyOpsReport {
  day: {
    operatingDate: string;
    restaurantTimeZone: string;
    operatingSummary: string;
    restaurantName: string;
    miseStatus: string;
    restaurantCurrency: string;
  };
  closeout: DailyCloseoutSummary;
  sales: {
    salesToday: number;
    netSalesToday: number;
    itemsSold: number;
    topItems: Array<{ itemName: string; quantitySold: number; grossSales: number }>;
    priorSales: number | null;
    salesTrendDelta: number | null;
    salesTrendDirection: "up" | "down" | "flat" | null;
  };
  inventoryRisk: {
    alerts: number;
    health: DailyOpsInventoryHealth;
    estimatedDollarsAtRisk: number | null;
  };
  ordering: {
    pendingRecommendations: number;
  };
  throughput: {
    openTasks: number;
    completedTasks: number;
    operatorTasksOpen: number;
  };
  deliveriesToday: {
    count: number;
    lines: DailyOpsDeliveryLine[];
  };
  supplierReliability: SupplierReliabilitySummary;
  wasteAnalysis: WasteAnalysisSummary | null;
  signalsByType: Array<{
    type: DailyOpsSignalType;
    severity: InsightSeverity | null;
    title: string | null;
    line: string;
    insightId: string | null;
  }>;
  learning: {
    credibilityScore: number;
    credibilityLabel: string;
    credibilityNextStep: string;
    memoryLabel: string | null;
    memoryCopy: string | null;
    memoryNextStep: string | null;
  };
  managerAdvice: {
    actions: DailyOpsManagerAction[];
    askBriefingText: string | null;
  };
}

const SIGNAL_TYPES: DailyOpsSignalType[] = ["waste", "prep", "inventory", "sales", "cost"];

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  urgent: 0,
  warning: 1,
  info: 2
};

/**
 * Pure closeout report builder — sections for end-of-day operational review.
 */
export function buildDailyOpsReport(input: DailyOpsReportInput): DailyOpsReport {
  const {
    restaurantName,
    operatingDate,
    restaurantTimeZone,
    restaurantCurrency,
    summary,
    inventoryHealth,
    operationalTasks,
    insights,
    learningMemory = null,
    salesTrend = null,
    inventoryOutlooks = null,
    operatorTasksOpen = 0,
    deliveries = null,
    supplierReliability = null,
    wasteAnalysis = null,
    askBriefingText = null,
    now
  } = input;

  const openTasks = operationalTasks.filter((task) => task.status === "open").length;
  const completedTasks = operationalTasks.filter((task) => task.status === "completed").length;
  const deliveryLines = [...(deliveries ?? [])];
  const trend = summarizeSalesTrend(salesTrend);
  const estimatedDollarsAtRisk = estimateDollarsAtRisk(inventoryOutlooks);
  const closeout = buildDailyCloseoutSummary({
    operatingDate,
    restaurantTimeZone,
    completedTasks,
    openTasks,
    operatorTasksOpen,
    inventoryAlerts: summary.inventoryAlerts,
    pendingRecommendations: summary.pendingRecommendations,
    now
  });

  return {
    day: {
      operatingDate,
      restaurantTimeZone,
      operatingSummary: summary.operatingSummary,
      restaurantName,
      miseStatus: summary.miseStatus,
      restaurantCurrency
    },
    closeout,
    sales: {
      salesToday: summary.salesToday,
      netSalesToday: summary.netSalesToday,
      itemsSold: summary.itemsSold,
      topItems: summarizeTopItems(summary.topItems),
      priorSales: trend.priorSales,
      salesTrendDelta: trend.delta,
      salesTrendDirection: trend.direction
    },
    inventoryRisk: {
      alerts: summary.inventoryAlerts,
      health: { ...inventoryHealth },
      estimatedDollarsAtRisk
    },
    ordering: {
      pendingRecommendations: summary.pendingRecommendations
    },
    throughput: {
      openTasks,
      completedTasks,
      operatorTasksOpen: Math.max(0, Math.floor(operatorTasksOpen))
    },
    deliveriesToday: {
      count: deliveryLines.length,
      lines: deliveryLines.slice(0, 12)
    },
    supplierReliability: supplierReliability ?? emptySupplierReliabilitySummary(),
    wasteAnalysis,
    signalsByType: SIGNAL_TYPES.map((type) => pickSignalLine(insights, type)),
    learning: {
      credibilityScore: summary.credibility.score,
      credibilityLabel: summary.credibility.label,
      credibilityNextStep: summary.credibility.nextStep,
      memoryLabel: learningMemory?.label ?? null,
      memoryCopy: learningMemory?.operatorCopy ?? null,
      memoryNextStep: learningMemory?.nextStep ?? null
    },
    managerAdvice: {
      actions: rankManagerActions({
        summary,
        inventoryHealth,
        insights,
        openTasks,
        operatorTasksOpen: Math.max(0, Math.floor(operatorTasksOpen)),
        pendingRecommendations: summary.pendingRecommendations
      }),
      askBriefingText: askBriefingText?.trim() ? askBriefingText.trim() : null
    }
  };
}

function emptySupplierReliabilitySummary(): SupplierReliabilitySummary {
  return {
    totalDeliveries: 0,
    supplierCount: 0,
    attentionSupplierCount: 0,
    overallOnTimeRate: null,
    overallMatchedDeliveryRate: null,
    suppliers: []
  };
}

function summarizeTopItems(topItems: readonly PosSale[]) {
  return topItems.slice(0, 5).map((sale) => ({
    itemName: sale.item_name,
    quantitySold: sale.quantity_sold,
    grossSales: sale.gross_sales
  }));
}

function summarizeSalesTrend(salesTrend: readonly RecordedSalesTrendPoint[] | null | undefined): {
  priorSales: number | null;
  delta: number | null;
  direction: "up" | "down" | "flat" | null;
} {
  if (!salesTrend || salesTrend.length < 2) {
    return { priorSales: null, delta: null, direction: null };
  }
  const latest = salesTrend[salesTrend.length - 1]!;
  const prior = salesTrend[salesTrend.length - 2]!;
  const delta = Math.round((latest.sales - prior.sales) * 100) / 100;
  const direction: "up" | "down" | "flat" =
    Math.abs(delta) < 0.005 ? "flat" : delta > 0 ? "up" : "down";
  return { priorSales: prior.sales, delta, direction };
}

function estimateDollarsAtRisk(
  outlooks: readonly InventoryOutlookItem[] | null | undefined
): number | null {
  if (!outlooks || outlooks.length === 0) return null;

  let total = 0;
  let riskItems = 0;
  for (const { item, prediction } of outlooks) {
    if (!isActiveInventoryItem(item)) continue;
    if (prediction.projectedStatus !== "Critical" && prediction.projectedStatus !== "Low") {
      continue;
    }
    riskItems += 1;
    const unitCost = Number.isFinite(item.estimated_unit_cost) ? Math.max(0, item.estimated_unit_cost) : 0;
    const shortfallToPar = Math.max(0, item.par_level - prediction.projectedQuantity);
    const exposedQty =
      shortfallToPar > 0 ? shortfallToPar : Math.max(0, item.current_quantity);
    total += unitCost * exposedQty;
  }

  if (riskItems === 0) return 0;
  return Math.round(total * 100) / 100;
}

function pickSignalLine(
  insights: readonly Insight[],
  type: DailyOpsSignalType
): DailyOpsReport["signalsByType"][number] {
  const candidates = insights
    .filter((insight) => insight.insight_type === (type as InsightType))
    .slice()
    .sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]);

  const best = candidates[0];
  if (!best) {
    return {
      type,
      severity: null,
      title: null,
      line: `No ${type} signal for closeout.`,
      insightId: null
    };
  }

  const action = best.recommended_action?.trim();
  const why = best.why_it_matters?.trim();
  const line = action
    ? why
      ? `${action} — ${why}`
      : action
    : why || best.description || best.title;

  return {
    type,
    severity: best.severity,
    title: best.title,
    line,
    insightId: best.id
  };
}

function rankManagerActions(input: {
  summary: TodaySummary;
  inventoryHealth: DailyOpsInventoryHealth;
  insights: readonly Insight[];
  openTasks: number;
  operatorTasksOpen: number;
  pendingRecommendations: number;
}): DailyOpsManagerAction[] {
  const actions: DailyOpsManagerAction[] = [];

  for (const card of input.summary.attentionCards.slice(0, 3)) {
    actions.push({
      id: `attention-${card.id}`,
      title: card.title,
      detail: card.detail,
      route: card.route,
      severity: card.severity
    });
  }

  const stockRisk = input.inventoryHealth.critical + input.inventoryHealth.low;
  if (stockRisk > 0 && !actions.some((action) => action.route === "/inventory")) {
    actions.push({
      id: "stock-risk",
      title: `${stockRisk} stock item${stockRisk === 1 ? "" : "s"} need attention`,
      detail: "Review critical and low projected coverage before the next service.",
      route: "/inventory",
      severity: input.inventoryHealth.critical > 0 ? "urgent" : "warning"
    });
  }

  if (
    input.pendingRecommendations > 0 &&
    !actions.some((action) => action.route === "/orders")
  ) {
    actions.push({
      id: "pending-orders",
      title: `${input.pendingRecommendations} order recommendation${
        input.pendingRecommendations === 1 ? "" : "s"
      } waiting`,
      detail: "Approve or dismiss pending purchase recommendations.",
      route: "/orders",
      severity: "warning"
    });
  }

  const openWork = input.openTasks + input.operatorTasksOpen;
  if (openWork > 0 && !actions.some((action) => action.route === "/today")) {
    actions.push({
      id: "open-work",
      title: `${openWork} open task${openWork === 1 ? "" : "s"} still on the board`,
      detail: "Close out workflow and operator tasks before leaving.",
      route: "/today",
      severity: "info"
    });
  }

  const urgentInsight = [...input.insights]
    .filter((insight) => insight.severity === "urgent")
    .sort((left, right) => left.title.localeCompare(right.title))[0];
  if (urgentInsight && !actions.some((action) => action.route === "/insights")) {
    actions.push({
      id: `insight-${urgentInsight.id}`,
      title: urgentInsight.title,
      detail: urgentInsight.recommended_action || urgentInsight.description,
      route: "/insights",
      severity: "urgent"
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "all-clear",
      title: "Closeout looks clear",
      detail: "No urgent stock, order, or task blockers for this operating day.",
      route: "/today",
      severity: "info"
    });
  }

  return actions
    .slice()
    .sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity])
    .slice(0, 3);
}
