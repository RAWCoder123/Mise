import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import type { Insight, InventoryItem, InventoryOutlookItem, PosSale, TodaySummary } from "../types/mise";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { WasteAnalysisSummary } from "../services/domain/wasteAnalysis";

function wasteSummary(): WasteAnalysisSummary {
  return {
    restaurantId: "r1",
    operatingDate: "2026-08-01",
    windowDays: 7,
    windowStart: "2026-07-26",
    priorWindowStart: "2026-07-19",
    priorWindowEnd: "2026-07-25",
    status: "attention",
    reasons: ["repeat_item"],
    recommendedAction: "review_repeat_item",
    primaryItemId: "inv-herbs",
    eventCount: 3,
    itemCount: 1,
    estimatedCost: 18.5,
    costComplete: true,
    pricedEventCount: 3,
    unpricedEventCount: 0,
    unmatchedEventCount: 0,
    priorEventCount: 1,
    priorEstimatedCost: 5,
    priorCostComplete: true,
    trend: "up",
    topItems: [
      {
        inventoryItemId: "inv-herbs",
        itemName: "Herbs",
        category: "Produce",
        eventCount: 3,
        distinctDayCount: 2,
        quantity: 900,
        canonicalUnit: "g",
        estimatedCost: 18.5,
        costComplete: true,
        shareOfEstimatedCost: 1,
        lastWastedAt: "2026-08-01T20:00:00.000Z"
      }
    ],
    recentEvents: [],
    historyTruncated: false
  };
}

function sale(partial: Partial<PosSale> & Pick<PosSale, "item_name">): PosSale {
  return {
    id: "sale-1",
    restaurant_id: "r1",
    sale_date: "2026-08-01",
    category: "Entree",
    quantity_sold: 4,
    gross_sales: 40,
    net_sales: 38,
    source_pos: "demo",
    created_at: "2026-08-01T12:00:00.000Z",
    ...partial
  };
}

function insight(
  partial: Partial<Insight> & Pick<Insight, "id" | "insight_type" | "title">
): Insight {
  return {
    restaurant_id: "r1",
    description: "desc",
    recommended_action: "Do the thing",
    why_it_matters: "It matters",
    severity: "warning",
    created_at: "2026-08-01T12:00:00.000Z",
    ...partial
  };
}

function summary(overrides: Partial<TodaySummary> = {}): TodaySummary {
  return {
    restaurantName: "Harbor",
    operatingSummary: "Two items need attention before tomorrow.",
    miseStatus: "Watch",
    learningNote: "Learning",
    salesToday: 1200,
    netSalesToday: 1100,
    itemsSold: 88,
    topItems: [sale({ item_name: "Chicken Bowl", quantity_sold: 12, gross_sales: 144 })],
    lowStockCount: 2,
    inventoryAlerts: 2,
    pendingRecommendations: 3,
    importantInsight: null,
    attentionCards: [
      {
        id: "att-1",
        title: "Chicken thighs low",
        detail: "Coverage under one day",
        actionLabel: "Review",
        route: "/inventory",
        severity: "urgent"
      }
    ],
    salesTrend: [],
    recipeBaseline: {
      menuItemsTracked: 0,
      ingredientMappings: 0,
      inventoryItemsLinked: 0,
      posItemsCovered: 0,
      posItemsMissingRecipes: [],
      coveragePercent: 0,
      credibilityLabel: "Thin",
      operatorCopy: "",
      items: []
    },
    workflow: {
      posMenuItemsCovered: 0,
      recipeLinks: 0,
      projectedDepletedItems: 2,
      pendingOrderItems: 3
    },
    credibility: {
      score: 62,
      label: "Building trust",
      evidence: ["Sales history"],
      nextStep: "Keep logging deliveries"
    },
    ...overrides
  };
}

