import type { AppLocale, MessageKey, MessageValues } from "../../i18n/catalog";
import { translate } from "../../i18n/catalog";
import { formatLocalizedNumber } from "../../i18n/formatters";
import { localizeInventoryCoverage } from "../../i18n/inventoryPresentation";
import type {
  DataFreshnessDescriptor,
  DataFreshnessMissingCode,
  MonitoringRow,
  OperatingBrief,
  OperatingBriefApprovalCard,
  RecommendationConfidenceReason,
  RecommendationConfidenceReasonCode
} from "../domain/operatingBrief";
import type { MiseActionType } from "../domain/miseActions";

export interface PresentedOperatingBriefApproval {
  title: string;
  recommendedAction: string;
  whyItMatters: string;
  decision: string;
  expectedOperationalImpact: string;
  riskIfIgnored: string;
  workAlreadyCompleted: string[];
  /** Localized rationale only (no score). */
  confidenceRationale: string | null;
  /** Localized "score · rationale" line for Home approval cards. */
  confidenceLine: string | null;
}

export interface PresentedMonitoringRow {
  title: string;
  detail: string;
}

export interface PresentedRestaurantStatusEvidence {
  freshnessLabel: string;
  confidenceRationale: string;
  confidenceScore: string;
  /** Compact provenance line for StatusNotice meta. */
  metaLine: string;
}

type Translate = (key: MessageKey, values?: MessageValues) => string;

function tFor(locale: AppLocale): Translate {
  return (key, values) => translate(locale, key, values);
}

function formatQuantity(locale: AppLocale, quantity: number | null): string | null {
  if (quantity === null || !Number.isFinite(quantity)) return null;
  return formatLocalizedNumber(locale, quantity, { maximumFractionDigits: 2 });
}

function formatConfidencePercent(locale: AppLocale, score: number): string {
  const percent = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return `${formatLocalizedNumber(locale, percent, { maximumFractionDigits: 0 })}%`;
}

const ACTION_TYPE_KEYS: Partial<Record<MiseActionType, MessageKey>> = {
  send_supplier_order: "home.approvals.actionType.send_supplier_order",
  change_schedule: "home.approvals.actionType.change_schedule",
  contact_external_party: "home.approvals.actionType.contact_external_party",
  modify_menu_availability: "home.approvals.actionType.modify_menu_availability",
  change_price: "home.approvals.actionType.change_price",
  send_staff_communication: "home.approvals.actionType.send_staff_communication",
  send_supplier_communication: "home.approvals.actionType.send_supplier_communication",
  issue_refund_or_credit: "home.approvals.actionType.issue_refund_or_credit",
  change_permissions_or_rules: "home.approvals.actionType.change_permissions_or_rules",
  prepare_supplier_order_draft: "home.approvals.actionType.prepare_supplier_order_draft",
  prepare_inventory_adjustment: "home.approvals.actionType.prepare_inventory_adjustment",
  create_internal_task: "home.approvals.actionType.create_internal_task",
  recalculate_forecast: "home.approvals.actionType.recalculate_forecast",
  update_prep_recommendation: "home.approvals.actionType.update_prep_recommendation",
  schedule_inventory_count: "home.approvals.actionType.schedule_inventory_count",
  remind_employee: "home.approvals.actionType.remind_employee",
  flag_menu_item_internally: "home.approvals.actionType.flag_menu_item_internally",
  measure_outcome: "home.approvals.actionType.measure_outcome"
};

const CONFIDENCE_REASON_KEYS: Record<
  Exclude<RecommendationConfidenceReasonCode, "unavailable">,
  MessageKey
