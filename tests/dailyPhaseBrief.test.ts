import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailyPhaseBriefs,
  phaseForHour
} from "../services/domain/dailyPhaseBrief";
import type { DailyOpsReport } from "../services/domain/dailyOpsReport";
import type { OperatingBrief } from "../services/domain/operatingBrief";
import type {
  DailyOperatingPlan,
  OperatingPlanItem
} from "../services/domain/operatingPlan";

const restaurantId = "phase-restaurant";
const operatingDate = "2026-08-03";

test("restaurant-local hours select Morning, Pre-Service, and Closing phases", () => {
  assert.equal(phaseForHour(7), "morning");
  assert.equal(phaseForHour(12), "pre_service");
  assert.equal(phaseForHour(19), "closing");
  assert.equal(phaseForHour(2), "closing");
});

test("count-session related refs route phase findings to the inventory count screen", () => {
  const evidence = fixtures();
  const countItem: OperatingPlanItem = {
    ...planItem("open"),
    id: "plan-count-session",
    relatedRefs: [{ type: "inventory_count_session", id: "count_session_1" }]
  };
  const countPlan: DailyOperatingPlan = {
    ...evidence.operatingPlan,
    items: [countItem],
    buckets: {
      now: [countItem],
      up_next: [],
      later: [],
      done: []
    }
  };
  const result = buildDailyPhaseBriefs({
    restaurantId,
    ...evidence,
    operatingPlan: countPlan,
    now: new Date("2026-08-03T16:00:00.000Z")
  });
  assert.ok(
    Object.values(result.briefs).some((brief) =>
      brief.findings.some((finding) => finding.route === "/inventory/count")
    ),
    "count-session urgency should deep-link to /inventory/count"
  );
});

test("phase briefs prioritize three to five interpreted findings without fabricating integrations", () => {
  const evidence = fixtures();
  const result = buildDailyPhaseBriefs({
    restaurantId,
    ...evidence,
    now: new Date("2026-08-03T16:00:00.000Z")
  });

  assert.equal(result.activePhase, "pre_service");
  for (const brief of Object.values(result.briefs)) {
    assert.ok(brief.findings.length >= 3);
    assert.ok(brief.findings.length <= 5);
    assert.ok(brief.findings.every((finding) => finding.interpretation.length > 0));
  }
  assert.ok(result.briefs.morning.unavailableSignals.includes("staffing schedule"));
  assert.ok(result.briefs.pre_service.unavailableSignals.includes("reservation load"));
  assert.ok(result.briefs.closing.unavailableSignals.includes("forecast accuracy"));
  assert.match(result.briefs.pre_service.findings[0]!.title, /Verify produce count/);
});

test("Closing Brief celebrates evidenced completion and interprets repeated waste", () => {
  const evidence = fixtures({ allTasksComplete: true });
  const result = buildDailyPhaseBriefs({
    restaurantId,
    ...evidence,
    now: new Date("2026-08-04T00:30:00.000Z")
  });
  const closing = result.briefs.closing;

  assert.equal(result.activePhase, "closing");
  assert.equal(closing.status, "celebrate");
  assert.match(closing.findings[0]!.title, /Great work/);
  assert.ok(closing.findings.some((finding) => /waste entr/.test(finding.title)));
  assert.ok(
    closing.findings.some((finding) => /Bell peppers repeated across 2 operating days/.test(finding.interpretation))
  );
});

test("phase brief identity and operating-date mismatches fail closed", () => {
  const evidence = fixtures();
  assert.throws(
    () =>
      buildDailyPhaseBriefs({
        restaurantId: "another-restaurant",
        ...evidence
      }),
    /cross-restaurant/
  );
  assert.throws(
    () =>
      buildDailyPhaseBriefs({
        restaurantId,
        ...evidence,
        dailyReport: {
          ...evidence.dailyReport,
          day: { ...evidence.dailyReport.day, operatingDate: "2026-08-04" }
        }
      }),
    /one operating date/
  );
});

