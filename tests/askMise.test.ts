import assert from "node:assert/strict";
import test from "node:test";

import {
  answerAskMise,
  classifyAskMiseIntent,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import type { MessageKey, MessageValues } from "../i18n/catalog";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { WasteAnalysisSummary } from "../services/domain/wasteAnalysis";

const helpers: AskMiseHelpers = {
  formatCompactCurrency: (value) => `$${value}`,
  formatNumber: (value) => String(value),
  locale: "en",
  t: (key: MessageKey, values: MessageValues = {}) => {
    const suffix = Object.entries(values)
      .map(([name, value]) => `${name}=${value}`)
      .join(",");
    return suffix ? `${key}:{${suffix}}` : key;
  }
};

function task(overrides: Partial<OperationalTodayTask> = {}): OperationalTodayTask {
  return {
    id: "task-1",
    restaurantId: "rest-1",
    source: { kind: "inventory", id: "item-1", status: "Low" },
    title: "Review Chicken thigh reorder",
    detail: "Count is low",
    priority: "high",
    dueAt: null,
    dueDate: null,
    action: {
      intent: "review_recommendation",
      label: "Review",
      route: "/orders",
      entityId: "rec-1"
    },
    requiredRole: "member",
    status: "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "source"
    },
    ...overrides
  };
}

function summary(overrides: Partial<AskMiseRestaurantContext> = {}): AskMiseRestaurantContext {
  return {
    restaurantName: "Demo Kitchen",
    miseStatus: "Ready",
    salesToday: 1240,
    itemsSold: 86,
    topItems: [{ item_name: "Chicken Bowl" }],
    pendingRecommendations: 2,
    importantInsight: null,
    attentionCards: [
      {
        id: "attn-1",
        title: "Chicken thigh low",
        detail: "Below reorder",
        actionLabel: "Open",
        route: "/inventory",
        severity: "warning"
      }
    ],
    inventoryHealth: { low: 1, critical: 1 },
    operationalTasks: [task()],
    restaurantCurrency: "USD",
    ...overrides
  };
}

test("classifyAskMiseIntent maps operational questions", () => {
  assert.equal(classifyAskMiseIntent("Which stock is low?"), "stock");
  assert.equal(classifyAskMiseIntent("What orders need review?"), "orders");
  assert.equal(classifyAskMiseIntent("How are sales today?"), "sales");
  assert.equal(classifyAskMiseIntent("What are my top priorities today?"), "priorities");
  assert.equal(classifyAskMiseIntent("Give me a quick briefing"), "briefing");
  assert.equal(classifyAskMiseIntent("What should we prep around?"), "prep");
  assert.equal(classifyAskMiseIntent("Anything overstocked or at waste risk?"), "waste");
  assert.equal(classifyAskMiseIntent("hello there"), "general");
});

