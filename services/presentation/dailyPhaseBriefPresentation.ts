import type { MessageKey, MessageValues } from "../../i18n/catalog";
import type {
  DailyPhaseFinding,
  DailyPhaseFindingPresentation
} from "../domain/dailyPhaseBrief";

type Translate = (key: MessageKey, values?: MessageValues) => string;

/**
 * Exact unavailable-signal labels emitted by `buildDailyPhaseBriefs`.
 * Unknown values pass through so the UI never invents an operating signal.
 */
const UNAVAILABLE_SIGNAL_KEYS = {
  "yesterday closeout": "dailyPhaseBrief.signal.yesterdayCloseout",
  "staffing schedule": "dailyPhaseBrief.signal.staffingSchedule",
  "supplier cutoff times": "dailyPhaseBrief.signal.supplierCutoffTimes",
  "today sales forecast": "dailyPhaseBrief.signal.todaySalesForecast",
  "station assignments": "dailyPhaseBrief.signal.stationAssignments",
  "reservation load": "dailyPhaseBrief.signal.reservationLoad",
  "rush timing forecast": "dailyPhaseBrief.signal.rushTimingForecast",
  "sales forecast": "dailyPhaseBrief.signal.salesForecast",
  "forecast accuracy": "dailyPhaseBrief.signal.forecastAccuracy",
  "service issue feed": "dailyPhaseBrief.signal.serviceIssueFeed",
  "waste analysis": "dailyPhaseBrief.signal.wasteAnalysis"
} as const satisfies Record<string, MessageKey>;

export function presentUnavailableSignal(signal: string, t: Translate): string {
  if (Object.prototype.hasOwnProperty.call(UNAVAILABLE_SIGNAL_KEYS, signal)) {
    return t(UNAVAILABLE_SIGNAL_KEYS[signal as keyof typeof UNAVAILABLE_SIGNAL_KEYS]);
  }
  const trimmed = signal.trim();
  return trimmed || "—";
}

export function presentUnavailableSignals(
  signals: readonly string[],
  t: Translate
): string {
  return signals.map((signal) => presentUnavailableSignal(signal, t)).join(", ");
}

export interface PresentedDailyPhaseFinding {
  title: string;
  interpretation: string;
}

/**
 * Localizes structured daily-phase finding templates. Free-form upstream
 * tenant prose (task titles, memory copy, opportunity text) is interpolated
 * unchanged so the UI never invents operational facts.
 */
export function presentDailyPhaseFinding(
  finding: DailyPhaseFinding,
  t: Translate
): PresentedDailyPhaseFinding {
  if (!finding.presentation) {
    return { title: finding.title, interpretation: finding.interpretation };
  }
  return presentFromDescriptor(finding.presentation, t, finding);
}