test("closing supplier follow-up routes to the supplier status drill-down", () => {
  const base = fixtures();
  const result = buildDailyPhaseBriefs({
    restaurantId,
    ...base,
    dailyReport: {
      ...base.dailyReport,
      supplierReliability: {
        totalDeliveries: 3,
        supplierCount: 1,
        attentionSupplierCount: 1,
        overallOnTimeRate: 0.5,
        overallMatchedDeliveryRate: 0.5,
        suppliers: [
          {
            supplierId: "supplier-1",
            supplierName: "Produce Co.",
            status: "watch",
            deliveryCount: 3,
            onTimeCount: 1,
            measurableDeliveryCount: 2,
            issueDeliveryCount: 1,
            unverifiedDeliveryCount: 0,
            discrepancyLineCount: 1,
            onTimeRate: 0.5,
            matchedDeliveryRate: 0.5,
            fulfillmentRate: 0.8,
            reasons: ["late_deliveries", "underfilled_lines"],
            lastDeliveryAt: "2026-08-03T16:00:00.000Z",
            relatedOrderIds: ["order-1"]
          }
        ]
      }
    },
    now: new Date("2026-08-03T21:00:00.000Z")
  });
  const finding = result.briefs.closing.findings.find((entry) => entry.id === "closing-suppliers");
  assert.ok(finding);
  assert.equal(finding!.route, "/more/supplier-status");
  assert.deepEqual(finding!.evidenceReferences, ["supplier:supplier-1"]);
});

