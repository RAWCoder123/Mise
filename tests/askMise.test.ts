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

test("answerAskMise refuses orders-clear when draft or send follow-through remains", () => {
  const sendTask = task({
    id: "task-send",
    source: { kind: "order", id: "order-1", status: "draft" },
    title: "Send Harbor Produce order",
    detail: "Draft is ready to leave the restaurant.",
    presentation: {
      code: "today.order.send",
      values: { supplierName: "Harbor Produce", deliveryDate: null }
    },
    action: {
      intent: "send_supplier_order",
      label: "Review and send",
      route: "/orders/order-1",
      entityId: "order-1"
    }
  });
  const reply = answerAskMise({
    question: "What orders need attention?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      pendingRecommendations: 0,
      inventoryHealth: { low: 0, critical: 0 },
      attentionCards: [],
      operationalTasks: [sendTask]
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "orders");
  assert.doesNotMatch(reply.answer, /ask\.answer\.ordersClear/);
  assert.match(reply.answer, /ask\.answer\.orders\.followThrough\.one/);
  assert.match(reply.answer, /ask\.answer\.orders\.followThrough\.named/);
  assert.match(reply.answer, /ask\.answer\.orders\.followThrough\.next/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.orders.followThrough")));
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "task-send");
});

test("answerAskMise keeps review answers and appends named draft follow-through", () => {
  const draftTask = task({
    id: "task-draft",
    source: { kind: "recommendation", id: "rec-2", status: "approved" },
    title: "Prepare Harbor Produce supplier draft",
    detail: "Approved item still needs a supplier draft.",
    presentation: {
      code: "today.recommendation.prepare_draft",
      values: { itemName: "Chicken thigh", supplierName: "Harbor Produce" }
    },
    action: {
      intent: "prepare_supplier_draft",
      label: "Prepare draft",
      route: "/orders",
      entityId: "rec-2"
    }
  });
  const reply = answerAskMise({
    question: "What supplier orders are waiting?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      pendingRecommendations: 1,
      operationalTasks: [task({ id: "task-review" }), draftTask]
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "orders");
  assert.match(reply.answer, /ask\.answer\.orders\.one/);
  assert.match(reply.answer, /ask\.answer\.orders\.followThrough\.named/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.orders.pending")));
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "task-draft");
});

test("answerAskMise ordersClear only when review and follow-through are empty", () => {
  const reply = answerAskMise({
    question: "Any orders to place?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      pendingRecommendations: 0,
      inventoryHealth: { low: 0, critical: 0 },
      attentionCards: [],
      operationalTasks: []
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "orders");
  assert.equal(reply.answer, "ask.answer.ordersClear");
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.orders.clear")));
  assert.equal(reply.showPriorities, false);
});