function task(
  partial: Partial<OperationalTodayTask> & Pick<OperationalTodayTask, "id" | "status">
): OperationalTodayTask {
  return {
    restaurantId: "r1",
    source: { kind: "inventory", id: partial.id, status: "open" },
    title: "Check walk-in",
    detail: "Count proteins",
    priority: "normal",
    dueAt: null,
    dueDate: "2026-08-01",
    action: {
      intent: "update_inventory_count",
      label: "Count",
      route: "/inventory",
      entityId: null
    },
    requiredRole: "member",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "Derived from inventory outlook"
    },
    ...partial
  };
}

test("buildDailyOpsReport assembles closeout sections", () => {
  const report = buildDailyOpsReport({
    restaurantName: "Harbor",
    operatingDate: "2026-08-01",
    restaurantTimeZone: "America/New_York",
    restaurantCurrency: "USD",
    summary: summary(),
    inventoryHealth: { good: 8, watch: 2, low: 1, critical: 1 },
    operationalTasks: [
      task({ id: "t1", status: "open" }),
      task({ id: "t2", status: "completed" }),
      task({ id: "t3", status: "open" })
    ],
    insights: [
      insight({
        id: "i-waste",
        insight_type: "waste",
        title: "Herbs overstocked",
        recommended_action: "Special the herbs tonight",
        why_it_matters: "Wilts tomorrow",
        severity: "warning"
      }),
      insight({
        id: "i-prep",
        insight_type: "prep",
        title: "Batch sauces early",
        severity: "info"
      }),
      insight({
        id: "i-inv",
        insight_type: "inventory",
        title: "Thighs critical",
        severity: "urgent"
      })
    ],
    salesTrend: [
      { date: "2026-07-31", sales: 1000 },
      { date: "2026-08-01", sales: 1200 }
    ],
    operatorTasksOpen: 2,
    wasteAnalysis: wasteSummary(),
    supplierReliability: {
      totalDeliveries: 2,
      supplierCount: 1,
      attentionSupplierCount: 1,
      overallOnTimeRate: 0.5,
      overallMatchedDeliveryRate: 0.5,
      suppliers: [
        {
          supplierId: "00000000-0000-4000-8000-000000000402",
          supplierName: "Produce Co.",
          status: "at_risk",
          deliveryCount: 2,
          onTimeCount: 1,
          measurableDeliveryCount: 2,
          issueDeliveryCount: 1,
          unverifiedDeliveryCount: 0,
          discrepancyLineCount: 1,
          onTimeRate: 0.5,
          matchedDeliveryRate: 0.5,
          fulfillmentRate: 0.9,
          reasons: ["late_deliveries"],
          lastDeliveryAt: "2026-08-01T10:00:00.000Z",
          relatedOrderIds: ["order-1", "order-2"]
        }
      ]
    },
    deliveries: [
      {
        id: "d1",
        itemName: "Chicken Thigh",
        quantity: 40,
        unit: "lb",
        note: "Cold truck",
        at: "2026-08-01T10:00:00.000Z"
      }
    ],
    askBriefingText: "Harbor is on watch with open tasks."
  });

  assert.equal(report.day.operatingDate, "2026-08-01");
  assert.equal(report.day.restaurantTimeZone, "America/New_York");
  assert.equal(report.closeout.completedTasks, 1);
  assert.equal(report.sales.salesToday, 1200);
  assert.equal(report.sales.salesTrendDirection, "up");
  assert.equal(report.sales.priorSales, 1000);
  assert.equal(report.sales.salesTrendDelta, 200);
  assert.equal(report.throughput.openTasks, 2);
  assert.equal(report.throughput.completedTasks, 1);
  assert.equal(report.throughput.operatorTasksOpen, 2);
  assert.equal(report.deliveriesToday.count, 1);
  assert.equal(report.ordering.pendingRecommendations, 3);
  assert.equal(report.supplierReliability.attentionSupplierCount, 1);
  assert.equal(report.supplierReliability.suppliers[0]?.supplierName, "Produce Co.");
  assert.equal(report.wasteAnalysis?.estimatedCost, 18.5);
  assert.equal(report.wasteAnalysis?.recommendedAction, "review_repeat_item");
  assert.equal(report.signalsByType.length, 5);

  const waste = report.signalsByType.find((signal) => signal.type === "waste");
  assert.ok(waste);
  assert.match(waste!.line, /Special the herbs/);
  assert.match(waste!.line, /Wilts tomorrow/);

  const salesSignal = report.signalsByType.find((signal) => signal.type === "sales");
  assert.ok(salesSignal?.line.includes("No sales signal"));

  assert.equal(report.managerAdvice.actions.length, 3);
  assert.equal(report.managerAdvice.actions[0]?.severity, "urgent");
  assert.equal(report.managerAdvice.askBriefingText, "Harbor is on watch with open tasks.");
  assert.equal(report.learning.credibilityScore, 62);
});