> = {
  restaurant_history_samples: "home.approvals.confidence.reason.restaurantHistory",
  demo_demand_pattern: "home.approvals.confidence.reason.demoPattern",
  current_day_sales: "home.approvals.confidence.reason.currentDaySales",
  limited_demand_history: "home.approvals.confidence.reason.limitedHistory",
  count_within_24h: "home.approvals.confidence.reason.count24h",
  count_within_72h: "home.approvals.confidence.reason.count72h",
  count_older_or_unknown: "home.approvals.confidence.reason.countOlder",
  coverage_below_reorder: "home.approvals.confidence.reason.belowReorder"
};

const FRESHNESS_MISSING_KEYS: Record<DataFreshnessMissingCode, MessageKey> = {
  pos_sales: "home.status.freshness.missing.pos_sales",
  inventory_counts: "home.status.freshness.missing.inventory_counts",
  inventory_projections: "home.status.freshness.missing.inventory_projections",
  verified_inventory_counts: "home.status.freshness.missing.verified_inventory_counts"
};

function actionTypeLabel(t: Translate, actionType: string | null): string {
  if (!actionType) return t("home.approvals.actionType.fallback");
  const key = ACTION_TYPE_KEYS[actionType as MiseActionType];
  return key ? t(key) : actionType.replace(/_/g, " ");
}

function joinReasonFragments(locale: AppLocale, parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0] ?? "";
  try {
    const tag = locale === "zh-Hans" ? "zh-Hans" : locale;
    return new Intl.ListFormat(tag, { style: "long", type: "conjunction" }).format(parts);
  } catch {
    return parts.join(", ");
  }
}

function presentConfidenceReason(
  locale: AppLocale,
  t: Translate,
  reason: RecommendationConfidenceReason
): string {
  if (reason.code === "unavailable") {
    return t("home.approvals.confidence.unavailable");
  }
  const key = CONFIDENCE_REASON_KEYS[reason.code];
  if (reason.code === "restaurant_history_samples") {
    return t(key, {
      count: formatLocalizedNumber(locale, reason.sampleDays ?? 0, { maximumFractionDigits: 0 })
    });
  }
  return t(key);
}

/**
 * Localizes structured recommendation confidence fragments. Findings keep stored prose.
 */
export function presentRecommendationConfidenceRationale(
  locale: AppLocale,
  reasons: readonly RecommendationConfidenceReason[] | null | undefined,
  fallback: string | null
): string | null {
  if (!reasons || reasons.length === 0) return fallback;
  const t = tFor(locale);
  if (reasons.length === 1 && reasons[0]?.code === "unavailable") {
    return t("home.approvals.confidence.unavailable");
  }
  const fragments = reasons
    .filter((reason) => reason.code !== "unavailable")
    .map((reason) => presentConfidenceReason(locale, t, reason));
  if (fragments.length === 0) return fallback;
  return t("home.approvals.confidence.basedOn", {
    reasons: joinReasonFragments(locale, fragments)
  });
}

function withConfidenceScore(
  locale: AppLocale,
  score: number | null,
  rationale: string | null
): string | null {
  if (!rationale) return null;
  if (score === null || !Number.isFinite(score)) return rationale;
  const t = tFor(locale);
  return t("home.approvals.confidence.withScore", {
    score: formatConfidencePercent(locale, score),
    rationale
  });
}

/**
 * Localizes structured Home approval copy. Keeps stored tenant prose
 * (`recommendation.reason`, finding explanations, custom action titles) unchanged.
 */
