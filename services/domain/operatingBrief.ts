import type {
  Insight,
  InventoryItem,
  InventoryPrediction,
  PosSale,
  PurchaseRecommendation,
  Restaurant,
  SupplierOrder
} from "../../types/mise";
import {
  assertTenantScoped,
  dedupeActivityEvents,
  filterActivities,
  fromPurchaseRecommendationCreated,
  summarizeActivityWindow,
  type ActivityEvent,
  type ActivityWindowSummary
} from "./activityEvents";
import type { MiseAction } from "./miseActions";
import type { OperationalFinding } from "./operationalFindings";
import {
  resolveInventoryHealthLabel,
  type InventoryHealthLabel
} from "./operationalStatus";

export type RestaurantPulseStatus = "on_track" | "attention_needed" | "at_risk";

export interface DataFreshnessDescriptor {
  state: "fresh" | "stale" | "incomplete" | "unknown";
  asOf: string;
  label: string;
  missingData: string[];
}

export interface OperatingBriefApprovalCard {
  id: string;
  recommendationId: string | null;
  actionId: string | null;
  orderId?: string | null;
  findingId: string | null;
  title: string;
  decision: string;
  whyItMatters: string;
  recommendedAction: string;
  deadline: string | null;
  confidence: number | null;
  confidenceRationale: string | null;
  expectedOperationalImpact: string;
  estimatedFinancialImpact: string | null;
  riskIfIgnored: string;
  workAlreadyCompleted: string[];
  supplierName: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface OperatingOutlook {
  expectedSales: number | null;
  expectedSalesContext: string | null;
  prepReadiness: "ready" | "gaps" | "unknown";
  prepReadinessDetail: string;
  staffingCoverage: "covered" | "gap" | "unknown";
  staffingDetail: string;
  deliveryStatus: "none" | "expected" | "overdue" | "unknown";
  deliveryDetail: string;
  menuRisks: Array<{ itemName: string; label: InventoryHealthLabel; detail: string }>;
  supplierCutoffDeadlines: string[];
  preventableLoss: string | null;
}

export interface MonitoringRow {
  id: string;
  title: string;
  detail: string;
  startedAt: string;
  status: "monitoring" | "waiting";
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}

export interface OperatingBrief {
  restaurantId: string;
  restaurantName: string;
  operatingDate: string;
  generatedAt: string;
  restaurantStatus: {
    status: RestaurantPulseStatus;
    summary: string;
    lastUpdated: string;
    dataFreshness: DataFreshnessDescriptor;
    confidence: number;
    confidenceRationale: string;
    topRisk: string | null;
    topOpportunity: string | null;
    nextDecisionDeadline: string | null;
  };
  sinceYouWereAway: ActivityEvent[];
  liveActivity: ActivityEvent[];
  needsApproval: OperatingBriefApprovalCard[];
  outlook: OperatingOutlook;
  miseIsWatching: MonitoringRow[];
  activityWindowSummary: ActivityWindowSummary | null;
  demoLabeled: boolean;
}

export interface OperatingBriefInventoryOutlook {
  item: InventoryItem;
  prediction: InventoryPrediction;
}

export interface OperatingBriefInput {
  restaurant: Restaurant;
  operatingDate: string;
  generatedAt?: string;
  lastSeenAt?: string | null;
  sales: readonly PosSale[];
  inventoryItems: readonly InventoryItem[];
  recommendations: readonly PurchaseRecommendation[];
  orders: readonly SupplierOrder[];
  insights: readonly Insight[];
  findings?: readonly OperationalFinding[];
  activityEvents?: readonly ActivityEvent[];
  miseActions?: readonly MiseAction[];
  inventoryOutlooks?: readonly OperatingBriefInventoryOutlook[];
  demoLabeled?: boolean;
}

function requireScoped<T extends { restaurant_id: string }>(
  rows: readonly T[],
  restaurantId: string,
  label: string
) {
  if (rows.some((row) => row.restaurant_id !== restaurantId)) {
    throw new Error(`${label} failed restaurant scope validation.`);
  }
  return rows;
}

function hoursBetween(laterIso: string, earlierIso: string) {
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return (later - earlier) / (60 * 60 * 1000);
}

function buildDataFreshness(input: OperatingBriefInput, generatedAt: string): DataFreshnessDescriptor {
  const missingData: string[] = [];
  if (input.sales.length === 0) missingData.push("POS sales");
  if (input.inventoryItems.length === 0) missingData.push("inventory counts");
  if ((input.inventoryOutlooks?.length ?? 0) === 0 && input.inventoryItems.length > 0) {
    missingData.push("inventory projections");
  }

  // Physical-inventory freshness comes only from verified count evidence carried on
  // the projection. `inventory_items.last_updated` also moves for policy, cost, and
  // supplier edits, so it must never make an uncounted shelf look current.
  const latestInventory = (input.inventoryOutlooks ?? [])
    .map((outlook) => outlook.prediction.countedAt)
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort()
    .at(-1);
  if (input.inventoryItems.length > 0 && !latestInventory) {
    missingData.push("verified inventory counts");
  }
  const latestSale = input.sales
    .map((sale) => sale.created_at)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort()
    .at(-1);
  const asOf = latestInventory && latestSale
    ? latestInventory > latestSale
      ? latestInventory
      : latestSale
    : latestInventory ?? latestSale ?? generatedAt;
  const ageHours = hoursBetween(generatedAt, asOf);

  if (missingData.length > 0) {
    return {
      state: "incomplete",
      asOf,
      label: `Incomplete: missing ${missingData.join(", ")}.`,
      missingData
    };
  }
  if (ageHours !== null && ageHours > 36) {
    return {
      state: "stale",
      asOf,
      label: `Last operational update was about ${Math.round(ageHours)} hours ago.`,
      missingData
    };
  }
  if (ageHours === null) {
    return {
      state: "unknown",
      asOf,
      label: "Data freshness could not be determined.",
      missingData
    };
  }
  return {
    state: "fresh",
    asOf,
    label: "Operational data is current enough for service decisions.",
    missingData
  };
}

function recommendationConfidence(
  input: OperatingBriefInput,
  recommendation: PurchaseRecommendation
): { score: number | null; rationale: string } {
  const outlook = (input.inventoryOutlooks ?? []).find(
    (entry) => entry.item.id === recommendation.inventory_item_id
  );
  if (!outlook) {
    return {
      score: null,
      rationale: "Confidence is unavailable until Mise can calculate this item's demand and count freshness."
    };
  }

  // Verified count age only. An unverified item scores as "older or unknown".
  const countAgeHours = outlook.prediction.countAgeHours;
  let score = 0.25;
  const reasons: string[] = [];
  if (outlook.prediction.historySource === "restaurant_history") {
    score += Math.min(0.3, 0.12 + outlook.prediction.historySampleDays * 0.02);
    reasons.push(`${outlook.prediction.historySampleDays} restaurant service-day samples`);
  } else if (outlook.prediction.historySource === "demo_fallback") {
    score += 0.12;
    reasons.push("a labeled demo demand pattern");
  } else if (outlook.prediction.historySource === "current_day") {
    score += 0.1;
    reasons.push("current-day mapped sales only");
  } else {
    reasons.push("limited demand history");
  }
  if (countAgeHours !== null && countAgeHours <= 24) {
    score += 0.2;
    reasons.push("an inventory count updated within 24 hours");
  } else if (countAgeHours !== null && countAgeHours <= 72) {
    score += 0.1;
    reasons.push("an inventory count updated within 72 hours");
  } else {
    reasons.push("an older or unknown inventory count");
  }
  if (input.sales.length > 0) score += 0.1;
  if (
    outlook.prediction.projectedStatus === "Critical" ||
    outlook.prediction.projectedStatus === "Low"
  ) {
    score += 0.1;
    reasons.push("projected coverage below the reorder threshold");
  }
  return {
    score: Number(Math.min(0.92, score).toFixed(2)),
    rationale: `Based on ${reasons.join(", ")}.`
  };
}

function buildApprovalCards(input: OperatingBriefInput): OperatingBriefApprovalCard[] {
  const pending = input.recommendations.filter((recommendation) => recommendation.status === "pending");
  const coveredRecommendationIds = new Set(pending.map((recommendation) => recommendation.id));
  const cards: OperatingBriefApprovalCard[] = pending.map((recommendation) => {
    const confidence = recommendationConfidence(input, recommendation);
    return {
      id: `approval_rec_${recommendation.id}`,
      recommendationId: recommendation.id,
      actionId: null,
      orderId: null,
      findingId: null,
      title: `Approve ${recommendation.item_name} reorder`,
      decision: `Approve ${recommendation.recommended_quantity} ${recommendation.unit} from ${recommendation.supplier_name}`,
      whyItMatters: recommendation.reason,
      recommendedAction: `Order ${recommendation.recommended_quantity} ${recommendation.unit} from ${recommendation.supplier_name}`,
      deadline: null,
      confidence: confidence.score,
      confidenceRationale: confidence.rationale,
      expectedOperationalImpact: `Protects ${recommendation.item_name} availability through the next service window.`,
      estimatedFinancialImpact: null,
      riskIfIgnored: `Ignoring this can force an 86 or emergency purchase for ${recommendation.item_name}.`,
      workAlreadyCompleted: [
        "Compared current quantity with mapped demand",
        "Prepared a recommended reorder quantity"
      ],
      supplierName: recommendation.supplier_name,
      quantity: recommendation.recommended_quantity,
      unit: recommendation.unit
    };
  });

  const draftOrderIds = new Set(
    input.orders
      .filter((order) => order.restaurant_id === input.restaurant.id && order.status === "draft")
      .map((order) => order.id)
  );

  for (const action of input.miseActions ?? []) {
    if (action.restaurantId !== input.restaurant.id) {
      throw new Error("Mise actions failed restaurant scope validation.");
    }
    if (action.status !== "waiting_for_approval") continue;
    if (action.recommendationId && coveredRecommendationIds.has(action.recommendationId)) continue;
    const impact = action.expectedImpact ?? {};
    if (action.actionType === "send_supplier_order") {
      const orderId = typeof impact.orderId === "string" ? impact.orderId : null;
      if (!orderId || !draftOrderIds.has(orderId)) continue;
    }
    const title =
      typeof impact.title === "string" && impact.title.trim()
        ? impact.title
        : action.actionType === "send_supplier_order"
          ? `Approve send to ${typeof impact.supplierName === "string" ? impact.supplierName : "supplier"}`
          : `Approve ${action.actionType.replace(/_/g, " ")}`;
    cards.push({
      id: `approval_action_${action.id}`,
      recommendationId: action.recommendationId,
      actionId: action.id,
      orderId: typeof impact.orderId === "string" ? impact.orderId : null,
      findingId: null,
      title,
      decision: `Approve prepared action (${action.actionType})`,
      whyItMatters: "Mise prepared this action and is waiting for an explicit operator decision.",
      recommendedAction: "Approve to continue, or reject to cancel execution.",
      deadline: null,
      confidence: null,
      confidenceRationale: null,
      expectedOperationalImpact:
        typeof impact.summary === "string" ? impact.summary : "Continues the prepared operational workflow.",
      estimatedFinancialImpact:
        action.financialImpactCents === null
          ? null
          : `${(action.financialImpactCents / 100).toFixed(2)} estimated impact`,
      riskIfIgnored: "Leaving this undecided blocks the prepared workflow.",
      workAlreadyCompleted: ["Prepared the action with evidence", "Checked autonomy and permission gates"],
      supplierName: typeof impact.supplierName === "string" ? impact.supplierName : null,
      quantity: null,
      unit: null
    });
  }

  for (const finding of input.findings ?? []) {
    if (finding.managerFeedback.state !== "unreviewed") continue;
    if (finding.severity === "info") continue;
    cards.push({
      id: `approval_finding_${finding.id}`,
      recommendationId: null,
      actionId: null,
      orderId: null,
      findingId: finding.id,
      title: finding.title,
      decision: finding.recommendedAction,
      whyItMatters: finding.explanation,
      recommendedAction: finding.managerFeedback.effectiveRecommendedAction,
      deadline: null,
      confidence: finding.confidence.score,
      confidenceRationale: finding.confidence.rationale,
      expectedOperationalImpact: finding.affectedWorkflow,
      estimatedFinancialImpact: null,
      riskIfIgnored: finding.explanation,
      workAlreadyCompleted: finding.evidence.slice(0, 3).map((entry) => entry.summary),
      supplierName: null,
      quantity: null,
      unit: null
    });
  }

  return cards;
}

function deriveActivityFromStructuredInputs(input: OperatingBriefInput): ActivityEvent[] {
  const provided = [...(input.activityEvents ?? [])];
  assertTenantScoped(provided, input.restaurant.id);

  const derived: ActivityEvent[] = [];
  for (const recommendation of input.recommendations) {
    if (recommendation.status !== "pending") continue;
    // Pending approvals are real prepared work — safe to project as activity.
    derived.push(fromPurchaseRecommendationCreated(recommendation));
  }

  for (const finding of input.findings ?? []) {
    if (finding.restaurantId !== input.restaurant.id) {
      throw new Error("Findings failed restaurant scope validation.");
    }
  }

  return dedupeActivityEvents([...provided, ...derived]);
}

function buildOutlook(input: OperatingBriefInput): OperatingOutlook {
  const todaySales = input.sales.filter(
    (sale) => sale.restaurant_id === input.restaurant.id && sale.sale_date === input.operatingDate
  );
  const expectedSales = todaySales.reduce((sum, sale) => sum + sale.net_sales, 0);
  const outlooks = input.inventoryOutlooks ?? [];
  const menuRisks = outlooks
    .map(({ item, prediction }) => {
      const label = resolveInventoryHealthLabel({
        legacyStatus: prediction.projectedStatus,
        projectedQuantity: prediction.projectedQuantity,
        daysCoverage: prediction.daysCoverage,
        demandTrend: prediction.demandTrend
      });
      if (label === "Healthy" || label === "Learning") return null;
      return {
        itemName: item.item_name,
        label,
        detail: prediction.whyItMatters
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .slice(0, 5);

  const draftOrders = input.orders.filter((order) => order.status === "draft");
  const sentOrders = input.orders.filter((order) => order.status === "sent");
  const criticalCount = outlooks.filter(
    ({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedQuantity <= 0
  ).length;

  return {
    expectedSales: todaySales.length > 0 ? expectedSales : null,
    expectedSalesContext:
      todaySales.length > 0
        ? `Recorded net sales so far on ${input.operatingDate}.`
        : "Connect or sync POS sales to show expected sales context.",
    prepReadiness: criticalCount > 0 ? "gaps" : outlooks.length > 0 ? "ready" : "unknown",
    prepReadinessDetail:
      criticalCount > 0
        ? `${criticalCount} ingredient${criticalCount === 1 ? "" : "s"} may not cover upcoming demand.`
        : outlooks.length > 0
          ? "No critical ingredient coverage gaps in the current projection."
          : "Prep readiness is unavailable until inventory projections exist.",
    staffingCoverage: "unknown",
    staffingDetail: "Staffing coverage requires schedule integration before Mise can assess it.",
    deliveryStatus: sentOrders.length > 0 ? "expected" : draftOrders.length > 0 ? "unknown" : "none",
    deliveryDetail:
      sentOrders.length > 0
        ? `${sentOrders.length} sent order${sentOrders.length === 1 ? "" : "s"} awaiting delivery confirmation.`
        : draftOrders.length > 0
          ? `${draftOrders.length} draft order${draftOrders.length === 1 ? "" : "s"} prepared but not sent.`
          : "No open supplier deliveries are currently tracked.",
    menuRisks,
    supplierCutoffDeadlines: [],
    preventableLoss:
      menuRisks.length > 0
        ? "Preventable stockouts are possible on items already below coverage thresholds."
        : null
  };
}

function buildMonitoringRows(
  input: OperatingBriefInput,
  approvals: readonly OperatingBriefApprovalCard[],
  generatedAt: string
): MonitoringRow[] {
  const rows: MonitoringRow[] = [];

  for (const outlook of (input.inventoryOutlooks ?? []).slice(0, 8)) {
    const label = resolveInventoryHealthLabel({
      legacyStatus: outlook.prediction.projectedStatus,
      projectedQuantity: outlook.prediction.projectedQuantity,
      daysCoverage: outlook.prediction.daysCoverage,
      demandTrend: outlook.prediction.demandTrend
    });
    if (label === "AtRisk" || label === "Critical" || label === "Watch") {
      rows.push({
        id: `watch_inventory_${outlook.item.id}`,
        title: `Tracking ${outlook.item.item_name} usage`,
        detail: outlook.prediction.coverageLabel,
        startedAt: outlook.prediction.countedAt ?? generatedAt,
        status: "monitoring",
        relatedEntityType: "inventory_item",
        relatedEntityId: outlook.item.id
      });
    }
  }

  for (const order of input.orders.filter((entry) => entry.status === "sent").slice(0, 5)) {
    rows.push({
      id: `watch_order_${order.id}`,
      title: `Waiting for ${order.supplier_name} confirmation`,
      detail: order.delivery_date
        ? `Expected delivery ${order.delivery_date}.`
        : "Delivery date not yet confirmed.",
      startedAt: order.created_at,
      status: "waiting",
      relatedEntityType: "supplier_order",
      relatedEntityId: order.id
    });
  }

  if (approvals.length > 0) {
    rows.push({
      id: "watch_approvals",
      title: "Watching open approval deadlines",
      detail: `${approvals.length} decision${approvals.length === 1 ? "" : "s"} still need an owner.`,
      startedAt: generatedAt,
      status: "waiting",
      relatedEntityType: null,
      relatedEntityId: null
    });
  }

  return rows.slice(0, 8);
}

/** Fail closed: unknown freshness must never read as an all-clear pulse. */
export function resolveRestaurantPulseStatus(input: {
  criticalCount: number;
  pendingApprovals: number;
  freshnessState: DataFreshnessDescriptor["state"];
  urgentFindings: number;
}): RestaurantPulseStatus {
  if (
    input.criticalCount > 0 ||
    input.urgentFindings > 0 ||
    input.freshnessState === "incomplete"
  ) {
    return "at_risk";
  }
  if (
    input.pendingApprovals > 0 ||
    input.freshnessState === "stale" ||
    input.freshnessState === "unknown"
  ) {
    return "attention_needed";
  }
  return "on_track";
}

export function buildOperatingBrief(input: OperatingBriefInput): OperatingBrief {
  const restaurantId = input.restaurant.id.trim();
  if (!restaurantId) throw new Error("Operating brief requires a restaurant id.");

  requireScoped(input.sales, restaurantId, "Sales");
  requireScoped(input.inventoryItems, restaurantId, "Inventory");
  requireScoped(input.recommendations, restaurantId, "Recommendations");
  requireScoped(input.orders, restaurantId, "Orders");
  requireScoped(input.insights, restaurantId, "Insights");

  const generatedAt = input.generatedAt
    ? new Date(input.generatedAt).toISOString()
    : new Date().toISOString();
  const activity = deriveActivityFromStructuredInputs(input);
  const approvals = buildApprovalCards(input);
  const freshness = buildDataFreshness(input, generatedAt);
  const outlook = buildOutlook(input);
  const criticalCount = (input.inventoryOutlooks ?? []).filter(
    ({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedQuantity <= 0
  ).length;
  const urgentFindings = (input.findings ?? []).filter((finding) => finding.severity === "urgent").length;
  const status = resolveRestaurantPulseStatus({
    criticalCount,
    pendingApprovals: approvals.length,
    freshnessState: freshness.state,
    urgentFindings
  });

  const lastSeenAt = input.lastSeenAt ? new Date(input.lastSeenAt).toISOString() : null;
  const sinceYouWereAway = lastSeenAt
    ? activity.filter(
        (event) =>
          event.occurredAt >= lastSeenAt &&
          (event.status === "completed" ||
            event.status === "confirmed" ||
            event.status === "sent" ||
            event.status === "prepared")
      )
    : filterActivities(activity, "completed_by_mise").slice(0, 12);

  const liveActivity = [...activity].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const freshnessBlocksClearPulse =
    freshness.state === "incomplete" ||
    freshness.state === "stale" ||
    freshness.state === "unknown";
  const topRisk =
    outlook.menuRisks[0]?.detail ??
    approvals[0]?.riskIfIgnored ??
    (freshnessBlocksClearPulse ? freshness.label : null);
  const topOpportunity =
    approvals[0]?.expectedOperationalImpact ??
    (input.insights.find((insight) => insight.severity !== "urgent")?.recommended_action ?? null);

  const confidenceBase =
    freshness.state === "fresh" ? 0.82 : freshness.state === "stale" ? 0.58 : freshness.state === "incomplete" ? 0.34 : 0.45;
  const confidence = Number(
    Math.max(0.2, Math.min(0.95, confidenceBase - criticalCount * 0.03 + Math.min(0.08, activity.length * 0.01))).toFixed(2)
  );

  const summary =
    status === "on_track"
      ? `Service looks prepared. Mise reviewed sales, inventory, and supplier coverage${
          approvals.length > 0 ? `, and ${approvals.length} decision${approvals.length === 1 ? "" : "s"} still need approval` : ""
        }.`
      : status === "attention_needed"
        ? freshness.state === "stale" || freshness.state === "unknown"
          ? approvals.length > 0
            ? `Attention needed: ${approvals.length} approval${approvals.length === 1 ? "" : "s"} are open, and ${freshness.label}`
            : freshness.label
          : `Attention needed: ${approvals.length} approval${approvals.length === 1 ? "" : "s"} and ${outlook.menuRisks.length} inventory watch item${outlook.menuRisks.length === 1 ? "" : "s"} are open.`
        : (() => {
          const issueCount = criticalCount || urgentFindings || approvals.length;
          return `At risk: ${issueCount} operational issue${issueCount === 1 ? "" : "s"} ${
            issueCount === 1 ? "needs" : "need"
          } action before the next service pressure point.`;
        })();

  return {
    restaurantId,
    restaurantName: input.restaurant.name,
    operatingDate: input.operatingDate,
    generatedAt,
    restaurantStatus: {
      status,
      summary,
      lastUpdated: freshness.asOf,
      dataFreshness: freshness,
      confidence,
      confidenceRationale:
        freshness.state === "fresh"
          ? "Confidence reflects current inventory and sales coverage with no major data gaps."
          : freshness.label,
      topRisk,
      topOpportunity,
      nextDecisionDeadline: approvals.find((card) => card.deadline)?.deadline ?? null
    },
    sinceYouWereAway,
    liveActivity,
    needsApproval: approvals,
    outlook,
    miseIsWatching: buildMonitoringRows(input, approvals, generatedAt),
    activityWindowSummary: lastSeenAt ? summarizeActivityWindow(activity, lastSeenAt) : null,
    demoLabeled: Boolean(input.demoLabeled)
  };
}
