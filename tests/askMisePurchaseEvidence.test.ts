import assert from "node:assert/strict";
import test from "node:test";

import { buildAskMisePurchaseEvidence } from "../services/domain/askMisePurchaseEvidence";
import type { PurchaseLineNetByItem } from "../services/domain/purchaseLines";
import {
  answerAskMise,
  classifyAskMiseIntent,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const helpers: AskMiseHelpers = {
  formatCompactCurrency: (value, currency = "USD") => `${currency}:${value}`,
  formatNumber: (value) => String(value),
  locale: "en",
  t: (key: MessageKey, values: MessageValues = {}) => {
    const suffix = Object.entries(values)
      .map(([name, value]) => `${name}=${value}`)
      .join(",");
    return suffix ? `${key}:{${suffix}}` : key;
  }
};

function net(overrides: Partial<PurchaseLineNetByItem> = {}): PurchaseLineNetByItem {
  return {
    supplierId: "supplier-1",
    normalizedItemKey: "chicken thigh",
    unitOfMeasure: "lb",
    currency: "USD",
    purchaseLineCount: 1,
    creditLineCount: 0,
    netQuantity: 10,
    netExtendedPrice: 40,
    unmatchedCredit: false,
    firstTransactionDate: "2026-11-01",
    lastTransactionDate: "2026-11-08",
    ...overrides
  };
}

function summary(overrides: Partial<AskMiseRestaurantContext> = {}): AskMiseRestaurantContext {
  return {
    restaurantName: "Demo Kitchen",
    miseStatus: "Ready",
    salesToday: 100,
    itemsSold: 10,
    topItems: [],
    pendingRecommendations: 0,
    importantInsight: null,
    attentionCards: [],
    inventoryHealth: { low: 0, critical: 0 },
    operationalTasks: [],
    restaurantCurrency: "USD",
    ...overrides
  };
}

test("buildAskMisePurchaseEvidence nets single-currency spend and ranks top items", () => {
  const evidence = buildAskMisePurchaseEvidence([
    net({ normalizedItemKey: "oil", netExtendedPrice: 12 }),
    net({ normalizedItemKey: "chicken thigh", netExtendedPrice: 90 }),
    net({
      normalizedItemKey: "credit mystery",
      purchaseLineCount: 0,
      creditLineCount: 1,
      netExtendedPrice: -8,
      unmatchedCredit: true
    })
  ]);

  assert.equal(evidence.groupCount, 3);
  assert.equal(evidence.pricedGroupCount, 3);
  assert.equal(evidence.unmatchedCreditCount, 1);
  assert.equal(evidence.multiCurrency, false);
  assert.equal(evidence.currency, "USD");
  assert.equal(evidence.netSpend, 94);
  assert.equal(evidence.topItems[0]?.normalizedItemKey, "chicken thigh");
  assert.equal(evidence.topItems[0]?.netExtendedPrice, 90);
});

test("buildAskMisePurchaseEvidence refuses a combined total across currencies", () => {
  const evidence = buildAskMisePurchaseEvidence([
    net({ currency: "USD", netExtendedPrice: 20 }),
    net({ currency: "CAD", netExtendedPrice: 15, normalizedItemKey: "flour" })
  ]);

  assert.equal(evidence.pricedGroupCount, 2);
  assert.equal(evidence.multiCurrency, true);
  assert.equal(evidence.netSpend, null);
  assert.equal(evidence.currency, null);
});

test("buildAskMisePurchaseEvidence ignores groups without usable money", () => {
  const evidence = buildAskMisePurchaseEvidence([
    net({ netExtendedPrice: null, currency: null, normalizedItemKey: null }),
    net({ netExtendedPrice: Number.NaN, currency: "USD" })
  ]);

  assert.equal(evidence.groupCount, 2);
  assert.equal(evidence.pricedGroupCount, 0);
  assert.equal(evidence.netSpend, null);
  assert.deepEqual(evidence.topItems, []);
});

test("classifyAskMiseIntent routes invoice and purchase-line questions before prep/orders", () => {
  assert.equal(classifyAskMiseIntent("What does invoice spend look like?"), "invoices");
  assert.equal(classifyAskMiseIntent("Show purchase line nets"), "invoices");
  assert.equal(classifyAskMiseIntent("Any unmatched credit memos?"), "invoices");
  assert.equal(classifyAskMiseIntent("¿Cómo se ve el gasto de facturas?"), "invoices");
  assert.equal(classifyAskMiseIntent("发票支出情况如何？"), "invoices");
  assert.equal(classifyAskMiseIntent("What’s on order?"), "orders");
  assert.equal(classifyAskMiseIntent("What should we prep around?"), "prep");
});

test("answerAskMise fails closed when invoice evidence is missing", () => {
  const reply = answerAskMise({
    question: "What does invoice spend look like?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: null,
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({ purchaseEvidence: buildAskMisePurchaseEvidence([]) }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "invoices");
  assert.match(reply.answer, /ask\.answer\.invoices\.empty/);
  assert.ok(reply.thinkingSteps.some((step) => step.includes("ask.thinking.invoices.empty")));
});

test("answerAskMise grounds invoice spend on purchase-line nets only", () => {
  const evidence = buildAskMisePurchaseEvidence([
    net({ normalizedItemKey: "chicken thigh", netExtendedPrice: 90 }),
    net({
      normalizedItemKey: "credit mystery",
      purchaseLineCount: 0,
      creditLineCount: 1,
      netExtendedPrice: -8,
      unmatchedCredit: true
    })
  ]);

  const reply = answerAskMise({
    question: "What does invoice spend look like?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: null,
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({ purchaseEvidence: evidence, salesToday: 9999 }),
    insights: [],
    helpers
  });

  assert.equal(reply.intent, "invoices");
  assert.match(reply.answer, /ask\.answer\.invoices\.lead/);
  assert.match(reply.answer, /spend=USD:82/);
  assert.match(reply.answer, /chicken thigh/);
  assert.match(reply.answer, /ask\.answer\.invoices\.unmatched\.one/);
  assert.doesNotMatch(reply.answer, /9999/);
});