function presentFromDescriptor(
  presentation: DailyPhaseFindingPresentation,
  t: Translate,
  fallback: DailyPhaseFinding
): PresentedDailyPhaseFinding {
  switch (presentation.kind) {
    case "start_with_task":
      return {
        title: t("dailyPhaseBrief.finding.startWithTask.title", {
          task: presentation.taskTitle
        }),
        interpretation: t("dailyPhaseBrief.finding.startWithTask.body", {
          why: presentation.why
        })
      };
    case "approvals":
      return {
        title: t(
          presentation.count === 1
            ? "dailyPhaseBrief.finding.approvals.title.one"
            : "dailyPhaseBrief.finding.approvals.title.other",
          { count: presentation.count }
        ),
        interpretation: t("dailyPhaseBrief.finding.approvals.body")
      };
    case "tasks_completed":
      return {
        title: t(
          presentation.count === 1
            ? "dailyPhaseBrief.finding.tasksCompleted.title.one"
            : "dailyPhaseBrief.finding.tasksCompleted.title.other",
          { count: presentation.count }
        ),
        interpretation: t("dailyPhaseBrief.finding.tasksCompleted.body")
      };
    case "prior_sales_baseline":
      return {
        title: t("dailyPhaseBrief.finding.priorSalesBaseline.title"),
        interpretation: presentSalesTrend(presentation, t)
      };
    case "carry_learning":
      return {
        title: t("dailyPhaseBrief.finding.carryLearning.title"),
        interpretation: presentation.memoryCopy
      };
    case "protect_opportunity":
      return {
        title: t("dailyPhaseBrief.finding.protectOpportunity.title"),
        interpretation: presentation.opportunity
      };
    case "next_readiness_move":
      return {
        title: t("dailyPhaseBrief.finding.nextReadinessMove.title", {
          task: presentation.taskTitle
        }),
        interpretation: t("dailyPhaseBrief.finding.nextReadinessMove.body", {
          effect: presentation.effect,
          verification: presentVerification(presentation.verificationMethod, t)
        })
      };
    case "ingredients_constrain":
      return {
        title: t(
          presentation.count === 1
            ? "dailyPhaseBrief.finding.ingredientsConstrain.title.one"
            : "dailyPhaseBrief.finding.ingredientsConstrain.title.other",
          { count: presentation.count }
        ),
        interpretation: presentation.detail
      };
    case "coverage_supports_prep":
      return {
        title: t("dailyPhaseBrief.finding.coverageSupportsPrep.title"),
        interpretation: presentation.detail
      };
    case "deliveries_logged":
      return {
        title: t(
          presentation.count === 1
            ? "dailyPhaseBrief.finding.deliveriesLogged.title.one"
            : "dailyPhaseBrief.finding.deliveriesLogged.title.other",
          { count: presentation.count }
        ),
        interpretation:
          presentation.mode === "received"
            ? t("dailyPhaseBrief.finding.deliveriesLogged.body.received")
            : presentation.awaitingDetail
      };
    case "tasks_need_verification":
      return {
        title: t(
          presentation.count === 1
            ? "dailyPhaseBrief.finding.tasksNeedVerification.title.one"
            : "dailyPhaseBrief.finding.tasksNeedVerification.title.other",
          { count: presentation.count }
        ),
        interpretation: t("dailyPhaseBrief.finding.tasksNeedVerification.body")
      };
    case "closing_progress":
      return presentClosingProgress(presentation, t);
    case "waste_gap":
      return {
        title: t("dailyPhaseBrief.finding.wasteGap.title"),
        interpretation: t("dailyPhaseBrief.finding.wasteGap.body")
      };
    case "waste_analyzed":
      return {
        title: t(
          presentation.eventCount === 1
            ? "dailyPhaseBrief.finding.wasteAnalyzed.title.one"
            : "dailyPhaseBrief.finding.wasteAnalyzed.title.other",
          { count: presentation.eventCount }
        ),
        interpretation: presentation.attentionItem
          ? t("dailyPhaseBrief.finding.wasteAnalyzed.body.attention", {
              item: presentation.attentionItem.itemName,
              days: presentation.attentionItem.dayCount
            })
          : t("dailyPhaseBrief.finding.wasteAnalyzed.body.keepRecording")
      };
    case "sales_moved":
      return {
        title: t("dailyPhaseBrief.finding.salesMoved.title"),
        interpretation: presentSalesTrend(presentation, t)
      };
    case "inventory_alerts_carry":
      return {
        title: t(
          presentation.count === 1
            ? "dailyPhaseBrief.finding.inventoryAlertsCarry.title.one"
            : "dailyPhaseBrief.finding.inventoryAlertsCarry.title.other",
          { count: presentation.count }
        ),
        interpretation: t("dailyPhaseBrief.finding.inventoryAlertsCarry.body")
      };
    case "supplier_follow_up":
      return {
        title: t(
          presentation.count === 1
            ? "dailyPhaseBrief.finding.supplierFollowUp.title.one"
            : "dailyPhaseBrief.finding.supplierFollowUp.title.other",
          { count: presentation.count }
        ),
        interpretation: t("dailyPhaseBrief.finding.supplierFollowUp.body")
      };
    case "closing_learning":
      return {
        title: t("dailyPhaseBrief.finding.closingLearning.title"),
        interpretation: presentation.memoryCopy
      };
    case "open_work":
      return {
        title: t(
          presentation.count === 1
            ? "dailyPhaseBrief.finding.openWork.title.one"
            : "dailyPhaseBrief.finding.openWork.title.other",
          { count: presentation.count }
        ),
        interpretation: t("dailyPhaseBrief.finding.openWork.body")
      };
    case "plan_clear":
      return {
        title: t("dailyPhaseBrief.finding.planClear.title"),
        interpretation: t("dailyPhaseBrief.finding.planClear.body")
      };
    case "signals_unknown":
      return {
        title: t("dailyPhaseBrief.finding.signalsUnknown.title"),
        interpretation: t("dailyPhaseBrief.finding.signalsUnknown.body")
      };
    case "watching_loop":
      return {
        title: t("dailyPhaseBrief.finding.watchingLoop.title"),
        interpretation: t("dailyPhaseBrief.finding.watchingLoop.body")
      };
    default: {
      const _exhaustive: never = presentation;
      void _exhaustive;
      return { title: fallback.title, interpretation: fallback.interpretation };
    }
  }
}

