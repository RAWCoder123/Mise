import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  answerAskMise,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import {
  asciiTrimAskMisePrepWasteInsightTitle,
  canonicalizeAskMisePrepWasteInsightTitle,
  normalizeAskMisePrepWasteInsightTitle
} from "../services/domain/presentationAskMisePrepWasteInsightTitleIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import { presentInsight } from "../services/presentation/operationsPresentation";
import type { Insight } from "../types/mise";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMisePrepWasteInsightTitleIdentity.ts", import.meta.url),
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
const wasteItemName = "Roma Tomatoes";
const cleanPrepTitle = `${menuItemName} depends on low stock`;
const cleanWasteTitle = `${wasteItemName} may be overstocked`;
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

function prepInsight(menuItemNameValue: string): Insight {
  return {
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
        menuItemName: menuItemNameValue,
        inventoryItemName: "Chicken thigh",
        supplierName: "Local Poultry"
      }
    }
  };
}

function wasteInsight(itemNameValue: string): Insight {
  return {
    id: "insight-waste-1",
    restaurant_id: "rest-1",
    insight_type: "waste",
    title: "Raw waste title",
    description: "Raw waste description",
    why_it_matters: "Raw why",
    recommended_action: "Raw action",
    severity: "warning",
    created_at: "2026-11-09T12:00:00.000Z",
    presentation: {
      code: "insight.rule.waste.overstock",
      values: {
        itemName: itemNameValue,
        quantity: 44.5,
        unit: "lb"
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

test("MISE-005ABA pins Ask Mise answer-text prep/waste insight titles to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABA/);
  assert.match(askMiseAnswerSource, /MISE-005ABA/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMisePrepWasteInsightTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseAnswerSource,
    /from "\.\.\/domain\/presentationAskMisePrepWasteInsightTitleIdentity"/
  );
  assert.match(askMiseAnswerSource, /normalizeAskMisePrepWasteInsightTitle\(/);
  assert.match(
    askMiseAnswerSource,
    /normalizeAskMisePrepWasteInsightTitle\(presentInsight\(helpers\.locale, insight\)\.title\)\s*\|\|\s*t\("ask\.answer\.prepWasteInsightTitle\.none"\)/
  );
  assert.doesNotMatch(
    askMiseAnswerSource,
    /\.map\(\(insight\) => presentInsight\(helpers\.locale, insight\)\.title\);/
  );

  assert.match(catalogSource, /"ask\.answer\.prepWasteInsightTitle\.none": "Insight"/);
  assert.match(catalogSource, /"ask\.answer\.prepWasteInsightTitle\.none": "Señal"/);
  assert.match(catalogSource, /"ask\.answer\.prepWasteInsightTitle\.none": "信号"/);

  // Leave Ask Mise screen greeting / bubble chrome alone on this tip.
  assert.match(
    askMiseScreenSource,
    /\{message\.title \? <Text style=\{styles\.miseTitle\}>\{message\.title\}<\/Text> : null\}/
  );
  assert.doesNotMatch(askMiseScreenSource, /normalizeAskMisePrepWasteInsightTitle/);
  assert.doesNotMatch(askMiseScreenSource, /presentationAskMisePrepWasteInsightTitleIdentity/);

  // Leave Insights InsightListRow presentation.title alone (#1185).
  assert.doesNotMatch(insightsSource, /normalizeAskMisePrepWasteInsightTitle/);
  assert.doesNotMatch(insightsSource, /presentationAskMisePrepWasteInsightTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeInsightsInsightTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationInsightsInsightTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /insights\.insight\.title\.none/);

  // Leave Ask Mise attentionTitles / topTaskTitles / greeting identity alone.
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseAnswerAttentionTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseAnswerAttentionTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.answer\.attentionTitle\.none/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseAnswerTaskTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseAnswerTaskTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.answer\.taskTitle\.none/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseGreetingRestaurantName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseGreetingRestaurantNameIdentity/);

  // Sales / priorities / briefing still use raw presentedInsight.title on this tip.
  assert.match(
    askMiseAnswerSource,
    /t\("ask\.answer\.sales\.insight", \{ insight: presentedInsight\.title \}\)/
  );
  assert.match(
    askMiseAnswerSource,
    /t\("ask\.answer\.prioritiesInsight", \{ insight: presentedInsight\.title \}\)/
  );

  assert.equal(filePresence(insightsInsightTitleIdentityPath), "absent");
  assert.equal(filePresence(askMiseAnswerAttentionTitleIdentityPath), "absent");
  assert.equal(filePresence(askMiseAnswerTaskTitleIdentityPath), "absent");
  assert.equal(filePresence(greetingRestaurantNameIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsInsightTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseAnswerAttentionTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseAnswerTaskTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(identitySource, /General Tso/);

  assert.equal(normalizeAskMisePrepWasteInsightTitle(cleanPrepTitle), cleanPrepTitle);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(`  ${cleanPrepTitle}  `), cleanPrepTitle);
  assert.equal(asciiTrimAskMisePrepWasteInsightTitle(`\t${cleanPrepTitle}\n`), cleanPrepTitle);
  assert.equal(canonicalizeAskMisePrepWasteInsightTitle(`\t${cleanPrepTitle}\n`), cleanPrepTitle);

  // Inventing proof: free-form menu-name Unicode trim invents a clean name
  // before it is embedded into the prep title template.
  assert.equal(`${em}${menuItemName}${em}`.trim(), menuItemName);
  assert.equal(Boolean(`${em}${menuItemName}${em}`), true);

  // Composed title with Unicode end padding invents equality with the clean title.
  assert.equal(`${em}${cleanPrepTitle}${em}`.trim(), cleanPrepTitle);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(`${em}${cleanPrepTitle}${em}`), null);
  assert.equal(
    normalizeAskMisePrepWasteInsightTitle(`${em}${cleanPrepTitle}${em}`) ||
      "ask.answer.prepWasteInsightTitle.none",
    "ask.answer.prepWasteInsightTitle.none"
  );

  // Padded free-form menu name still composes a truthy Unicode-padded title that
  // soft-nulls (leading em-space survives ASCII trim; Unicode trim would strip it).
  const paddedPrepTitle = presentInsight("en", prepInsight(`${em}${menuItemName}${em}`)).title;
  assert.equal(paddedPrepTitle, `${em}${menuItemName}${em} depends on low stock`);
  assert.equal(Boolean(paddedPrepTitle), true);
  assert.notEqual(paddedPrepTitle.trim(), cleanPrepTitle);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(paddedPrepTitle), null);

  // Unicode-only-space menu name still composes a truthy blank-looking title.
  const blankLookingPrepTitle = presentInsight("en", prepInsight(em)).title;
  assert.equal(blankLookingPrepTitle, `${em} depends on low stock`);
  assert.equal(Boolean(blankLookingPrepTitle), true);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(blankLookingPrepTitle), null);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(em), null);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(""), null);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(null), null);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(undefined), null);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(nbsp + cleanPrepTitle + nbsp), null);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(`\u0001${cleanPrepTitle}`), null);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(`${cleanPrepTitle}\u007f`), null);
  assert.equal(
    normalizeAskMisePrepWasteInsightTitle("Bowl de pollo depende de existencias bajas"),
    "Bowl de pollo depende de existencias bajas"
  );
  assert.equal(normalizeAskMisePrepWasteInsightTitle("鸡肉碗依赖低库存原料"), "鸡肉碗依赖低库存原料");

  // Prep answer soft-nulls padded composed insight titles to localized none.
  const paddedPrep = answerAskMise({
    question: "What should I prep?",
    restaurant: restaurant(),
    summary: summary(),
    insights: [prepInsight(`${em}${menuItemName}${em}`)],
    helpers
  });
  assert.equal(paddedPrep.intent, "prep");
  assert.match(
    paddedPrep.answer,
    /ask\.answer\.prep\.named:\{items=ask\.answer\.prepWasteInsightTitle\.none\}/
  );
  assert.doesNotMatch(paddedPrep.answer, new RegExp(menuItemName));

  // Unicode-only-space menu name soft-nulls instead of blank-looking join.
  const blankPrep = answerAskMise({
    question: "Prep list for tonight?",
    restaurant: restaurant(),
    summary: summary(),
    insights: [prepInsight(em)],
    helpers
  });
  assert.equal(blankPrep.intent, "prep");
  assert.match(
    blankPrep.answer,
    /ask\.answer\.prep\.named:\{items=ask\.answer\.prepWasteInsightTitle\.none\}/
  );
  assert.doesNotMatch(blankPrep.answer, /items=\u2003/);

  // Waste answer uses the same soft-null insight-title path.
  const paddedWasteTitle = presentInsight("en", wasteInsight(`${em}${wasteItemName}${em}`)).title;
  assert.equal(paddedWasteTitle, `${em}${wasteItemName}${em} may be overstocked`);
  assert.equal(Boolean(paddedWasteTitle), true);
  assert.equal(normalizeAskMisePrepWasteInsightTitle(paddedWasteTitle), null);
  assert.equal(`${em}${cleanWasteTitle}${em}`.trim(), cleanWasteTitle);

  const paddedWaste = answerAskMise({
    question: "Where is waste risk?",
    restaurant: restaurant(),
    summary: summary(),
    insights: [wasteInsight(`${em}${wasteItemName}${em}`)],
    helpers
  });
  assert.equal(paddedWaste.intent, "waste");
  assert.match(
    paddedWaste.answer,
    /ask\.answer\.waste\.named:\{items=ask\.answer\.prepWasteInsightTitle\.none\}/
  );
  assert.doesNotMatch(paddedWaste.answer, new RegExp(wasteItemName));

  // Ordinary ASCII insight titles still join cleanly on prep and waste.
  const cleanPrep = answerAskMise({
    question: "What should I prep?",
    restaurant: restaurant(),
    summary: summary(),
    insights: [prepInsight(menuItemName)],
    helpers
  });
  assert.equal(cleanPrep.intent, "prep");
  assert.match(
    cleanPrep.answer,
    new RegExp(`ask\\.answer\\.prep\\.named:\\{items=${cleanPrepTitle}\\}`)
  );
  assert.doesNotMatch(cleanPrep.answer, /ask\.answer\.prepWasteInsightTitle\.none/);

  const cleanWaste = answerAskMise({
    question: "Any waste risk?",
    restaurant: restaurant(),
    summary: summary(),
    insights: [wasteInsight(wasteItemName)],
    helpers
  });
  assert.equal(cleanWaste.intent, "waste");
  assert.match(
    cleanWaste.answer,
    new RegExp(`ask\\.answer\\.waste\\.named:\\{items=${cleanWasteTitle}\\}`)
  );
  assert.doesNotMatch(cleanWaste.answer, /ask\.answer\.prepWasteInsightTitle\.none/);

  // Distinct from Insights list tip (#1185): Ask Mise sales insight path left raw.
  const salesInsight: Insight = {
    id: "insight-sales-1",
    restaurant_id: "rest-1",
    insight_type: "sales",
    title: "Raw sales title",
    description: "Raw sales description",
    recommended_action: "Raw action",
    severity: "info",
    created_at: "2026-11-09T12:00:00.000Z",
    presentation: {
      code: "insight.rule.sales.demand_rising",
      values: { itemName: `${em}${menuItemName}${em}`, liftPercent: 25 }
    }
  };
  const salesReply = answerAskMise({
    question: "How are sales today?",
    restaurant: restaurant(),
    summary: summary({ importantInsight: salesInsight }),
    insights: [salesInsight],
    helpers
  });
  assert.equal(salesReply.intent, "sales");
  assert.match(salesReply.answer, /ask\.answer\.sales\.insight:\{insight=/);
  assert.match(salesReply.answer, new RegExp(menuItemName));
  assert.doesNotMatch(salesReply.answer, /ask\.answer\.prepWasteInsightTitle\.none/);
});