test("buildDailyOpsReport estimates dollars at risk from outlooks", () => {
  const item: InventoryItem = {
    id: "inv-1",
    restaurant_id: "r1",
    item_name: "Chicken",
    category: "Protein",
    unit: "lb",
    current_quantity: 4,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 5,
    supplier_id: "10000000-0000-4000-8000-000000000005",
    supplier_name: "Sysco",
    last_updated: "2026-08-01T12:00:00.000Z"
  };
  const outlooks: InventoryOutlookItem[] = [
    {
      item,
      prediction: {
        averageDailyUsage: 6,
        historySampleDays: 7,
        historySource: "restaurant_history",
        todayDepletion: 6,
        projectedQuantity: 0,
        projectedStatus: "Critical",
        daysCoverage: 0,
        coverageLabel: "Out",
        demandTrend: "normal",
        trendLabel: "Steady",
        suggestedOrderQuantity: 20,
        suggestedAction: "Order",
        urgency: "high",
        basis: "history",
        depletionCopy: "",
        confidenceCopy: "",
        recommendationCopy: "",
        whyItMatters: "",
        countEvidence: "verified_count",
        countedAt: "2026-08-01T08:00:00.000Z",
        countAgeHours: 6,
        countFreshness: "fresh",
        unattributedTodayDepletion: 0,
        isTemporallyAuthoritative: true
      }
    }
  ];

  const report = buildDailyOpsReport({
    restaurantName: "Harbor",
    operatingDate: "2026-08-01",
    restaurantTimeZone: "America/New_York",
    restaurantCurrency: "USD",
    summary: summary(),
    inventoryHealth: { good: 0, watch: 0, low: 0, critical: 1 },
    operationalTasks: [],
    insights: [],
    inventoryOutlooks: outlooks
  });

  // shortfall to par = 20, unit cost 5 → $100
  assert.equal(report.inventoryRisk.estimatedDollarsAtRisk, 100);
});

