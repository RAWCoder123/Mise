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

test("answerAskMise prep refuses clear while before-prep restaurant tasks remain open", () => {
  const prepTask = task({
    id: "prep-window-1",
    title: "Stage prep pans",
    source: { kind: "restaurant_task", id: "prep-window-1", status: "waiting" },
    serviceWindow: "before_prep",
    action: {
      intent: "open_restaurant_task",
      label: "Open task",
      route: "/tasks/prep-window-1",
      entityId: "prep-window-1"
    }
  });
  const otherTask = task({
    id: "orders-task",
    title: "Review reorder",
    serviceWindow: "before_supplier_cutoff",
    source: { kind: "restaurant_task", id: "orders-task", status: "waiting" },
    action: {
      intent: "open_restaurant_task",
      label: "Open task",
      route: "/tasks/orders-task",
      entityId: "orders-task"
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
      operationalTasks: [otherTask, prepTask],
      inventoryHealth: { low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: []
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "prep");
  assert.match(reply.answer, /ask\.answer\.prep\.tasks/);
  assert.match(reply.answer, /Stage prep pans/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.prep\.clear/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.prep.tasks")));
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "prep-window-1");
});

test("answerAskMise prep clear stays available without before-prep restaurant tasks", () => {
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
      operationalTasks: [
        task({
          id: "cutoff-task",
          title: "Send supplier draft",
          source: { kind: "restaurant_task", id: "cutoff-task", status: "waiting" },
          serviceWindow: "before_supplier_cutoff"
        })
      ],
      inventoryHealth: { low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: []
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "prep");
  assert.match(reply.answer, /ask\.answer\.prep\.clear/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.prep.clear")));
});