export function presentOperatingBriefApproval(
  locale: AppLocale,
  card: OperatingBriefApprovalCard
): PresentedOperatingBriefApproval {
  const t = tFor(locale);

  if (card.source === "recommendation") {
    const item = card.itemName?.trim() || t("home.approvals.item.fallback");
    const supplier = card.supplierName?.trim() || t("home.approvals.supplier.fallback");
    const quantity = formatQuantity(locale, card.quantity);
    const unit = card.unit?.trim() || "";
    const quantityLabel =
      quantity && unit
        ? t("home.approvals.quantity.withUnit", { quantity, unit })
        : quantity ?? unit;
    const confidenceRationale = presentRecommendationConfidenceRationale(
      locale,
      card.confidenceReasons,
      card.confidenceRationale
    );

    return {
      title: t("home.approvals.card.reorderTitle", { item }),
      recommendedAction: quantityLabel
        ? t("home.approvals.card.orderAction", {
            quantity: quantityLabel,
            supplier
          })
        : t("home.approvals.card.orderAction.fallback", { supplier }),
      whyItMatters: card.whyItMatters,
      decision: quantityLabel
        ? t("home.approvals.card.approveDecision", {
            quantity: quantityLabel,
            supplier
          })
        : t("home.approvals.card.approveDecision.fallback", { supplier }),
      expectedOperationalImpact: t("home.approvals.card.impact.protects", { item }),
      riskIfIgnored: t("home.approvals.card.risk.stockout", { item }),
      workAlreadyCompleted: [
        t("home.approvals.card.work.comparedDemand"),
        t("home.approvals.card.work.preparedQuantity")
      ],
      confidenceRationale,
      confidenceLine: withConfidenceScore(locale, card.confidence, confidenceRationale)
    };
  }

  if (card.source === "action") {
    const supplier = card.supplierName?.trim() || t("home.approvals.supplier.fallback");
    const actionLabel = actionTypeLabel(t, card.actionType);
    const title = card.titleIsStructured
      ? card.actionType === "send_supplier_order"
        ? t("home.approvals.card.approveSend", { supplier })
        : t("home.approvals.card.approveAction", { action: actionLabel })
      : card.title;

    const impactIsTemplate =
      !card.expectedOperationalImpact.trim() ||
      card.expectedOperationalImpact === "Continues the prepared operational workflow.";

    return {
      title,
      recommendedAction: t("home.approvals.card.action.recommended"),
      whyItMatters: t("home.approvals.card.action.why"),
      decision: t("home.approvals.card.action.decision", { action: actionLabel }),
      expectedOperationalImpact: impactIsTemplate
        ? t("home.approvals.card.action.impact")
        : card.expectedOperationalImpact,
      riskIfIgnored: t("home.approvals.card.action.risk"),
      workAlreadyCompleted: [
        t("home.approvals.card.action.work.prepared"),
        t("home.approvals.card.action.work.gates")
      ],
      confidenceRationale: null,
      confidenceLine: null
    };
  }

  // Findings and any unknown source keep stored evidence prose.
  const confidenceRationale = card.confidenceRationale;
  return {
    title: card.title,
    recommendedAction: card.recommendedAction,
    whyItMatters: card.whyItMatters,
    decision: card.decision,
    expectedOperationalImpact: card.expectedOperationalImpact,
    riskIfIgnored: card.riskIfIgnored,
    workAlreadyCompleted: [...card.workAlreadyCompleted],
    confidenceRationale,
    confidenceLine: withConfidenceScore(locale, card.confidence, confidenceRationale)
  };
}

/**
 * Localizes structured data-freshness labels for the Home restaurant-status card.
 */
export function presentDataFreshnessLabel(
  locale: AppLocale,
  freshness: DataFreshnessDescriptor
): string {
  const t = tFor(locale);
  if (freshness.state === "incomplete") {
    const items = joinReasonFragments(
      locale,
      freshness.missingCodes.map((code) => t(FRESHNESS_MISSING_KEYS[code]))
    );
    return t("home.status.freshness.incomplete", { items });
  }
  if (freshness.state === "stale") {
    const hours = Math.round(freshness.ageHours ?? 0);
    return t("home.status.freshness.stale", {
      hours: formatLocalizedNumber(locale, hours, { maximumFractionDigits: 0 })
    });
  }
  if (freshness.state === "unknown") {
    return t("home.status.freshness.unknown");
  }
  return t("home.status.freshness.fresh");
}

/**
 * Localizes restaurant-status confidence rationale from structured freshness.
 * English `confidenceRationale` remains available for audits/back-compat.
 */
