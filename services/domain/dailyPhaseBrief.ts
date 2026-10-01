import type { DailyCloseoutSummary } from "./dailyCloseout";
import type { DailyOpsReport } from "./dailyOpsReport";
import type { OperatingBrief } from "./operatingBrief";
import type { DailyOperatingPlan, OperatingPlanItem } from "./operatingPlan";
import { hourInTimeZone } from "./operatingPlan";

export type DailyBriefPhase = "morning" | "pre_service" | "closing";
export type DailyPhaseFindingTone = "urgent" | "attention" | "positive" | "neutral";
export type DailyPhaseBriefRoute =
  | "/today"
  | "/inventory"
  | "/inventory/count"
  | "/orders"
  | "/insights"
  | "/more/daily-report"
  | "/more/waste";

/**
 * Structured plan-item fields needed to localize operating-plan why/effect
 * at Daily Brief read time without rewriting durable English strings.
 */
export type DailyPhasePlanWhySource = Pick<OperatingPlanItem, "why" | "sourceTask">;
export type DailyPhasePlanEffectSource = Pick<
  OperatingPlanItem,
  "effect" | "sourceTask" | "sourceRestaurantTask"
>;

/**
 * Structured presentation payload for locale-aware Daily Brief copy.
 * Free-form tenant prose (task titles, memory, opportunity text) stays as
 * values; templates never invent operational facts.
 */
export type DailyPhaseFindingPresentation =
  | {
      kind: "start_with_task";
      taskTitle: string;
      why: string;
      /** When set, presentation localizes why via operating-plan why copy. */
      planWhy: DailyPhasePlanWhySource;
    }
  | { kind: "approvals"; count: number }
  | { kind: "tasks_completed"; count: number }
  | {
      kind: "prior_sales_baseline";
      direction: "up" | "down" | "flat";
      delta: string;
    }
  | { kind: "carry_learning"; memoryCopy: string }
  | { kind: "protect_opportunity"; opportunity: string }
  | {
      kind: "next_readiness_move";
      taskTitle: string;
      effect: string;
      verificationMethod: string;
      /** When set, presentation localizes effect via operating-plan effect copy. */
      planEffect: DailyPhasePlanEffectSource;
    }
  | { kind: "ingredients_constrain"; count: number; detail: string }
  | { kind: "coverage_supports_prep"; detail: string }
  | {
      kind: "deliveries_logged";
      count: number;
      mode: "received" | "awaiting";
      awaitingDetail: string;
    }
  | { kind: "tasks_need_verification"; count: number }
  | {
      kind: "closing_progress";
      completed: number;
      remaining: number;
      variant: "complete" | "partial" | "handoff";
    }
  | { kind: "waste_gap" }
  | {
      kind: "waste_analyzed";
      eventCount: number;
      attentionItem: { itemName: string; dayCount: number } | null;
    }
  | {
      kind: "sales_moved";
      direction: "up" | "down" | "flat";
      delta: string;
    }
  | { kind: "inventory_alerts_carry"; count: number }
  | { kind: "supplier_follow_up"; count: number }
  | { kind: "closing_learning"; memoryCopy: string }
  | { kind: "open_work"; count: number }
  | { kind: "plan_clear" }
  | { kind: "signals_unknown" }
  | { kind: "watching_loop" };

export interface DailyPhaseFinding {
  id: string;
  tone: DailyPhaseFindingTone;
  title: string;
  interpretation: string;
  /** When set, UI localizes from this descriptor instead of freeform EN title/body. */
  presentation: DailyPhaseFindingPresentation | null;
  route: DailyPhaseBriefRoute | null;
  evidenceReferences: string[];
}

export interface DailyPhaseBrief {
  phase: DailyBriefPhase;
  operatingDate: string;
  status: "ready" | "attention" | "celebrate";
  findings: DailyPhaseFinding[];
  unavailableSignals: string[];
}

export interface DailyPhaseBriefs {
  restaurantId: string;
  operatingDate: string;
  restaurantTimeZone: string;
  activePhase: DailyBriefPhase;
  generatedAt: string;
  briefs: Record<DailyBriefPhase, DailyPhaseBrief>;
  closeout: DailyCloseoutSummary;
}

interface Candidate extends DailyPhaseFinding {
  rank: number;
}

