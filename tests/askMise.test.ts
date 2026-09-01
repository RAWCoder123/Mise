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
    inventoryHealth: { watch: 0, low: 1, critical: 1 },
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

test("answerAskMise refuses service-ready stock when only Watch inventory remains", () => {
  const watchTask = task({
    id: "task-watch",
    source: { kind: "inventory", id: "item-watch", status: "Watch" },
    title: "Confirm basil count",
    action: {
      intent: "update_inventory_count",
      label: "Confirm count",
      route: "/inventory",
      entityId: "item-watch"
    }
  });
  const reply = answerAskMise({
    question: "Which stock is low?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      inventoryHealth: { watch: 2, low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: [],
      operationalTasks: [watchTask]
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "stock");
  assert.match(reply.answer, /ask\.answer\.stock\.watch\.other/);
  assert.match(reply.answer, /ask\.answer\.stock\.watch\.next/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.stockClear/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.stock.watch")));
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "task-watch");
});

test("answerAskMise grounds sales answers in open POS connect or repair tasks", () => {
  const posTask = task({
    id: "task-pos",
    source: { kind: "integration", id: "pos", status: "missing" },
    title: "Connect restaurant sales",
    detail: "Connect a POS provider before relying on live sales.",
    action: {
      intent: "connect_pos",
      label: "Connect POS",
      route: "/settings/pos",
      entityId: null
    },
    requiredRole: "owner_admin"
  });
  const reply = answerAskMise({
    question: "How are sales today?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      salesToday: 0,
      itemsSold: 0,
      topItems: [],
      operationalTasks: [posTask]
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "sales");
  assert.match(reply.answer, /ask\.answer\.sales\.pos\.one/);
  assert.match(reply.answer, /ask\.answer\.sales\.pos\.unavailable/);
  assert.match(reply.answer, /Connect restaurant sales/);
  assert.doesNotMatch(reply.answer, /^ask\.answer\.sales:/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.sales.pos")));
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "task-pos");
});

test("answerAskMise labels observed sales provisional when POS repair remains open", () => {
  const repairTask = task({
    id: "task-pos-repair",
    source: { kind: "integration", id: "pos-1", status: "error" },
    title: "Fix Square sales connection",
    action: {
      intent: "manage_pos_connection",
      label: "Review connection",
      route: "/settings/pos",
      entityId: "pos-1"
    },
    requiredRole: "owner_admin"
  });
  const reply = answerAskMise({
    question: "How are sales today?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      salesToday: 420,
      itemsSold: 31,
      operationalTasks: [repairTask]
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "sales");
  assert.match(reply.answer, /ask\.answer\.sales\.pos\.provisional/);
  assert.match(reply.answer, /sales=\$420/);
  assert.equal(reply.priorities[0]?.id, "task-pos-repair");
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
    summary: summary({
      operationalTasks: [openTask],
      inventoryHealth: { watch: 0, low: 0, critical: 0 }
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "priorities");
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "task-priority");
  assert.match(reply.answer, /ask\.answer\.prioritiesLead/);
});

test("answerAskMise priorities refuses all-clear when only Watch inventory remains", () => {
  const reply = answerAskMise({
    question: "What should I focus on today?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: null,
      service_style: "full_service",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      pendingRecommendations: 0,
      inventoryHealth: { watch: 2, low: 0, critical: 0 },
      attentionCards: [
        {
          id: "attn-watch",
          title: "Basil on Watch",
          detail: "Confirm count",
          actionLabel: "Open",
          route: "/inventory",
          severity: "info"
        }
      ],
      operationalTasks: []
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "priorities");
  assert.match(reply.answer, /ask\.answer\.stock\.watch\.other/);
  assert.match(reply.answer, /ask\.answer\.stock\.watch\.named/);
  assert.match(reply.answer, /Basil on Watch/);
  assert.match(reply.answer, /ask\.answer\.stock\.watch\.next/);
  assert.match(reply.answer, /ask\.answer\.prioritiesNoInsight/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.fallback/);
  assert.equal(reply.showPriorities, false);
  assert.equal(reply.priorities.length, 0);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.stock.watch")));
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.orders.clear")));
});

test("answerAskMise priorities prefers POS then Watch tasks and grounds sales thinking", () => {
  const watchTask = task({
    id: "task-watch-priorities",
    source: { kind: "inventory", id: "item-watch", status: "Watch" },
    title: "Confirm basil count",
    action: {
      intent: "update_inventory_count",
      label: "Confirm count",
      route: "/inventory",
      entityId: "item-watch"
    }
  });
  const posTask = task({
    id: "task-pos-priorities",
    source: { kind: "integration", id: "pos-1", status: "error" },
    title: "Reconnect Square",
    action: {
      intent: "repair_pos_connection",
      label: "Repair POS",
      route: "/settings/pos",
      entityId: "pos-1"
    }
  });
  const otherTask = task({
    id: "task-other-priorities",
    title: "Approve produce ticket"
  });
  const reply = answerAskMise({
    question: "What are my top priorities today?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: null,
      service_style: "full_service",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      pendingRecommendations: 1,
      inventoryHealth: { watch: 1, low: 0, critical: 0 },
      operationalTasks: [otherTask, watchTask, posTask],
      salesToday: 0,
      itemsSold: 0
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "priorities");
  assert.match(reply.answer, /ask\.answer\.prioritiesLead/);
  assert.equal(reply.showPriorities, true);
  assert.equal(reply.priorities[0]?.id, "task-pos-priorities");
  assert.equal(reply.priorities[1]?.id, "task-watch-priorities");
  assert.equal(reply.priorities[2]?.id, "task-other-priorities");
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.stock.watch")));
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.sales.pos")));
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.orders.pending")));
});

test("answerAskMise priorities keeps fallback only when Watch stock, risk, and orders are clear", () => {
  const reply = answerAskMise({
    question: "What should I prioritize?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: null,
      service_style: "full_service",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      pendingRecommendations: 0,
      inventoryHealth: { watch: 0, low: 0, critical: 0 },
      attentionCards: [],
      operationalTasks: [],
      salesToday: 0,
      itemsSold: 0
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "priorities");
  assert.equal(reply.answer, "ask.answer.fallback");
  assert.equal(reply.showPriorities, false);
  assert.equal(reply.priorities.length, 0);
});

test("answerAskMise priorities surfaces pending orders when no open tasks remain", () => {
  const reply = answerAskMise({
    question: "What are my urgent priorities?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: null,
      service_style: "full_service",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      pendingRecommendations: 2,
      inventoryHealth: { watch: 0, low: 0, critical: 0 },
      attentionCards: [
        {
          id: "attn-order",
          title: "Produce ticket ready",
          detail: "Approve",
          actionLabel: "Open",
          route: "/orders",
          severity: "warning"
        }
      ],
      operationalTasks: []
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "priorities");
  assert.match(reply.answer, /ask\.answer\.orders\.other/);
  assert.match(reply.answer, /ask\.answer\.orders\.named/);
  assert.match(reply.answer, /Produce ticket ready/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.fallback/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.orders.pending")));
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
  assert.doesNotMatch(reply.answer, /ask\.answer\.briefing\.board\.core/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.sales")));
});

test("answerAskMise briefing refuses trusted stock clear when only Watch inventory remains", () => {
  const watchTask = task({
    id: "task-watch-brief",
    source: { kind: "inventory", id: "item-watch", status: "Watch" },
    title: "Confirm basil count",
    action: {
      intent: "update_inventory_count",
      label: "Confirm count",
      route: "/inventory",
      entityId: "item-watch"
    }
  });
  const reply = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      inventoryHealth: { watch: 2, low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: [],
      operationalTasks: [watchTask],
      salesToday: 640,
      itemsSold: 44
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "briefing");
  assert.match(reply.answer, /ask\.answer\.briefing\.board\.core/);
  assert.match(reply.answer, /ask\.answer\.briefing\.stock\.watch\.other/);
  assert.match(reply.answer, /ask\.answer\.briefing\.sales:/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.briefing\.board:/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.stock.watch")));
  assert.equal(reply.priorities[0]?.id, "task-watch-brief");
});

test("answerAskMise briefing treats sales as provisional when POS connection work is open", () => {
  const posTask = task({
    id: "task-pos-brief",
    source: { kind: "integration", id: "pos", status: "missing" },
    title: "Connect restaurant sales",
    detail: "Connect a POS provider before relying on live sales.",
    action: {
      intent: "connect_pos",
      label: "Connect POS",
      route: "/settings/pos",
      entityId: null
    },
    requiredRole: "owner_admin"
  });
  const reply = answerAskMise({
    question: "How are we looking overall?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      inventoryHealth: { watch: 0, low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: [],
      operationalTasks: [posTask],
      salesToday: 0,
      itemsSold: 0,
      topItems: []
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "briefing");
  assert.match(reply.answer, /ask\.answer\.briefing\.board\.core/);
  assert.match(reply.answer, /ask\.answer\.briefing\.stock\.clear/);
  assert.match(reply.answer, /ask\.answer\.briefing\.sales\.pos\.unavailable/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.briefing\.board:/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.sales.pos")));
  assert.equal(reply.priorities[0]?.id, "task-pos-brief");
});

test("answerAskMise briefing combines Watch stock and provisional POS sales caveats", () => {
  const watchTask = task({
    id: "task-watch-combo",
    source: { kind: "inventory", id: "item-watch", status: "Watch" },
    title: "Confirm cream count",
    action: {
      intent: "update_inventory_count",
      label: "Confirm count",
      route: "/inventory",
      entityId: "item-watch"
    }
  });
  const repairTask = task({
    id: "task-pos-combo",
    source: { kind: "integration", id: "pos-1", status: "error" },
    title: "Fix Square sales connection",
    action: {
      intent: "repair_pos_connection",
      label: "Repair POS",
      route: "/settings/pos",
      entityId: "pos-1"
    },
    requiredRole: "owner_admin"
  });
  const reply = answerAskMise({
    question: "Give me a status overview",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      inventoryHealth: { watch: 1, low: 0, critical: 0 },
      pendingRecommendations: 1,
      attentionCards: [],
      operationalTasks: [watchTask, repairTask],
      salesToday: 310,
      itemsSold: 22
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "briefing");
  assert.match(reply.answer, /ask\.answer\.briefing\.stock\.watch\.one/);
  assert.match(reply.answer, /ask\.answer\.briefing\.sales\.pos\.provisional/);
  assert.match(reply.answer, /sales=\$310/);
  assert.equal(reply.priorities[0]?.id, "task-pos-combo");
  assert.equal(reply.priorities[1]?.id, "task-watch-combo");
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.sales.pos")));
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.stock.watch")));
});

test("answerAskMise general refuses all-clear when only Watch inventory remains", () => {
  const reply = answerAskMise({
    question: "hello there",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      inventoryHealth: { watch: 2, low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: [
        {
          id: "attn-watch",
          title: "Basil on Watch",
          detail: "Confirm count",
          actionLabel: "Open",
          route: "/inventory",
          severity: "info"
        }
      ],
      operationalTasks: [],
      salesToday: 0,
      itemsSold: 0
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "general");
  assert.match(reply.answer, /ask\.answer\.stock\.watch\.other/);
  assert.match(reply.answer, /ask\.answer\.stock\.watch\.named/);
  assert.match(reply.answer, /Basil on Watch/);
  assert.match(reply.answer, /ask\.answer\.stock\.watch\.next/);
  assert.match(reply.answer, /ask\.answer\.general\.steer/);
  assert.doesNotMatch(reply.answer, /ask\.answer\.fallback/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.stock.watch")));
  assert.equal(reply.showPriorities, false);
});

test("answerAskMise general prefers POS then Watch tasks and grounds sales thinking", () => {
  const watchTask = task({
    id: "task-watch-general",
    source: { kind: "inventory", id: "item-watch", status: "Watch" },
    title: "Confirm basil count",
    action: {
      intent: "update_inventory_count",
      label: "Confirm count",
      route: "/inventory",
      entityId: "item-watch"
    }
  });
  const posTask = task({
    id: "task-pos-general",
    source: { kind: "integration", id: "pos", status: "missing" },
    title: "Connect Square POS",
    action: {
      intent: "connect_pos",
      label: "Connect POS",
      route: "/settings/pos",
      entityId: null
    }
  });
  const otherTask = task({
    id: "task-other-general",
    source: { kind: "order", id: "order-1", status: "draft" },
    title: "Review draft order",
    action: {
      intent: "review_recommendation",
      label: "Review",
      route: "/orders",
      entityId: "order-1"
    }
  });

  const reply = answerAskMise({
    question: "hey mise",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      inventoryHealth: { watch: 1, low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: [],
      operationalTasks: [otherTask, watchTask, posTask],
      salesToday: 180,
      itemsSold: 12
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "general");
  assert.match(reply.answer, /ask\.answer\.general\.tasks/);
  assert.match(reply.answer, /Connect Square POS/);
  assert.match(reply.answer, /ask\.answer\.general\.steer/);
  assert.equal(reply.priorities[0]?.id, "task-pos-general");
  assert.equal(reply.priorities[1]?.id, "task-watch-general");
  assert.equal(reply.priorities[2]?.id, "task-other-general");
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.sales.pos")));
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.stock.watch")));
});

test("answerAskMise general keeps fallback only when stock Watch and POS are clear", () => {
  const reply = answerAskMise({
    question: "hello",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      inventoryHealth: { watch: 0, low: 0, critical: 0 },
      pendingRecommendations: 0,
      attentionCards: [],
      operationalTasks: [],
      salesToday: 500,
      itemsSold: 40
    }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "general");
  assert.equal(reply.answer, "ask.answer.fallback");
  assert.equal(reply.showPriorities, false);
  assert.ok(!reply.thinkingSteps.some((step) => step.includes("ask.thinking.sales.pos")));
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.stock.clear")));
});