export function presentRestaurantStatusConfidenceRationale(
  locale: AppLocale,
  status: Pick<OperatingBrief["restaurantStatus"], "dataFreshness" | "confidenceRationale">
): string {
  if (status.dataFreshness.state === "fresh") {
    return tFor(locale)("home.status.confidence.rationale.fresh");
  }
  return presentDataFreshnessLabel(locale, status.dataFreshness);
}

/**
 * Builds localized freshness + confidence provenance for StatusNotice meta.
 */
export function presentRestaurantStatusEvidence(
  locale: AppLocale,
  status: OperatingBrief["restaurantStatus"]
): PresentedRestaurantStatusEvidence {
  const t = tFor(locale);
  const freshnessLabel = presentDataFreshnessLabel(locale, status.dataFreshness);
  const confidenceRationale = presentRestaurantStatusConfidenceRationale(locale, status);
  const confidenceScore = formatConfidencePercent(locale, status.confidence);
  const freshnessLine = t("home.status.freshness", { label: freshnessLabel });
  const confidenceLine = t("home.status.confidence", { score: confidenceScore });
  return {
    freshnessLabel,
    confidenceRationale,
    confidenceScore,
    metaLine: t("home.status.meta", {
      freshness: freshnessLine,
      confidence: confidenceLine
    })
  };
}

export function presentOperatingBriefPulseSummary(
  locale: AppLocale,
  brief: Pick<OperatingBrief, "restaurantStatus" | "needsApproval" | "outlook">
): string {
  const t = tFor(locale);
  const approvals = brief.needsApproval.length;
  const watchItems = brief.outlook.menuRisks.length;
  const status = brief.restaurantStatus.status;

  if (status === "on_track") {
    return approvals > 0
      ? t(
          approvals === 1
            ? "home.pulse.summary.onTrack.withApprovals.one"
            : "home.pulse.summary.onTrack.withApprovals.other",
          { count: approvals }
        )
      : t("home.pulse.summary.onTrack");
  }

  if (status === "attention_needed") {
    return t("home.pulse.summary.attention", {
      approvals,
      watchItems
    });
  }

  const issueCount = Math.max(approvals, watchItems, 1);
  return t(
    issueCount === 1 ? "home.pulse.summary.atRisk.one" : "home.pulse.summary.atRisk.other",
    { count: issueCount }
  );
}

export function presentOperatingBriefMonitoringRow(
  locale: AppLocale,
  row: MonitoringRow
): PresentedMonitoringRow {
  const t = tFor(locale);

  if (row.kind === "inventory") {
    const item = row.subjectName?.trim() || t("home.approvals.item.fallback");
    const coverage = row.inventoryCoverage
      ? localizeInventoryCoverage(t, (value, options) => formatLocalizedNumber(locale, value, options), {
          daysCoverage: row.inventoryCoverage.daysCoverage,
          averageDailyUsage: row.inventoryCoverage.averageDailyUsage,
          projectedQuantity: row.inventoryCoverage.projectedQuantity,
          parLevel: row.inventoryCoverage.parLevel
        })
      : row.detail;
    return {
      title: t("home.watching.inventory.title", { item }),
      detail: coverage
    };
  }

  if (row.kind === "supplier_order") {
    const supplier = row.subjectName?.trim() || t("home.approvals.supplier.fallback");
    return {
      title: t("home.watching.order.title", { supplier }),
      detail: row.deliveryDate
        ? t("home.watching.order.detail.expected", { date: row.deliveryDate })
        : t("home.watching.order.detail.unconfirmed")
    };
  }

  const count = row.approvalCount ?? 0;
  return {
    title: t("home.watching.approvals.title"),
    detail: t(
      count === 1 ? "home.watching.approvals.detail.one" : "home.watching.approvals.detail.other",
      { count }
    )
  };
}