/**
 * Composes the three Section 11 narratives from already-derived operational
 * evidence. It adds interpretation and prioritization but never upgrades an
 * unavailable staffing, reservations, weather, forecast, or station signal
 * into a fact.
 */
export function buildDailyPhaseBriefs(input: {
  restaurantId: string;
  operatingPlan: DailyOperatingPlan;
  operatingBrief: OperatingBrief;
  dailyReport: DailyOpsReport;
  now?: Date;
}): DailyPhaseBriefs {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Daily phase briefs require a restaurant.");
  if (
    input.operatingPlan.restaurantId !== restaurantId ||
    input.operatingBrief.restaurantId !== restaurantId
  ) {
    throw new Error("Daily phase briefs received cross-restaurant evidence.");
  }
  const operatingDate = input.operatingPlan.operatingDate;
  if (
    input.operatingBrief.operatingDate !== operatingDate ||
    input.dailyReport.day.operatingDate !== operatingDate
  ) {
    throw new Error("Daily phase briefs require one operating date.");
  }
  const timeZone = input.operatingPlan.restaurantTimeZone;
  if (input.dailyReport.day.restaurantTimeZone !== timeZone || !timeZone.trim()) {
    throw new Error("Daily phase briefs require one restaurant timezone.");
  }
  const now = input.now instanceof Date && Number.isFinite(input.now.getTime())
    ? input.now
    : new Date();
  const activePhase = phaseForHour(hourInTimeZone(now, timeZone));

  return {
    restaurantId,
    operatingDate,
    restaurantTimeZone: timeZone,
    activePhase,
    generatedAt: now.toISOString(),
    briefs: {
      morning: buildMorningBrief(input.operatingPlan, input.operatingBrief, input.dailyReport),
      pre_service: buildPreServiceBrief(input.operatingPlan, input.operatingBrief, input.dailyReport),
      closing: buildClosingBrief(input.operatingPlan, input.operatingBrief, input.dailyReport)
    },
    closeout: input.dailyReport.closeout
  };
}

export function phaseForHour(hour: number): DailyBriefPhase {
  const normalized = Number.isFinite(hour) ? Math.max(0, Math.min(23, Math.floor(hour))) : 12;
  if (normalized < 4 || normalized >= 17) return "closing";
  if (normalized < 10) return "morning";
  return "pre_service";
}

function buildMorningBrief(
  plan: DailyOperatingPlan,
  brief: OperatingBrief,
  report: DailyOpsReport
): DailyPhaseBrief {
  const candidates: Candidate[] = [];
  const firstNow = firstOpen(plan.buckets.now);
  if (firstNow) {
    candidates.push({
      id: `morning-priority:${firstNow.id}`,
      rank: firstNow.priority === "urgent" ? 0 : 1,
      tone: firstNow.priority === "urgent" ? "urgent" : "attention",
      title: `Start with ${firstNow.title}`,
      interpretation: `${firstNow.why} Completing it first protects the next service window.`,
      presentation: {
        kind: "start_with_task",
        taskTitle: firstNow.title,
        why: firstNow.why,
        planWhy: {
          why: firstNow.why,
          sourceTask: firstNow.sourceTask
        }
      },
      route: routeForPlanItem(firstNow),
      evidenceReferences: referencesForItem(firstNow)
    });
  }
  if (brief.needsApproval.length > 0) {
    candidates.push(approvalFinding("morning", brief.needsApproval.length));
  }
  if (report.throughput.completedTasks > 0) {
    candidates.push({
      id: "morning-completed",
      rank: 3,
      tone: "positive",
      title: `${report.throughput.completedTasks} task${report.throughput.completedTasks === 1 ? "" : "s"} already completed`,
      interpretation: "Mise has moved finished work out of the active queue so the team can focus on what remains.",
      presentation: {
        kind: "tasks_completed",
        count: report.throughput.completedTasks
      },
      route: "/today",
      evidenceReferences: completedEvidence(plan)
    });
  }
  if (report.sales.priorSales !== null && report.sales.salesTrendDirection !== null) {
    const salesPresentation = salesTrendPresentation(report);
    candidates.push({
      id: "morning-prior-sales",
      rank: 4,
      tone: report.sales.salesTrendDirection === "down" ? "attention" : "neutral",
      title: "The last recorded service gives today a baseline",
      interpretation: salesTrendInterpretation(report),
      presentation: {
        kind: "prior_sales_baseline",
        direction: salesPresentation.direction,
        delta: salesPresentation.delta
      },
      route: "/insights",
      evidenceReferences: ["daily-report:sales-trend"]
    });
  }
  if (report.learning.memoryCopy) {
    candidates.push({
      id: "morning-learning",
      rank: 5,
      tone: "neutral",
      title: "Carry forward a verified restaurant lesson",
      interpretation: report.learning.memoryCopy,
      presentation: {
        kind: "carry_learning",
        memoryCopy: report.learning.memoryCopy
      },
      route: "/insights",
      evidenceReferences: ["daily-report:learning-memory"]
    });
  }
  if (brief.restaurantStatus.topOpportunity) {
    candidates.push({
      id: "morning-opportunity",
      rank: 6,
      tone: "positive",
      title: "There is an opportunity to protect today",
      interpretation: brief.restaurantStatus.topOpportunity,
      presentation: {
        kind: "protect_opportunity",
        opportunity: brief.restaurantStatus.topOpportunity
      },
      route: "/today",
      evidenceReferences: ["operating-brief:top-opportunity"]
    });
  }
  ensureMinimumCandidates(candidates, plan, "morning");
  return finishBrief("morning", plan.operatingDate, candidates, [
    "yesterday closeout",
    "staffing schedule",
    "supplier cutoff times",
    "today sales forecast"
  ]);
}