function presentClosingProgress(
  presentation: Extract<DailyPhaseFindingPresentation, { kind: "closing_progress" }>,
  t: Translate
): PresentedDailyPhaseFinding {
  if (presentation.variant === "complete") {
    return {
      title: t("dailyPhaseBrief.finding.closingProgress.title.complete"),
      interpretation: t("dailyPhaseBrief.finding.closingProgress.body.complete")
    };
  }
  if (presentation.variant === "partial") {
    return {
      title: t(
        presentation.completed === 1
          ? "dailyPhaseBrief.finding.closingProgress.title.partial.one"
          : "dailyPhaseBrief.finding.closingProgress.title.partial.other",
        { count: presentation.completed }
      ),
      interpretation: t(
        presentation.remaining === 1
          ? "dailyPhaseBrief.finding.closingProgress.body.remaining.one"
          : "dailyPhaseBrief.finding.closingProgress.body.remaining.other",
        { count: presentation.remaining }
      )
    };
  }
  return {
    title: t("dailyPhaseBrief.finding.closingProgress.title.handoff"),
    interpretation: t(
      presentation.remaining === 1
        ? "dailyPhaseBrief.finding.closingProgress.body.remaining.one"
        : "dailyPhaseBrief.finding.closingProgress.body.remaining.other",
      { count: presentation.remaining }
    )
  };
}

function presentSalesTrend(
  presentation: Extract<
    DailyPhaseFindingPresentation,
    { kind: "prior_sales_baseline" | "sales_moved" }
  >,
  t: Translate
): string {
  if (presentation.direction === "up") {
    return t("dailyPhaseBrief.finding.salesTrend.up", { delta: presentation.delta });
  }
  if (presentation.direction === "down") {
    return t("dailyPhaseBrief.finding.salesTrend.down", { delta: presentation.delta });
  }
  return t("dailyPhaseBrief.finding.salesTrend.flat");
}

function presentVerification(method: string, t: Translate): string {
  switch (method) {
    case "provider_sync":
      return t("dailyPhaseBrief.verification.providerSync");
    case "count":
      return t("dailyPhaseBrief.verification.count");
    case "receipt":
      return t("dailyPhaseBrief.verification.receipt");
    case "review":
      return t("dailyPhaseBrief.verification.review");
    case "none":
      return t("dailyPhaseBrief.verification.none");
    default:
      return method.trim() || t("dailyPhaseBrief.verification.none");
  }
}
