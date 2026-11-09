import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  answerAskMise,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import {
  asciiTrimAskMisePresentedInsightTitle,
  canonicalizeAskMisePresentedInsightTitle,
  normalizeAskMisePresentedInsightTitle
} from "../services/domain/presentationAskMisePresentedInsightTitleIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import { presentInsight } from "../services/presentation/operationsPresentation";
import type { Insight } from "../types/mise";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMisePresentedInsightTitleIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseAnswerSource = readFileSync(new URL("../services/ai/askMise.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const askMiseScreenSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const insightsInsightTitleIdentityPath = new URL(
  "../services/domain/presentationInsightsInsightTitleIdentity.ts",
  import.meta.url
);
const askMisePrepWasteInsightTitleIdentityPath = new URL(
  "../services/domain/presentationAskMisePrepWasteInsightTitleIdentity.ts",
  import.meta.url
);
const askMiseAnswerAttentionTitleIdentityPath = new URL(
  "../services/domain/presentationAskMiseAnswerAttentionTitleIdentity.ts",
  import.meta.url
);
const askMiseAnswerTaskTitleIdentityPath = new URL(
  "../services/domain/presentationAskMiseAnswerTaskTitleIdentity.ts",
  import.meta.url
);
const greetingRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseGreetingRestaurantNameIdentity.ts",
  import.meta.url
);

const menuItemName = "Chicken Bowl";
const cleanSalesTitle = `${menuItemName} demand is rising`;
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

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
    title: "Review Chicken Bowl reorder",
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
    topItems: [{ item_name: menuItemName }],
    pendingRecommendations: 2,
    importantInsight: null,
    attentionCards: [],
    inventoryHealth: { low: 1, critical: 0 },
    operationalTasks: [task()],
    restaurantCurrency: "USD",
    ...overrides
  };
}

function salesInsight(itemNameValue: string): Insight {
  return {
    id: "insight-sales-1",
    restaurant_id: "rest-1",
    insight_type: "sales",
    title: "Raw sales title",
    description: "Raw sales description",
    why_it_matters: "Raw why",
    recommended_action: "Raw action",
    severity: "info",
    created_at: "2026-11-09T12:00:00.000Z",
    presentation: {
      code: "insight.rule.sales.demand_rising",
      values: {
        itemName: itemNameValue,
        liftPercent: 25
      }
    }
  };
}

function restaurant() {
  return {
    name: "Demo Kitchen",
    cuisine_type: "American",
    service_style: "fast_casual" as const,
    timezone: "America/New_York",
    currency: "USD"
  };
}