function buildPreServiceBrief(
  plan: DailyOperatingPlan,
  brief: OperatingBrief,
  report: DailyOpsReport
): DailyPhaseBrief {
  const candidates: Candidate[] = [];
  const firstNow = firstOpen(plan.buckets.now);
  if (firstNow) {
    candidates.push({
      id: `pre-service-priority:${firstNow.id}`,
      rank: 0,
      tone: firstNow.priority === "urgent" ? "urgent" : "attention",
      title: `${firstNow.title} is the next readiness move`,
      interpretation: `${firstNow.effect} Verification: ${verificationLabel(firstNow)}.`,
      presentation: {
        kind: "next_readiness_move",
        taskTitle: firstNow.title,
        effect: firstNow.effect,
        verificationMethod: firstNow.verificationMethod,
        planEffect: {
          effect: firstNow.effect,
          sourceTask: firstNow.sourceTask,
          sourceRestaurantTask: firstNow.sourceRestaurantTask
        }
      },
      route: routeForPlanItem(firstNow),
      evidenceReferences: referencesForItem(firstNow)
    });
  }
  const riskCount = report.inventoryRisk.health.critical + report.inventoryRisk.health.low;
  if (riskCount > 0) {
    const detail =
      brief.outlook.menuRisks[0]?.detail ??
      "Review projected coverage before prep is locked for service.";
    candidates.push({
      id: "pre-service-inventory",
      rank: report.inventoryRisk.health.critical > 0 ? 0 : 1,
      tone: report.inventoryRisk.health.critical > 0 ? "urgent" : "attention",
      title: `${riskCount} ingredient${riskCount === 1 ? "" : "s"} may constrain service`,
      interpretation: detail,
      presentation: {
        kind: "ingredients_constrain",
        count: riskCount,
        detail
      },
      route: "/inventory",
      evidenceReferences: brief.outlook.menuRisks.map((risk) => `inventory-risk:${risk.itemName}`)
    });
  } else if (brief.outlook.prepReadiness === "ready") {
    candidates.push({
      id: "pre-service-readiness",
      rank: 4,
      tone: "positive",
      title: "Current ingredient coverage supports prep",
      interpretation: brief.outlook.prepReadinessDetail,
      presentation: {
        kind: "coverage_supports_prep",
        detail: brief.outlook.prepReadinessDetail
      },
      route: "/inventory",
      evidenceReferences: ["operating-brief:prep-readiness"]
    });
  }
  if (report.deliveriesToday.count > 0 || brief.outlook.deliveryStatus !== "none") {
    const received = report.deliveriesToday.count > 0;
    candidates.push({
      id: "pre-service-deliveries",
      rank: brief.outlook.deliveryStatus === "overdue" ? 0 : 2,
      tone: brief.outlook.deliveryStatus === "overdue" ? "urgent" : "neutral",
      title: `${report.deliveriesToday.count} deliver${report.deliveriesToday.count === 1 ? "y" : "ies"} logged for this operating day`,
      interpretation: received
        ? "Received quantities are already reflected in the inventory ledger."
        : brief.outlook.deliveryDetail,
      presentation: {
        kind: "deliveries_logged",
        count: report.deliveriesToday.count,
        mode: received ? "received" : "awaiting",
        awaitingDetail: brief.outlook.deliveryDetail
      },
      route: "/orders",
      evidenceReferences: report.deliveriesToday.lines.map((line) => `delivery:${line.id}`)
    });
  }
  if (brief.needsApproval.length > 0) {
    candidates.push(approvalFinding("pre-service", brief.needsApproval.length));
  }
  const unverified = plan.items.filter(
    (item) => item.status === "open" && item.verificationMethod !== "none"
  );
  if (unverified.length > 0) {
    candidates.push({
      id: "pre-service-unverified",
      rank: 2,
      tone: "attention",
      title: `${unverified.length} task${unverified.length === 1 ? "" : "s"} still need verification`,
      interpretation: "Completion will stay open until Mise receives the required count, receipt, sync, or review evidence.",
      presentation: {
        kind: "tasks_need_verification",
        count: unverified.length
      },
      route: "/today",
      evidenceReferences: unverified.slice(0, 8).map((item) => `plan-item:${item.id}`)
    });
  }
  ensureMinimumCandidates(candidates, plan, "pre_service");
  return finishBrief("pre_service", plan.operatingDate, candidates, [
    "station assignments",
    "staffing schedule",
    "reservation load",
    "rush timing forecast"
  ]);
}

