import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  answerAskMise,
  classifyAskMiseIntent,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import { buildPilotReadiness, type PilotReadiness } from "../services/domain/pilotReadiness";
import type { MessageKey, MessageValues } from "../i18n/catalog";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type {
  InventoryItem,
  MenuItemIngredient,
  PosIntegration,
  PosSale,
  RestaurantEmailConnection,
  SupplierRecipient
} from "../types/mise";
import type { InventoryEvent } from "../services/domain/inventoryLedger";

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

const restaurantId = "restaurant-ask";
const supplierId = "00000000-0000-4000-8000-000000000201";
const now = "2026-08-25T12:00:00.000Z";

function readyPilotReadiness(overrides: Partial<Parameters<typeof buildPilotReadiness>[0]> = {}): PilotReadiness {
  const integration: PosIntegration = {
    id: "pos-1",
    restaurant_id: restaurantId,
    provider: "square",
    status: "connected",
    external_location_id: "location-1",
    last_sync_at: "2026-08-25T11:00:00.000Z",
    sync_cursor: null,
    settings: {},
    created_at: now,
    updated_at: now
  };
  const inventory: InventoryItem = {
    id: "inventory-1",
    restaurant_id: restaurantId,
    item_name: "Chicken",
    category: "Protein",
    unit: "lb",
    current_quantity: 20,
    par_level: 30,
    reorder_threshold: 10,
    estimated_unit_cost: 4,
    supplier_id: supplierId,
    supplier_name: "Fresh Foods",
    last_updated: now,
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.592,
    canonical_unit_verification_status: "verified",
    canonical_unit_verified_at: now,
    canonical_unit_verified_by: "manager-1"
  };
  const count: InventoryEvent = {
    id: "count-1",
    sequence: 1,
    restaurantId,
    inventoryItemId: inventory.id,
    eventType: "count",
    quantity: 20,
    canonicalUnit: "g",
    effectiveAt: "2026-08-25T10:00:00.000Z",
    recordedAt: now,
    actorUserId: "manager-1",
    source: "count_session",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "count-client-1",
    idempotencyKey: "count-key-1",
    supersedesEventId: null,
    metadata: {}
  };
  const mapping: MenuItemIngredient = {
    id: "mapping-1",
    restaurant_id: restaurantId,
    menu_item_name: "Chicken Bowl",
    inventory_item_id: inventory.id,
    quantity_used_per_sale: 200,
    unit: "g"
  };
  const recipient: SupplierRecipient = {
    id: "recipient-1",
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: "Fresh Foods",
    email: "orders@fresh.example",
    created_at: now,
    updated_at: now
  };
  const email: RestaurantEmailConnection = {
    id: "gmail-1",
    restaurant_id: restaurantId,
    provider: "gmail",
    status: "connected",
    sender_email: "purchasing@restaurant.example",
    last_verified_at: now,
    created_at: now,
    updated_at: now
  };
  const sales: PosSale[] = Array.from({ length: 7 }, (_, index) => ({
    id: `sale-${index}`,
    restaurant_id: restaurantId,
    source_record_id: `square-${index}`,
    sale_date: `2026-08-${String(18 + index).padStart(2, "0")}`,
    item_name: "Chicken Bowl",
    category: "Entree",
    quantity_sold: 10,
    gross_sales: 120,
    net_sales: 120,
    source_pos: "Test POS",
    created_at: now
  }));
  return buildPilotReadiness({
    restaurantId,
    generatedAt: now,
    posIntegrations: [integration],
    sales,
    inventoryItems: [inventory],
    countEvents: [count],
    recipeMappings: [mapping],
    supplierRecipients: [recipient],
    emailConnection: email,
    ...overrides
  });
}