function fixtures(options: { allTasksComplete?: boolean } = {}) {
  const item = planItem(options.allTasksComplete ? "completed" : "open");
  const plan: DailyOperatingPlan = {
    restaurantId,
    operatingDate,
    restaurantTimeZone: "America/New_York",
    generatedAt: "2026-08-03T12:00:00.000Z",
    serviceWindows: [],
    items: [item],
    buckets: {
      now: options.allTasksComplete ? [] : [item],
      up_next: [],
      later: [],
      done: options.allTasksComplete ? [item] : []
    }
  };
  const operatingBrief: OperatingBrief = {
    restaurantId,
    restaurantName: "Phase Kitchen",
    operatingDate,
    generatedAt: "2026-08-03T12:00:00.000Z",
    restaurantStatus: {
      status: "attention_needed",
      summary: "Attention needed.",
      lastUpdated: "2026-08-03T12:00:00.000Z",
      dataFreshness: {
        state: "fresh",
        asOf: "2026-08-03T12:00:00.000Z",
        label: "Fresh",
        missingData: []
      },
      confidence: 0.84,
      confidenceRationale: "Verified sales and counts agree.",
      topRisk: "Bell peppers need a count.",
      topOpportunity: "Complete produce prep before lunch.",
      nextDecisionDeadline: null
    },
    sinceYouWereAway: [],
    liveActivity: [],
    needsApproval: [
      {
        id: "approval-1",
        recommendationId: "recommendation-1",
        actionId: null,
        findingId: null,
        title: "Approve peppers",
        decision: "Approve or dismiss",
        whyItMatters: "Coverage is low.",
        recommendedAction: "Approve the draft.",
        deadline: null,
        confidence: 0.8,
        confidenceRationale: "Verified count.",
        expectedOperationalImpact: "Protect lunch prep.",
        estimatedFinancialImpact: null,
        riskIfIgnored: "Prep may be constrained.",
        workAlreadyCompleted: ["Draft prepared"],
        supplierName: "Metro Produce",
        quantity: 12,
        unit: "lb"
      }
    ],
    outlook: {
      expectedSales: null,
      expectedSalesContext: "Recorded sales only.",
      prepReadiness: "gaps",
      prepReadinessDetail: "One ingredient may not cover lunch.",
      staffingCoverage: "unknown",
      staffingDetail: "Requires schedule integration.",
      deliveryStatus: "expected",
      deliveryDetail: "One sent order is awaiting confirmation.",
      menuRisks: [
        { itemName: "Bell peppers", label: "Watch", detail: "Coverage is below two days." }
      ],
      supplierCutoffDeadlines: [],
      preventableLoss: "A stockout is preventable."
    },
    miseIsWatching: [],
    activityWindowSummary: null,
    demoLabeled: true
  };
  const completed = options.allTasksComplete ? 1 : 0;
  const open = options.allTasksComplete ? 0 : 1;
  const dailyReport: DailyOpsReport = {
    day: {
      operatingDate,
      restaurantTimeZone: "America/New_York",
      operatingSummary: "One inventory decision is open.",
      restaurantName: "Phase Kitchen",
      miseStatus: "Attention",
      restaurantCurrency: "USD"
    },
    closeout: {
      operatingDate,
      phase: options.allTasksComplete ? "complete" : "progress",
      shouldShow: Boolean(options.allTasksComplete),
      completedTasks: completed,
      remainingTasks: open,
      totalTasks: 1,
      completionRate: completed,
      attentionItems: 1
    },
    sales: {
      salesToday: 1200,
      netSalesToday: 1100,
      itemsSold: 90,
      topItems: [],
      priorSales: 1000,
      salesTrendDelta: 100,
      salesTrendDirection: "up"
    },
    inventoryRisk: {
      alerts: 1,
      health: { good: 4, watch: 1, low: 1, critical: 0 },
      estimatedDollarsAtRisk: 20
    },
    ordering: { pendingRecommendations: 1 },
    throughput: { openTasks: open, completedTasks: completed, operatorTasksOpen: 0 },
    deliveriesToday: { count: 1, lines: [] },
    supplierReliability: {
      totalDeliveries: 2,
      supplierCount: 1,
      attentionSupplierCount: 0,
      overallOnTimeRate: 1,
      overallMatchedDeliveryRate: 1,
      suppliers: []
    },
    wasteAnalysis: {
      restaurantId,
      operatingDate,
      windowDays: 7,
      windowStart: "2026-07-28",
      priorWindowStart: "2026-07-21",
      priorWindowEnd: "2026-07-27",
      status: "attention",
      reasons: ["repeat_item"],
      recommendedAction: "review_repeat_item",
      primaryItemId: "peppers",
      eventCount: 2,
      itemCount: 1,
      estimatedCost: 15.6,
      costComplete: true,
      pricedEventCount: 2,
      unpricedEventCount: 0,
      unmatchedEventCount: 0,
      priorEventCount: 1,
      priorEstimatedCost: 5,
      priorCostComplete: true,
      trend: "up",
      topItems: [
        {
          inventoryItemId: "peppers",
          itemName: "Bell peppers",
          category: "Produce",
          eventCount: 2,
          distinctDayCount: 2,
          quantity: 3000,
          canonicalUnit: "g",
          estimatedCost: 15.6,
          costComplete: true,
          shareOfEstimatedCost: 1,
          lastWastedAt: "2026-08-03T20:00:00.000Z"
        }
      ],
      recentEvents: [
        {
          id: "waste-1",
          inventoryItemId: "peppers",
          itemName: "Bell peppers",
          quantity: 1000,
          canonicalUnit: "g",
          estimatedCost: 5.2,
          effectiveAt: "2026-08-03T20:00:00.000Z",
          recordedAt: "2026-08-03T20:00:00.000Z",
          note: null
        }
      ],
      historyTruncated: false
    },
    signalsByType: [],
    learning: {
      credibilityScore: 80,
      credibilityLabel: "Established",
      credibilityNextStep: "Keep reviewing outcomes.",
      memoryLabel: "Friday demand",
      memoryCopy: "Friday dinner demand is usually higher.",
      memoryNextStep: "Review the next Friday."
    },
    managerAdvice: { actions: [], askBriefingText: null }
  };
  return { operatingPlan: plan, operatingBrief, dailyReport };
}

function planItem(status: "open" | "completed"): OperatingPlanItem {
  return {
    id: "plan-count-peppers",
    restaurantId,
    kind: status === "completed" ? "completed" : "human_task",
    title: "Verify produce count",
    detail: "Count Bell peppers.",
    why: "Current coverage is below the service threshold.",
    neededBy: "Before lunch",
    effect: "A verified count keeps the order decision accurate.",
    serviceWindow: "before_lunch",
    bucket: status === "completed" ? "done" : "now",
    priority: "high",
    relatedRefs: [{ type: "inventory_item", id: "peppers" }],
    dependencyIds: [],
    verificationMethod: "count",
    completionResult: status === "completed" ? "Count recorded." : null,
    reprioritization: status === "open"
      ? { code: "stock_risk", reason: "Coverage is low." }
      : null,
    requiredRole: "member",
    status,
    sourceTask: null,
    sourceRestaurantTask: null
  };
}