function buildClosingBrief(
  plan: DailyOperatingPlan,
  brief: OperatingBrief,
  report: DailyOpsReport
): DailyPhaseBrief {
  const candidates: Candidate[] = [];
  const completed = report.throughput.completedTasks;
  const remaining = report.throughput.openTasks + report.throughput.operatorTasksOpen;
  const progressVariant =
    remaining === 0 && completed > 0 ? "complete" : completed > 0 ? "partial" : "handoff";
  candidates.push({
    id: "closing-progress",
    rank: remaining === 0 && completed > 0 ? 0 : 2,
    tone: completed > 0 ? "positive" : "neutral",
    title: closingProgressTitle(completed, remaining),
    interpretation: remaining === 0
      ? "The evidenced task board is clear. Good work—Mise will carry today’s verified outcomes into the next operating cycle."
      : `${remaining} task${remaining === 1 ? " remains" : "s remain"} open, so tomorrow should begin with a deliberate handoff.`,
    presentation: {
      kind: "closing_progress",
      completed,
      remaining,
      variant: progressVariant
    },
    route: "/today",
    evidenceReferences: completedEvidence(plan)
  });
  const waste = report.wasteAnalysis;
  if (waste) {
    const attentionItem =
      waste.status === "attention" && waste.topItems[0]
        ? {
            itemName: waste.topItems[0].itemName,
            dayCount: waste.topItems[0].distinctDayCount
          }
        : null;
    candidates.push({
      id: "closing-waste",
      rank: waste.status === "attention" ? 0 : waste.status === "monitoring" ? 3 : 6,
      tone: waste.status === "attention" ? "attention" : "neutral",
      title: waste.status === "no_data"
        ? "Waste is still an evidence gap"
        : `${waste.eventCount} waste entr${waste.eventCount === 1 ? "y" : "ies"} were analyzed`,
      interpretation: waste.status === "attention" && waste.topItems[0]
        ? `${waste.topItems[0].itemName} repeated across ${waste.topItems[0].distinctDayCount} operating days and should shape the next prep or order decision.`
        : waste.status === "no_data"
          ? "No waste records were captured; Mise is not interpreting that as zero waste."
          : "Keep recording waste so the baseline can separate normal trim from preventable loss.",
      presentation:
        waste.status === "no_data"
          ? { kind: "waste_gap" }
          : {
              kind: "waste_analyzed",
              eventCount: waste.eventCount,
              attentionItem
            },
      route: "/more/waste",
      evidenceReferences: waste.recentEvents.map((event) => `inventory-event:${event.id}`)
    });
  }
  if (report.sales.salesTrendDirection !== null) {
    const salesPresentation = salesTrendPresentation(report);
    candidates.push({
      id: "closing-sales",
      rank: report.sales.salesTrendDirection === "down" ? 1 : 3,
      tone: report.sales.salesTrendDirection === "down" ? "attention" : "positive",
      title: "Recorded sales moved against the prior service baseline",
      interpretation: salesTrendInterpretation(report),
      presentation: {
        kind: "sales_moved",
        direction: salesPresentation.direction,
        delta: salesPresentation.delta
      },
      route: "/insights",
      evidenceReferences: ["daily-report:sales-trend"]
    });
  }
  if (report.inventoryRisk.alerts > 0) {
    candidates.push({
      id: "closing-inventory",
      rank: report.inventoryRisk.health.critical > 0 ? 0 : 2,
      tone: report.inventoryRisk.health.critical > 0 ? "urgent" : "attention",
      title: `${report.inventoryRisk.alerts} inventory alert${report.inventoryRisk.alerts === 1 ? " carries" : "s carry"} into the next cycle`,
      interpretation: "Close counts or approved replenishment should resolve the risk before it becomes tomorrow’s service constraint.",
      presentation: {
        kind: "inventory_alerts_carry",
        count: report.inventoryRisk.alerts
      },
      route: "/inventory",
      evidenceReferences: brief.outlook.menuRisks.map((risk) => `inventory-risk:${risk.itemName}`)
    });
  }
  if (report.supplierReliability.attentionSupplierCount > 0) {
    candidates.push({
      id: "closing-suppliers",
      rank: 1,
      tone: "attention",
      title: `${report.supplierReliability.attentionSupplierCount} supplier relationship${report.supplierReliability.attentionSupplierCount === 1 ? " needs" : "s need"} follow-up`,
      interpretation: "Use verified delivery timing and discrepancy evidence before the next supplier decision.",
      presentation: {
        kind: "supplier_follow_up",
        count: report.supplierReliability.attentionSupplierCount
      },
      route: "/orders",
      evidenceReferences: report.supplierReliability.suppliers
        .filter((supplier) => supplier.status === "watch" || supplier.status === "at_risk")
        .map((supplier) => `supplier:${supplier.supplierId}`)
    });
  }
  if (report.learning.memoryCopy) {
    candidates.push({
      id: "closing-learning",
      rank: 4,
      tone: "neutral",
      title: "Today added a restaurant-specific lesson",
      interpretation: report.learning.memoryCopy,
      presentation: {
        kind: "closing_learning",
        memoryCopy: report.learning.memoryCopy
      },
      route: "/insights",
      evidenceReferences: ["daily-report:learning-memory"]
    });
  }
  ensureMinimumCandidates(candidates, plan, "closing");
  const unavailable = ["sales forecast", "forecast accuracy", "service issue feed"];
  if (!report.wasteAnalysis) unavailable.push("waste analysis");
  return finishBrief("closing", plan.operatingDate, candidates, unavailable);
}