test("MISE-005ABB pins Ask Mise answer-text presentedInsight.title to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABB/);
  assert.match(askMiseAnswerSource, /MISE-005ABB/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMisePresentedInsightTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseAnswerSource,
    /from "\.\.\/domain\/presentationAskMisePresentedInsightTitleIdentity"/
  );
  assert.match(askMiseAnswerSource, /normalizeAskMisePresentedInsightTitle\(/);
  assert.match(
    askMiseAnswerSource,
    /normalizeAskMisePresentedInsightTitle\(presentedInsight\.title\)\s*\|\|\s*t\("ask\.answer\.presentedInsightTitle\.none"\)/
  );
  assert.doesNotMatch(
    askMiseAnswerSource,
    /t\("ask\.answer\.sales\.insight", \{ insight: presentedInsight\.title \}\)/
  );
  assert.doesNotMatch(
    askMiseAnswerSource,
    /t\("ask\.answer\.prioritiesInsight", \{ insight: presentedInsight\.title \}\)/
  );

  assert.match(catalogSource, /"ask\.answer\.presentedInsightTitle\.none": "Insight"/);
  assert.match(catalogSource, /"ask\.answer\.presentedInsightTitle\.none": "Señal"/);
  assert.match(catalogSource, /"ask\.answer\.presentedInsightTitle\.none": "信号"/);

  // Leave Ask Mise screen greeting / bubble chrome alone on this tip.
  assert.match(
    askMiseScreenSource,
    /\{message\.title \? <Text style=\{styles\.miseTitle\}>\{message\.title\}<\/Text> : null\}/
  );
  assert.doesNotMatch(askMiseScreenSource, /normalizeAskMisePresentedInsightTitle/);
  assert.doesNotMatch(askMiseScreenSource, /presentationAskMisePresentedInsightTitleIdentity/);

  // Leave Insights InsightListRow presentation.title alone (#1185).
  assert.doesNotMatch(insightsSource, /normalizeAskMisePresentedInsightTitle/);
  assert.doesNotMatch(insightsSource, /presentationAskMisePresentedInsightTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeInsightsInsightTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationInsightsInsightTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /insights\.insight\.title\.none/);

  // Leave Ask Mise prep/waste / attentionTitles / topTaskTitles / greeting alone.
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMisePrepWasteInsightTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMisePrepWasteInsightTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.answer\.prepWasteInsightTitle\.none/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseAnswerAttentionTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseAnswerAttentionTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.answer\.attentionTitle\.none/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseAnswerTaskTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseAnswerTaskTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.answer\.taskTitle\.none/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseGreetingRestaurantName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseGreetingRestaurantNameIdentity/);

  // Prep / waste still use raw presentInsight(...).title joins on this tip
  // (owned by #1212 / MISE-005ABA when that stack lands).
  assert.match(
    askMiseAnswerSource,
    /\.map\(\(insight\) => presentInsight\(helpers\.locale, insight\)\.title\);/
  );

  assert.equal(filePresence(insightsInsightTitleIdentityPath), "absent");
  assert.equal(filePresence(askMisePrepWasteInsightTitleIdentityPath), "absent");
  assert.equal(filePresence(askMiseAnswerAttentionTitleIdentityPath), "absent");
  assert.equal(filePresence(askMiseAnswerTaskTitleIdentityPath), "absent");
  assert.equal(filePresence(greetingRestaurantNameIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsInsightTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMisePrepWasteInsightTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseAnswerAttentionTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseAnswerTaskTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(identitySource, /General Tso/);

  assert.equal(normalizeAskMisePresentedInsightTitle(cleanSalesTitle), cleanSalesTitle);
  assert.equal(normalizeAskMisePresentedInsightTitle(`  ${cleanSalesTitle}  `), cleanSalesTitle);
  assert.equal(asciiTrimAskMisePresentedInsightTitle(`\t${cleanSalesTitle}\n`), cleanSalesTitle);
  assert.equal(canonicalizeAskMisePresentedInsightTitle(`\t${cleanSalesTitle}\n`), cleanSalesTitle);

  // Inventing proof: free-form item-name Unicode trim invents a clean name
  // before it is embedded into the sales title template.
  assert.equal(`${em}${menuItemName}${em}`.trim(), menuItemName);
  assert.equal(Boolean(`${em}${menuItemName}${em}`), true);

  // Composed title with Unicode end padding invents equality with the clean title.
  assert.equal(`${em}${cleanSalesTitle}${em}`.trim(), cleanSalesTitle);
  assert.equal(normalizeAskMisePresentedInsightTitle(`${em}${cleanSalesTitle}${em}`), null);
  assert.equal(
    normalizeAskMisePresentedInsightTitle(`${em}${cleanSalesTitle}${em}`) ||
      "ask.answer.presentedInsightTitle.none",
    "ask.answer.presentedInsightTitle.none"
  );

  // Padded free-form item name still composes a truthy Unicode-padded title that
  // soft-nulls (leading em-space survives ASCII trim; Unicode trim would strip it).
  const paddedSalesTitle = presentInsight("en", salesInsight(`${em}${menuItemName}${em}`)).title;
  assert.equal(paddedSalesTitle, `${em}${menuItemName}${em} demand is rising`);
  assert.equal(Boolean(paddedSalesTitle), true);
  assert.notEqual(paddedSalesTitle.trim(), cleanSalesTitle);
  assert.equal(normalizeAskMisePresentedInsightTitle(paddedSalesTitle), null);

  // Unicode-only-space item name still composes a truthy blank-looking title.
  const blankLookingSalesTitle = presentInsight("en", salesInsight(em)).title;
  assert.equal(blankLookingSalesTitle, `${em} demand is rising`);
  assert.equal(Boolean(blankLookingSalesTitle), true);
  assert.equal(normalizeAskMisePresentedInsightTitle(blankLookingSalesTitle), null);
  assert.equal(normalizeAskMisePresentedInsightTitle(em), null);
  assert.equal(normalizeAskMisePresentedInsightTitle(""), null);
  assert.equal(normalizeAskMisePresentedInsightTitle(null), null);
  assert.equal(normalizeAskMisePresentedInsightTitle(undefined), null);
  assert.equal(normalizeAskMisePresentedInsightTitle(nbsp + cleanSalesTitle + nbsp), null);
  assert.equal(normalizeAskMisePresentedInsightTitle(`\u0001${cleanSalesTitle}`), null);
  assert.equal(normalizeAskMisePresentedInsightTitle(`${cleanSalesTitle}\u007f`), null);
  assert.equal(
    normalizeAskMisePresentedInsightTitle("La demanda de Bowl de pollo está aumentando"),
    "La demanda de Bowl de pollo está aumentando"
  );
  assert.equal(normalizeAskMisePresentedInsightTitle("鸡肉碗 需求正在上升"), "鸡肉碗 需求正在上升");

  // Sales answer soft-nulls padded composed insight titles to localized none.
  // Keep topSale / task titles free of menuItemName so inventing checks target
  // the `{insight}` interpolation only (not unrelated answer slots).
  const inventingSummary = summary({
    topItems: [{ item_name: "Side Salad" }],
    importantInsight: salesInsight(`${em}${menuItemName}${em}`),
    operationalTasks: [task({ title: "Review walk-in count" })]
  });
  const paddedSales = answerAskMise({
    question: "How are sales today?",
    restaurant: restaurant(),
    summary: inventingSummary,
    insights: [salesInsight(`${em}${menuItemName}${em}`)],
    helpers
  });
  assert.equal(paddedSales.intent, "sales");
  assert.match(
    paddedSales.answer,
    /ask\.answer\.sales\.insight:\{insight=ask\.answer\.presentedInsightTitle\.none\}/
  );
  assert.doesNotMatch(paddedSales.answer, new RegExp(menuItemName));

  // Unicode-only-space item name soft-nulls instead of blank-looking insight.
  const blankSales = answerAskMise({
    question: "Sales check?",
    restaurant: restaurant(),
    summary: summary({
      topItems: [{ item_name: "Side Salad" }],
      importantInsight: salesInsight(em),
      operationalTasks: [task({ title: "Review walk-in count" })]
    }),
    insights: [salesInsight(em)],
    helpers
  });
  assert.equal(blankSales.intent, "sales");
  assert.match(
    blankSales.answer,
    /ask\.answer\.sales\.insight:\{insight=ask\.answer\.presentedInsightTitle\.none\}/
  );
  assert.doesNotMatch(blankSales.answer, /insight=\u2003/);

  // Priorities answer uses the same soft-null presentedInsight.title path.
  const paddedPriorities = answerAskMise({
    question: "What are today's priorities?",
    restaurant: restaurant(),
    summary: inventingSummary,
    insights: [salesInsight(`${em}${menuItemName}${em}`)],
    helpers
  });
  assert.equal(paddedPriorities.intent, "priorities");
  assert.match(
    paddedPriorities.answer,
    /ask\.answer\.prioritiesInsight:\{insight=ask\.answer\.presentedInsightTitle\.none\}/
  );
  assert.doesNotMatch(paddedPriorities.answer, new RegExp(menuItemName));

  // Briefing answer uses the same soft-null presentedInsight.title path.
  const paddedBriefing = answerAskMise({
    question: "Give me a briefing",
    restaurant: restaurant(),
    summary: inventingSummary,
    insights: [salesInsight(`${em}${menuItemName}${em}`)],
    helpers
  });
  assert.equal(paddedBriefing.intent, "briefing");
  assert.match(
    paddedBriefing.answer,
    /ask\.answer\.prioritiesInsight:\{insight=ask\.answer\.presentedInsightTitle\.none\}/
  );
  assert.doesNotMatch(paddedBriefing.answer, new RegExp(menuItemName));

  // Ordinary ASCII insight titles still interpolate cleanly on sales /
  // priorities / briefing.
  const cleanSales = answerAskMise({
    question: "How are sales today?",
    restaurant: restaurant(),
    summary: summary({ importantInsight: salesInsight(menuItemName) }),
    insights: [salesInsight(menuItemName)],
    helpers
  });
  assert.equal(cleanSales.intent, "sales");
  assert.match(
    cleanSales.answer,
    new RegExp(`ask\\.answer\\.sales\\.insight:\\{insight=${cleanSalesTitle}\\}`)
  );
  assert.doesNotMatch(cleanSales.answer, /ask\.answer\.presentedInsightTitle\.none/);

  const cleanPriorities = answerAskMise({
    question: "What should I prioritize?",
    restaurant: restaurant(),
    summary: summary({ importantInsight: salesInsight(menuItemName) }),
    insights: [salesInsight(menuItemName)],
    helpers
  });
  assert.equal(cleanPriorities.intent, "priorities");
  assert.match(
    cleanPriorities.answer,
    new RegExp(`ask\\.answer\\.prioritiesInsight:\\{insight=${cleanSalesTitle}\\}`)
  );
  assert.doesNotMatch(cleanPriorities.answer, /ask\.answer\.presentedInsightTitle\.none/);

  const cleanBriefing = answerAskMise({
    question: "Status overview please",
    restaurant: restaurant(),
    summary: summary({ importantInsight: salesInsight(menuItemName) }),
    insights: [salesInsight(menuItemName)],
    helpers
  });
  assert.equal(cleanBriefing.intent, "briefing");
  assert.match(
    cleanBriefing.answer,
    new RegExp(`ask\\.answer\\.prioritiesInsight:\\{insight=${cleanSalesTitle}\\}`)
  );
  assert.doesNotMatch(cleanBriefing.answer, /ask\.answer\.presentedInsightTitle\.none/);

  // Distinct from Ask Mise prep / waste tip (#1212): prep insight-title join
  // left raw on this tip.
  const prepInsight: Insight = {
    id: "insight-prep-1",
    restaurant_id: "rest-1",
    insight_type: "prep",
    title: "Raw prep title",
    description: "Raw prep description",
    why_it_matters: "Raw why",
    recommended_action: "Raw action",
    severity: "warning",
    created_at: "2026-11-09T12:00:00.000Z",
    presentation: {
      code: "insight.rule.prep.low_stock",
      values: {
        menuItemName: `${em}${menuItemName}${em}`,
        inventoryItemName: "Chicken thigh",
        supplierName: "Local Poultry"
      }
    }
  };
  const prepReply = answerAskMise({
    question: "What should I prep?",
    restaurant: restaurant(),
    summary: summary(),
    insights: [prepInsight],
    helpers
  });
  assert.equal(prepReply.intent, "prep");
  assert.match(prepReply.answer, /ask\.answer\.prep\.named:\{items=/);
  assert.match(prepReply.answer, new RegExp(menuItemName));
  assert.doesNotMatch(prepReply.answer, /ask\.answer\.presentedInsightTitle\.none/);
  assert.doesNotMatch(prepReply.answer, /ask\.answer\.prepWasteInsightTitle\.none/);
});