test("answerAskMise thinks through restaurant stock risk before answering", () => {
  const reply = answerAskMise({
    question: "Which stock is low?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary(),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "stock");
  assert.ok(reply.thinkingSteps.length >= 3);
  assert.match(reply.thinkingSteps[0]!, /ask\.thinking\.restaurant/);
  assert.match(reply.thinkingSteps.at(-1)!, /ask\.thinking\.compose/);
  assert.match(reply.answer, /ask\.answer\.stock\.other/);
  assert.match(reply.answer, /Chicken thigh low/);
  assert.equal(reply.showPriorities, false);
});

test("answerAskMise returns priority cards for priority questions", () => {
  const openTask = task({ id: "task-priority" });
  const reply = answerAskMise({
    question: "What are my top priorities today?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: null,
      service_style: "full_service",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({ operationalTasks: [openTask], inventoryHealth: { low: 0, critical: 0 } }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "priorities");
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "task-priority");
  assert.match(reply.answer, /ask\.answer\.prioritiesLead/);
});

test("answerAskMise briefing uses restaurant name and board counts", () => {
  const reply = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: {
      name: "Harbor Bistro",
      cuisine_type: "Seafood",
      service_style: "full_service",
      timezone: "America/Los_Angeles",
      currency: "USD"
    },
    summary: summary({ restaurantName: "Harbor Bistro", salesToday: 980 }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "briefing");
  assert.match(reply.answer, /Harbor Bistro/);
  assert.match(reply.answer, /ask\.answer\.briefing\.board/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.sales")));
});

function wasteAnalysis(
  overrides: Partial<WasteAnalysisSummary> = {}
): WasteAnalysisSummary {
  return {
    restaurantId: "rest-1",
    operatingDate: "2026-08-31",
    windowDays: 7,
    windowStart: "2026-08-25",
    priorWindowStart: "2026-08-18",
    priorWindowEnd: "2026-08-24",
    status: "attention",
    reasons: ["repeat_item"],
    recommendedAction: "review_repeat_item",
    primaryItemId: "inv-herbs",
    eventCount: 4,
    itemCount: 1,
    estimatedCost: 12,
    costComplete: true,
    pricedEventCount: 4,
    unpricedEventCount: 0,
    unmatchedEventCount: 0,
    priorEventCount: 1,
    priorEstimatedCost: 3,
    priorCostComplete: true,
    trend: "up",
    topItems: [
      {
        inventoryItemId: "inv-herbs",
        itemName: "Basil",
        category: "Produce",
        eventCount: 4,
        distinctDayCount: 3,
        quantity: 600,
        canonicalUnit: "g",
        estimatedCost: 12,
        costComplete: true,
        shareOfEstimatedCost: 1,
        lastWastedAt: "2026-08-31T18:00:00.000Z"
      }
    ],
    recentEvents: [],
    historyTruncated: false,
    ...overrides
  };
}

const restaurant = {
  name: "Demo Kitchen",
  cuisine_type: "American",
  service_style: "fast_casual" as const,
  timezone: "America/New_York",
  currency: "USD"
};

test("answerAskMise waste fails closed when ledger analysis is unavailable", () => {
  const reply = answerAskMise({
    question: "How does recorded waste look?",
    restaurant,
    summary: summary(),
    insights: [
      {
        id: "insight-waste",
        restaurant_id: "rest-1",
        insight_type: "waste",
        title: "Overstock tomatoes",
        description: "Mapped demand says carry less",
        recommended_action: "Trim the next tomato order",
        severity: "warning",
        created_at: "2026-08-31T12:00:00.000Z"
      }
    ],
    wasteAnalysis: null,
    helpers
  });

  assert.equal(reply.intent, "waste");
  assert.match(reply.answer, /ask\.answer\.waste\.unavailable/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.waste\.clear|Overstock tomatoes/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.waste.unavailable")));
});

test("answerAskMise waste uses ledger analysis instead of inventing an all-clear", () => {
  const noData = wasteAnalysis({
    status: "no_data",
    reasons: ["no_records"],
    recommendedAction: "start_logging",
    primaryItemId: null,
    eventCount: 0,
    itemCount: 0,
    estimatedCost: null,
    costComplete: true,
    pricedEventCount: 0,
    unpricedEventCount: 0,
    priorEventCount: 0,
    priorEstimatedCost: null,
    priorCostComplete: true,
    trend: "no_baseline",
    topItems: []
  });

  const emptyReply = answerAskMise({
    question: "Anything at waste risk?",
    restaurant,
    summary: summary(),
    insights: [],
    wasteAnalysis: noData,
    helpers
  });
  assert.equal(emptyReply.intent, "waste");
  assert.match(emptyReply.answer, /ask\.answer\.waste\.no_records/);
  assert.match(emptyReply.answer, /ask\.answer\.waste\.next\.log/);
  assert.doesNotMatch(emptyReply.answer, /ask\.answer\.waste\.clear/);

  const attentionReply = answerAskMise({
    question: "How does recorded waste look?",
    restaurant,
    summary: summary(),
    insights: [],
    wasteAnalysis: wasteAnalysis(),
    helpers
  });
  assert.match(attentionReply.answer, /ask\.answer\.waste\.attention/);
  assert.match(attentionReply.answer, /Basil/);
  assert.match(attentionReply.answer, /ask\.answer\.waste\.repeat/);
  assert.match(attentionReply.answer, /ask\.answer\.waste\.next\.review/);
  assert.ok(attentionReply.thinkingSteps.some((step) => step.includes("ask.thinking.waste.attention")));

  const costReply = answerAskMise({
    question: "waste",
    restaurant,
    summary: summary(),
    insights: [],
    wasteAnalysis: wasteAnalysis({
      status: "attention",
      reasons: ["unpriced_records"],
      recommendedAction: "complete_cost_setup",
      unpricedEventCount: 2,
      costComplete: false,
      estimatedCost: null
    }),
    helpers
  });
  assert.match(costReply.answer, /ask\.answer\.waste\.cost_setup/);
  assert.match(costReply.answer, /ask\.answer\.waste\.next\.cost/);

  const monitoringReply = answerAskMise({
    question: "waste",
    restaurant,
    summary: summary(),
    insights: [],
    wasteAnalysis: wasteAnalysis({
      status: "monitoring",
      reasons: ["within_baseline"],
      recommendedAction: "keep_logging",
      trend: "flat"
    }),
    helpers
  });
  assert.match(monitoringReply.answer, /ask\.answer\.waste\.monitoring/);
  assert.match(monitoringReply.answer, /ask\.answer\.waste\.costKnown/);
  assert.match(monitoringReply.answer, /ask\.answer\.waste\.next\.continue/);
});