function finishBrief(
  phase: DailyBriefPhase,
  operatingDate: string,
  candidates: Candidate[],
  unavailableSignals: string[]
): DailyPhaseBrief {
  const findings = candidates
    .slice()
    .sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id))
    .filter((candidate, index, all) => all.findIndex((entry) => entry.id === candidate.id) === index)
    .slice(0, 5)
    .map(({ rank: _rank, ...finding }) => finding);
  const status: DailyPhaseBrief["status"] = phase === "closing" && findings[0]?.tone === "positive"
    ? "celebrate"
    : findings.some((finding) => finding.tone === "urgent" || finding.tone === "attention")
      ? "attention"
      : "ready";
  return {
    phase,
    operatingDate,
    status,
    findings: findings.slice(0, Math.max(3, Math.min(5, findings.length))),
    unavailableSignals: [...new Set(unavailableSignals)].slice(0, 8)
  };
}

function ensureMinimumCandidates(
  candidates: Candidate[],
  plan: DailyOperatingPlan,
  phase: DailyBriefPhase
) {
  const open = plan.items.filter((item) => item.status === "open");
  if (!candidates.some((candidate) => candidate.id.includes("open-work"))) {
    candidates.push({
      id: `${phase}-open-work`,
      rank: 7,
      tone: open.length > 0 ? "neutral" : "positive",
      title: open.length > 0
        ? `${open.length} task${open.length === 1 ? " is" : "s are"} still active`
        : "The verified operating plan is clear",
      interpretation: open.length > 0
        ? "The Today timeline is the source of truth for sequence, ownership, and verification."
        : "No additional plan work is being inferred from missing integrations.",
      presentation:
        open.length > 0
          ? { kind: "open_work", count: open.length }
          : { kind: "plan_clear" },
      route: "/today",
      evidenceReferences: open.slice(0, 8).map((item) => `plan-item:${item.id}`)
    });
  }
  if (candidates.length < 3) {
    candidates.push({
      id: `${phase}-evidence-boundary`,
      rank: 8,
      tone: "neutral",
      title: "Some operating signals remain unknown",
      interpretation: "Mise will keep the brief bounded until connected evidence can support a stronger conclusion.",
      presentation: { kind: "signals_unknown" },
      route: null,
      evidenceReferences: []
    });
  }
  if (candidates.length < 3) {
    candidates.push({
      id: `${phase}-watching`,
      rank: 9,
      tone: "neutral",
      title: "Mise is watching the verified operating loop",
      interpretation: "New counts, approvals, deliveries, and completed tasks will update the next brief.",
      presentation: { kind: "watching_loop" },
      route: "/today",
      evidenceReferences: []
    });
  }
}