test("buildDailyOpsReport stubs empty deliveries and all-clear advice", () => {
  const report = buildDailyOpsReport({
    restaurantName: "Harbor",
    operatingDate: "2026-08-01",
    restaurantTimeZone: "America/New_York",
    restaurantCurrency: "USD",
    summary: summary({
      inventoryAlerts: 0,
      pendingRecommendations: 0,
      attentionCards: [],
      lowStockCount: 0
    }),
    inventoryHealth: { good: 10, watch: 0, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    operatorTasksOpen: 0
  });

  assert.equal(report.deliveriesToday.count, 0);
  assert.equal(report.managerAdvice.actions[0]?.id, "all-clear");
});

test("buildDailyOpsReport refuses all-clear when waste analysis needs attention", () => {
  const report = buildDailyOpsReport({
    restaurantName: "Harbor",
    operatingDate: "2026-08-01",
    restaurantTimeZone: "America/New_York",
    restaurantCurrency: "USD",
    summary: summary({
      inventoryAlerts: 0,
      pendingRecommendations: 0,
      attentionCards: [],
      lowStockCount: 0
    }),
    inventoryHealth: { good: 10, watch: 0, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    operatorTasksOpen: 0,
    wasteAnalysis: wasteSummary()
  });

  assert.ok(!report.managerAdvice.actions.some((action) => action.id === "all-clear"));
  const wasteAction = report.managerAdvice.actions.find((action) => action.id === "waste-attention");
  assert.ok(wasteAction);
  assert.equal(wasteAction!.route, "/more/waste");
  assert.equal(wasteAction!.severity, "warning");
  assert.match(wasteAction!.title, /waste/i);
  assert.match(wasteAction!.detail, /Herbs/);
});

test("buildDailyOpsReport refuses all-clear when suppliers need reliability follow-up", () => {
  const report = buildDailyOpsReport({
    restaurantName: "Harbor",
    operatingDate: "2026-08-01",
    restaurantTimeZone: "America/New_York",
    restaurantCurrency: "USD",
    summary: summary({
      inventoryAlerts: 0,
      pendingRecommendations: 0,
      attentionCards: [],
      lowStockCount: 0
    }),
    inventoryHealth: { good: 10, watch: 0, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    operatorTasksOpen: 0,
    supplierReliability: {
      totalDeliveries: 2,
      supplierCount: 1,
      attentionSupplierCount: 1,
      overallOnTimeRate: 0.5,
      overallMatchedDeliveryRate: 0.5,
      suppliers: [
        {
          supplierId: "00000000-0000-4000-8000-000000000402",
          supplierName: "Produce Co.",
          status: "at_risk",
          deliveryCount: 2,
          onTimeCount: 1,
          measurableDeliveryCount: 2,
          issueDeliveryCount: 1,
          unverifiedDeliveryCount: 0,
          discrepancyLineCount: 1,
          onTimeRate: 0.5,
          matchedDeliveryRate: 0.5,
          fulfillmentRate: 0.9,
          reasons: ["late_deliveries"],
          lastDeliveryAt: "2026-08-01T10:00:00.000Z",
          relatedOrderIds: ["order-1"]
        }
      ]
    }
  });

  assert.ok(!report.managerAdvice.actions.some((action) => action.id === "all-clear"));
  const supplierAction = report.managerAdvice.actions.find(
    (action) => action.id === "supplier-reliability"
  );
  assert.ok(supplierAction);
  assert.equal(supplierAction!.route, "/orders");
  assert.equal(supplierAction!.severity, "urgent");
  assert.match(supplierAction!.title, /supplier/i);
  assert.match(supplierAction!.detail, /Produce Co\./);
});

test("buildDailyOpsReport keeps all-clear when waste is only monitoring", () => {
  const report = buildDailyOpsReport({
    restaurantName: "Harbor",
    operatingDate: "2026-08-01",
    restaurantTimeZone: "America/New_York",
    restaurantCurrency: "USD",
    summary: summary({
      inventoryAlerts: 0,
      pendingRecommendations: 0,
      attentionCards: [],
      lowStockCount: 0
    }),
    inventoryHealth: { good: 10, watch: 0, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    operatorTasksOpen: 0,
    wasteAnalysis: {
      ...wasteSummary(),
      status: "monitoring",
      reasons: ["within_baseline"],
      recommendedAction: "keep_logging"
    },
    supplierReliability: {
      totalDeliveries: 2,
      supplierCount: 1,
      attentionSupplierCount: 0,
      overallOnTimeRate: 1,
      overallMatchedDeliveryRate: 1,
      suppliers: [
        {
          supplierId: "00000000-0000-4000-8000-000000000402",
          supplierName: "Produce Co.",
          status: "reliable",
          deliveryCount: 2,
          onTimeCount: 2,
          measurableDeliveryCount: 2,
          issueDeliveryCount: 0,
          unverifiedDeliveryCount: 0,
          discrepancyLineCount: 0,
          onTimeRate: 1,
          matchedDeliveryRate: 1,
          fulfillmentRate: 1,
          reasons: ["matched_history"],
          lastDeliveryAt: "2026-08-01T10:00:00.000Z",
          relatedOrderIds: ["order-1"]
        }
      ]
    }
  });

  assert.equal(report.managerAdvice.actions[0]?.id, "all-clear");
});
