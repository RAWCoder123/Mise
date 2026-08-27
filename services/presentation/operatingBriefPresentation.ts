import type { AppLocale, MessageKey, MessageValues } from "../../i18n/catalog";
import { translate } from "../../i18n/catalog";
import { formatLocalizedNumber } from "../../i18n/formatters";
import type {
  MonitoringRow,
  OperatingBrief,
  OperatingBriefApprovalCard
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
  confidenceRationale: string | null;
}

export interface PresentedMonitoringRow {
  title: string;
  detail: string;
}

type Translate = (key: MessageKey, values?: MessageValues) => string;

function tFor(locale: AppLocale): Translate {
  return (key, values) => translate(locale, key, values);
}

function formatQuantity(locale: AppLocale, quantity: number | null): string | null {
  if (quantity === null || !Number.isFinite(quantity)) return null;
  return formatLocalizedNumber(locale, quantity, { maximumFractionDigits: 2 });
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

function actionTypeLabel(t: Translate, actionType: string | null): string {
  if (!actionType) return t("home.approvals.actionType.fallback");
  const key = ACTION_TYPE_KEYS[actionType as MiseActionType];
  return key ? t(key) : actionType.replace(/_/g, " ");
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
      confidenceRationale: card.confidenceRationale
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
      confidenceRationale: card.confidenceRationale
    };
  }

  // Findings and any unknown source keep stored evidence prose.
  return {
    title: card.title,
    recommendedAction: card.recommendedAction,
    whyItMatters: card.whyItMatters,
    decision: card.decision,
    expectedOperationalImpact: card.expectedOperationalImpact,
    riskIfIgnored: card.riskIfIgnored,
    workAlreadyCompleted: [...card.workAlreadyCompleted],
    confidenceRationale: card.confidenceRationale
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
    return {
      title: t("home.watching.inventory.title", { item }),
      // Coverage labels remain prediction prose until inventory presentation is wired here.
      detail: row.detail
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