function approvalFinding(prefix: string, count: number): Candidate {
  return {
    id: `${prefix}-approvals`,
    rank: 1,
    tone: "attention",
    title: `${count} decision${count === 1 ? " needs" : "s need"} approval`,
    interpretation: "Mise has prepared the work, but an authorized operator still owns the external decision.",
    presentation: { kind: "approvals", count },
    route: "/orders",
    evidenceReferences: [`operating-brief:approvals:${count}`]
  };
}

function firstOpen(items: readonly OperatingPlanItem[]) {
  return items.find((item) => item.status === "open") ?? null;
}

function routeForPlanItem(item: OperatingPlanItem): DailyPhaseBriefRoute {
  if (item.relatedRefs.some((ref) => ref.type === "inventory_count_session")) {
    return "/inventory/count";
  }
  if (item.relatedRefs.some((ref) => ref.type === "inventory_item")) return "/inventory";
  if (
    item.relatedRefs.some(
      (ref) => ref.type === "purchase_recommendation" || ref.type === "supplier_order"
    )
  ) return "/orders";
  if (item.relatedRefs.some((ref) => ref.type === "insight")) return "/insights";
  return "/today";
}

function referencesForItem(item: OperatingPlanItem) {
  const refs = item.relatedRefs.map((ref) => `${ref.type}:${ref.id}`);
  return refs.length > 0 ? refs : [`plan-item:${item.id}`];
}

function completedEvidence(plan: DailyOperatingPlan) {
  return plan.items
    .filter((item) => item.status === "completed")
    .slice(0, 8)
    .map((item) => `plan-item:${item.id}`);
}

function verificationLabel(item: OperatingPlanItem) {
  return item.verificationMethod === "provider_sync"
    ? "provider confirmation"
    : item.verificationMethod;
}

function closingProgressTitle(completed: number, remaining: number) {
  if (remaining === 0 && completed > 0) return "Great work—the verified board is complete";
  if (completed > 0) return `Good work—${completed} task${completed === 1 ? " is" : "s are"} complete`;
  return "Close the day with a verified handoff";
}

function salesTrendPresentation(report: DailyOpsReport): {
  direction: "up" | "down" | "flat";
  delta: string;
} {
  const delta = Math.abs(report.sales.salesTrendDelta ?? 0).toFixed(2);
  if (report.sales.salesTrendDirection === "up") {
    return { direction: "up", delta };
  }
  if (report.sales.salesTrendDirection === "down") {
    return { direction: "down", delta };
  }
  return { direction: "flat", delta };
}

function salesTrendInterpretation(report: DailyOpsReport) {
  const { direction, delta } = salesTrendPresentation(report);
  if (direction === "up") {
    return `Recorded sales are ${delta} above the prior service baseline. Treat that as observed pace, not a forecast.`;
  }
  if (direction === "down") {
    return `Recorded sales are ${delta} below the prior service baseline. Review mix and prep before changing tomorrow's plan.`;
  }
  return "Recorded sales are level with the prior service baseline; no forecast accuracy is being inferred.";
}
