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

test("answerAskMise prep stays blocked when Today has an open inventory count task", () => {
  const countTask = task({
    id: "task-count",
    source: { kind: "inventory_count_session", id: "session-1", status: "in_progress" },
    title: "Continue inventory count",
    detail: "Finish counting items and submit for approval.",
    action: {
      intent: "continue_inventory_count_session",
      label: "Continue count",
      route: "/inventory/count",
      entityId: "session-1"
    }
  });
  const reply = answerAskMise({
    question: "What should we prep around?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      operationalTasks: [countTask],
      inventoryHealth: { low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: []
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "prep");
  assert.match(reply.answer, /ask\.answer\.prep\.tasks\.lead/);
  assert.match(reply.answer, /Continue inventory count/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.prep\.clear/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.prep.tasks")));
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "task-count");
  assert.equal(reply.priorities[0]?.action.route, "/inventory/count");
});

test("answerAskMise prep clear only when insights and count tasks are absent", () => {
  const orderTask = task({
    id: "task-order",
    source: { kind: "recommendation", id: "rec-9", status: "pending" },
    title: "Review supplier draft",
    action: {
      intent: "review_recommendation",
      label: "Review",
      route: "/orders",
      entityId: "rec-9"
    }
  });
  const reply = answerAskMise({
    question: "What should we prep around?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      operationalTasks: [orderTask],
      inventoryHealth: { low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: []
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "prep");
  assert.match(reply.answer, /ask\.answer\.prep\.clear/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.prep\.tasks/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.prep.clear")));
});

test("answerAskMise prep pairs count tasks with prep insights", () => {
  const beginCount = task({
    id: "task-begin-count",
    source: { kind: "inventory_count_session", id: "suggested_begin", status: "suggested" },
    title: "Start inventory count",
    action: {
      intent: "begin_inventory_count_session",
      label: "Start count",
      route: "/inventory/count",
      entityId: null
    }
  });
  const reply = answerAskMise({
    question: "Prep list for tonight?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      operationalTasks: [beginCount],
      inventoryHealth: { low: 1, critical: 0 }
    }),
    insights: [
      {
        id: "insight-prep-1",
        restaurant_id: "rest-1",
        insight_type: "prep",
        severity: "warning",
        title: "Chicken Bowl depends on low stock",
        description: "Top seller uses low chicken thigh.",
        recommended_action: "Confirm chicken thigh before prep.",
        created_at: "2026-09-01T12:00:00.000Z",
        presentation: {
          code: "insight.rule.prep.low_stock",
          values: {
            menuItemName: "Chicken Bowl",
            inventoryItemName: "Chicken thigh",
            supplierName: "Sysco"
          }
        }
      }
    ],
    helpers
  });

  assert.equal(reply.intent, "prep");
  assert.match(reply.answer, /ask\.answer\.prep\.tasks\.lead/);
  assert.match(reply.answer, /Start inventory count/);
  assert.match(reply.answer, /ask\.answer\.prep\.named/);
  assert.match(reply.answer, /Chicken Bowl/);
  assert.equal(reply.priorities[0]?.id, "task-begin-count");
});
