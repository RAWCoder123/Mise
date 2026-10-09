import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDailyPhaseBriefs } from "../services/domain/dailyPhaseBrief";
import {
  asciiTrimDailyPhaseBriefRestaurantToken,
  canonicalizeDailyPhaseBriefRestaurantId,
  requireCanonicalDailyPhaseBriefRestaurantId,
  requireCanonicalDailyPhaseBriefWorkspaceId
} from "../services/domain/dailyPhaseBriefRestaurantIdentity";
import type { DailyOpsReport } from "../services/domain/dailyOpsReport";
import type { OperatingBrief } from "../services/domain/operatingBrief";
import type {
  DailyOperatingPlan,
  OperatingPlanItem
} from "../services/domain/operatingPlan";

const identitySource = readFileSync(
  new URL("../services/domain/dailyPhaseBriefRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/dailyPhaseBrief.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/dailyPhaseBrief.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";
const operatingDate = "2026-08-03";

function minimalEvidence(restaurantId: string) {
  const item: OperatingPlanItem = {
    id: "plan-count",
    restaurantId,
    kind: "human_task",
    title: "Verify produce count",
    detail: "Count peppers.",
    why: "Coverage is low.",
    neededBy: "Before lunch",
    effect: "Keep the order accurate.",
    serviceWindow: "before_lunch",
    bucket: "now",
    priority: "high",
    relatedRefs: [{ type: "inventory_item", id: "peppers" }],
    dependencyIds: [],
    verificationMethod: "count",
    completionResult: null,
    reprioritization: null,
    requiredRole: "member",
    status: "open",
    sourceTask: null,
    sourceRestaurantTask: null
  };
  const operatingPlan: DailyOperatingPlan = {
    restaurantId,
    operatingDate,
    restaurantTimeZone: "America/New_York",
    generatedAt: "2026-08-03T12:00:00.000Z",
    serviceWindows: [],
    items: [item],
    buckets: { now: [item], up_next: [], later: [], done: [] }
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
      topRisk: null,
      topOpportunity: null,
      nextDecisionDeadline: null
    },
    sinceYouWereAway: [],
    liveActivity: [],
    needsApproval: [],
    outlook: {
      expectedSales: null,
      expectedSalesContext: "Recorded sales only.",
      prepReadiness: "ready",
      prepReadinessDetail: "Prep is ready.",
      staffingCoverage: "unknown",
      staffingDetail: "Requires schedule integration.",
      deliveryStatus: "none",
      deliveryDetail: "No deliveries expected.",
      menuRisks: [],
      supplierCutoffDeadlines: [],
      preventableLoss: null
    },
    miseIsWatching: [],
    activityWindowSummary: null,
    demoLabeled: true
  };
  const dailyReport: DailyOpsReport = {
    day: {
      operatingDate,
      restaurantTimeZone: "America/New_York",
      operatingSummary: "Quiet day.",
      restaurantName: "Phase Kitchen",
      miseStatus: "Stable",
      restaurantCurrency: "USD"
    },
    closeout: {
      operatingDate,
      phase: "progress",
      shouldShow: false,
      completedTasks: 0,
      remainingTasks: 1,
      totalTasks: 1,
      completionRate: 0,
      attentionItems: 0
    },
    sales: {
      salesToday: 0,
      netSalesToday: 0,
      itemsSold: 0,
      topItems: [],
      priorSales: 0,
      salesTrendDelta: 0,
      salesTrendDirection: "flat"
    },
    inventoryRisk: {
      alerts: 0,
      health: { good: 1, watch: 0, low: 0, critical: 0 },
      estimatedDollarsAtRisk: 0
    },
    ordering: { pendingRecommendations: 0 },
    throughput: { openTasks: 1, completedTasks: 0, operatorTasksOpen: 0 },
    deliveriesToday: { count: 0, lines: [] },
    supplierReliability: {
      totalDeliveries: 0,
      supplierCount: 0,
      attentionSupplierCount: 0,
      overallOnTimeRate: null,
      overallMatchedDeliveryRate: null,
      suppliers: []
    },
    wasteAnalysis: {
      restaurantId,
      operatingDate,
      windowDays: 7,
      windowStart: "2026-07-28",
      priorWindowStart: "2026-07-21",
      priorWindowEnd: "2026-07-27",
      status: "no_data",
      reasons: ["no_records"],
      recommendedAction: "start_logging",
      primaryItemId: null,
      eventCount: 0,
      itemCount: 0,
      estimatedCost: 0,
      costComplete: true,
      pricedEventCount: 0,
      unpricedEventCount: 0,
      unmatchedEventCount: 0,
      priorEventCount: 0,
      priorEstimatedCost: 0,
      priorCostComplete: true,
      trend: "flat",
      topItems: [],
      recentEvents: [],
      historyTruncated: false
    },
    signalsByType: [],
    learning: {
      credibilityScore: 0,
      credibilityLabel: "Emerging",
      credibilityNextStep: "Keep reviewing outcomes.",
      memoryLabel: null,
      memoryCopy: null,
      memoryNextStep: null
    },
    managerAdvice: { actions: [], askBriefingText: null }
  };
  return { operatingPlan, operatingBrief, dailyReport };
}

test("MISE-005LQ pins daily-phase-brief restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LQ/);
  assert.match(domainSource, /MISE-005LQ/);
  assert.match(applicationSource, /MISE-005LQ/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyPhaseBriefRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /requireCanonicalDailyPhaseBriefRestaurantId\(restaurantId\)/);
  assert.match(applicationSource, /requireCanonicalDailyPhaseBriefWorkspaceId\(restaurantId\)/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /operatingBriefRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /pilotReadinessRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantAppRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /setupRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /autonomyRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /todayTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /scheduledRecalculationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /recalculationRunTransport/);
  assert.doesNotMatch(identitySource, /recalculationSchedule/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
});

test("ASCII trim keeps ordinary daily-phase-brief workspace padding stable", () => {
  assert.equal(asciiTrimDailyPhaseBriefRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeDailyPhaseBriefRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalDailyPhaseBriefRestaurantId(` ${workspace} `), workspace);
  assert.equal(requireCanonicalDailyPhaseBriefWorkspaceId(` ${workspace} `), workspace);

  const evidence = minimalEvidence(workspace);
  const result = buildDailyPhaseBriefs({
    restaurantId: ` ${workspace} `,
    ...evidence,
    now: new Date("2026-08-03T16:00:00.000Z")
  });
  assert.equal(result.restaurantId, workspace);
});

test("ASCII daily-phase-brief trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimDailyPhaseBriefRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeDailyPhaseBriefRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalDailyPhaseBriefRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Daily phase briefs require a restaurant."
  );
  assert.throws(
    () => requireCanonicalDailyPhaseBriefWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const evidence = minimalEvidence(workspace);
  assert.throws(
    () =>
      buildDailyPhaseBriefs({
        restaurantId: nbspPadded,
        ...evidence,
        now: new Date("2026-08-03T16:00:00.000Z")
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Daily phase briefs require a restaurant."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeDailyPhaseBriefRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalDailyPhaseBriefRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Daily phase briefs require a restaurant."
  );
  assert.throws(
    () =>
      buildDailyPhaseBriefs({
        restaurantId: emSpacePadded,
        ...evidence,
        now: new Date("2026-08-03T16:00:00.000Z")
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Daily phase briefs require a restaurant."
  );
});

test("Daily-phase-brief workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeDailyPhaseBriefRestaurantId(""), null);
  assert.equal(canonicalizeDailyPhaseBriefRestaurantId("   "), null);
  assert.equal(canonicalizeDailyPhaseBriefRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeDailyPhaseBriefRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalDailyPhaseBriefRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Daily phase briefs require a restaurant."
  );
  assert.throws(
    () => requireCanonicalDailyPhaseBriefRestaurantId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Daily phase briefs require a restaurant."
  );
  assert.throws(
    () => requireCanonicalDailyPhaseBriefRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Daily phase briefs require a restaurant."
  );
  assert.throws(
    () => requireCanonicalDailyPhaseBriefWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalDailyPhaseBriefWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