test("classifyAskMiseIntent maps operational questions", () => {
  assert.equal(classifyAskMiseIntent("Which stock is low?"), "stock");
  assert.equal(classifyAskMiseIntent("What orders need review?"), "orders");
  assert.equal(classifyAskMiseIntent("How are sales today?"), "sales");
  assert.equal(classifyAskMiseIntent("What are my top priorities today?"), "priorities");
  assert.equal(classifyAskMiseIntent("Give me a quick briefing"), "briefing");
  assert.equal(classifyAskMiseIntent("What should we prep around?"), "prep");
  assert.equal(classifyAskMiseIntent("Anything overstocked or at waste risk?"), "waste");
  assert.equal(classifyAskMiseIntent("Are we ready to recommend and send?"), "readiness");
  assert.equal(classifyAskMiseIntent("How is recipe coverage looking?"), "mapping");
  assert.equal(classifyAskMiseIntent("Are supplier recipients ready?"), "recipients");
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

test("answerAskMise fails closed when pilot readiness is unavailable", () => {
  const reply = answerAskMise({
    question: "Are we ready to recommend and send?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary(),
    insights: [],
    pilotReadiness: null,
    helpers
  });

  assert.equal(reply.intent, "readiness");
  assert.match(reply.answer, /ask\.answer\.readiness\.unavailable/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.readiness.unavailable")));
  assert.doesNotMatch(reply.answer, /ask\.answer\.readiness\.ready/);
});

test("answerAskMise grounds readiness answers in pilot evidence", () => {
  const readiness = readyPilotReadiness();
  const reply = answerAskMise({
    question: "Are we ready to recommend and send?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary(),
    insights: [],
    pilotReadiness: readiness,
    helpers
  });

  assert.equal(reply.intent, "readiness");
  assert.match(reply.answer, /ask\.answer\.readiness\.ready/);
  assert.match(reply.answer, /ask\.answer\.readiness\.canRecommend/);
  assert.match(reply.answer, /ask\.answer\.readiness\.canSend/);
});

test("answerAskMise reports incomplete recipe coverage without inventing mappings", () => {
  const unmapped: PosSale = {
    id: "sale-unmapped",
    restaurant_id: restaurantId,
    source_record_id: "square-unmapped",
    sale_date: "2026-08-24",
    item_name: "Wings",
    category: "Entree",
    quantity_sold: 100,
    gross_sales: 400,
    net_sales: 400,
    source_pos: "Test POS",
    created_at: now
  };
  const readiness = readyPilotReadiness({
    sales: [
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `sale-${index}`,
        restaurant_id: restaurantId,
        source_record_id: `square-${index}`,
        sale_date: `2026-08-${String(18 + index).padStart(2, "0")}`,
        item_name: "Chicken Bowl",
        category: "Entree",
        quantity_sold: 10,
        gross_sales: 120,
        net_sales: 120,
        source_pos: "Test POS",
        created_at: now
      })),
      unmapped
    ]
  });
  const reply = answerAskMise({
    question: "How is recipe coverage looking?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary(),
    insights: [],
    pilotReadiness: readiness,
    helpers
  });

  assert.equal(reply.intent, "mapping");
  assert.match(reply.answer, /ask\.answer\.mapping\.incomplete/);
  assert.match(reply.answer, /Wings/);
  assert.match(reply.answer, /ask\.answer\.mapping\.next/);
});

test("answerAskMise reports missing supplier recipients from readiness metrics", () => {
  const readiness = readyPilotReadiness({
    supplierRecipients: [],
    emailConnection: {
      id: "gmail-1",
      restaurant_id: restaurantId,
      provider: "gmail",
      status: "connected",
      sender_email: "purchasing@restaurant.example",
      last_verified_at: now,
      created_at: now,
      updated_at: now
    }
  });
  const reply = answerAskMise({
    question: "Are supplier recipients ready?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary(),
    insights: [],
    pilotReadiness: readiness,
    helpers
  });

  assert.equal(reply.intent, "recipients");
  assert.match(reply.answer, /ask\.answer\.recipients\.missing/);
  assert.match(reply.answer, /ask\.answer\.recipients\.next/);
});

test("Ask Mise screen loads pilot readiness and fails closed when it is missing", () => {
  const source = readFileSync(join(process.cwd(), "app/ask-mise.tsx"), "utf8");
  assert.match(source, /fetchPilotReadiness/);
  assert.match(source, /pilotReadiness:\s*visibleReadiness/);
  assert.match(source, /Fail closed: missing readiness never invents operating-loop claims/);
  assert.match(source, /ask\.suggestion\.readiness/);
  assert.match(source, /ask\.suggestion\.mapping/);
  assert.match(source, /ask\.suggestion\.recipients/);
});
