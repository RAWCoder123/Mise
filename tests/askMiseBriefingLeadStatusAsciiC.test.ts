import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  answerAskMise,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import {
  asciiTrimAskMiseBriefingLeadStatus,
  canonicalizeAskMiseBriefingLeadStatus,
  normalizeAskMiseBriefingLeadStatus
} from "../services/domain/presentationAskMiseBriefingLeadStatusIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMiseBriefingLeadStatusIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseAnswerSource = readFileSync(new URL("../services/ai/askMise.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const askMiseScreenSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const dailyReportSource = readFileSync(new URL("../app/more/daily-report.tsx", import.meta.url), "utf8");
const briefingLeadRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseBriefingLeadRestaurantNameIdentity.ts",
  import.meta.url
);
const thinkingRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseThinkingRestaurantNameIdentity.ts",
  import.meta.url
);
const greetingRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseGreetingRestaurantNameIdentity.ts",
  import.meta.url
);
const greetingFirstNameIdentityPath = new URL(
  "../services/domain/presentationGreetingFirstNameIdentity.ts",
  import.meta.url
);
const attentionTitleIdentityPath = new URL(
  "../services/domain/presentationAskMiseAnswerAttentionTitleIdentity.ts",
  import.meta.url
);
const presentedInsightTitleIdentityPath = new URL(
  "../services/domain/presentationAskMisePresentedInsightTitleIdentity.ts",
  import.meta.url
);

const restaurantName = "Luna Bistro";
const status = "Ready";
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

function restaurant(overrides: { name?: string } = {}) {
  return {
    name: overrides.name ?? restaurantName,
    cuisine_type: "American",
    service_style: "fast_casual" as const,
    timezone: "America/New_York",
    currency: "USD"
  };
}

function summary(overrides: Partial<AskMiseRestaurantContext> = {}): AskMiseRestaurantContext {
  return {
    restaurantName,
    miseStatus: status,
    salesToday: 1240,
    itemsSold: 86,
    topItems: [{ item_name: "Chicken Bowl" }],
    pendingRecommendations: 2,
    importantInsight: null,
    attentionCards: [],
    inventoryHealth: { low: 1, critical: 0 },
    operationalTasks: [task()],
    restaurantCurrency: "USD",
    ...overrides
  };
}

test("MISE-005ABC pins Ask Mise briefing.lead status to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABC/);
  assert.match(askMiseAnswerSource, /MISE-005ABC/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMiseBriefingLeadStatus\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseAnswerSource,
    /from "\.\.\/domain\/presentationAskMiseBriefingLeadStatusIdentity"/
  );
  assert.match(askMiseAnswerSource, /normalizeAskMiseBriefingLeadStatus\(/);
  assert.match(
    askMiseAnswerSource,
    /normalizeAskMiseBriefingLeadStatus\(summary\.miseStatus\)\s*\|\|\s*t\("ask\.answer\.briefing\.status\.none"\)/
  );
  assert.doesNotMatch(
    askMiseAnswerSource,
    /status:\s*summary\.miseStatus/
  );

  assert.match(catalogSource, /"ask\.answer\.briefing\.status\.none": "Unknown"/);
  assert.match(catalogSource, /"ask\.answer\.briefing\.status\.none": "Desconocido"/);
  assert.match(catalogSource, /"ask\.answer\.briefing\.status\.none": "未知"/);

  // Leave Ask Mise screen greeting / bubble chrome alone on this tip.
  assert.match(
    askMiseScreenSource,
    /\{message\.title \? <Text style=\{styles\.miseTitle\}>\{message\.title\}<\/Text> : null\}/
  );
  assert.doesNotMatch(askMiseScreenSource, /normalizeAskMiseBriefingLeadStatus/);
  assert.doesNotMatch(askMiseScreenSource, /presentationAskMiseBriefingLeadStatusIdentity/);

  // Leave Daily Report Badge day.miseStatus alone on this tip.
  assert.match(dailyReportSource, /visibleReport\.day\.miseStatus/);
  assert.doesNotMatch(dailyReportSource, /normalizeAskMiseBriefingLeadStatus/);
  assert.doesNotMatch(dailyReportSource, /presentationAskMiseBriefingLeadStatusIdentity/);
  assert.doesNotMatch(dailyReportSource, /ask\.answer\.briefing\.status\.none/);

  // Leave sibling Ask Mise restaurant-name / greeting / attention tips alone.
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseBriefingLeadRestaurantName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseBriefingLeadRestaurantNameIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.answer\.briefing\.lead\.none/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseThinkingRestaurantName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseThinkingRestaurantNameIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseGreetingRestaurantName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeGreetingFirstName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationGreetingFirstNameIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseAnswerAttentionTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseAnswerAttentionTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMisePresentedInsightTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMisePresentedInsightTitleIdentity/);

  assert.equal(filePresence(briefingLeadRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(thinkingRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(greetingRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(greetingFirstNameIdentityPath), "absent");
  assert.equal(filePresence(attentionTitleIdentityPath), "absent");
  assert.equal(filePresence(presentedInsightTitleIdentityPath), "absent");

  // Helper unit behavior: ASCII C end trim; preserve NBSP; soft-null inventing.
  assert.equal(asciiTrimAskMiseBriefingLeadStatus(`  ${status}  `), status);
  assert.equal(asciiTrimAskMiseBriefingLeadStatus(`${em}${status}${em}`), `${em}${status}${em}`);
  assert.equal(canonicalizeAskMiseBriefingLeadStatus(`${em}${status}${em}`), null);
  assert.equal(canonicalizeAskMiseBriefingLeadStatus(`${nbsp}${status}${nbsp}`), null);
  assert.equal(canonicalizeAskMiseBriefingLeadStatus(status), status);
  assert.equal(normalizeAskMiseBriefingLeadStatus(null), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(undefined), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(""), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(em), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(`${em}${status}${em}`), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(`${nbsp}${status}${nbsp}`), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(`\u0001${status}`), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(`${status}\u007f`), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(123 as unknown as string), null);
  assert.equal(normalizeAskMiseBriefingLeadStatus(`${status}\t`), status);
  assert.equal(normalizeAskMiseBriefingLeadStatus(status), status);

  // Internal Unicode spaces are durable content, not end-padding inventing.
  assert.equal(normalizeAskMiseBriefingLeadStatus(`Ready${em}now`), `Ready${em}now`);
  assert.equal(normalizeAskMiseBriefingLeadStatus(`Ready${nbsp}now`), `Ready${nbsp}now`);

  // Accented / CJK status labels remain stable.
  assert.equal(normalizeAskMiseBriefingLeadStatus("Listo"), "Listo");
  assert.equal(normalizeAskMiseBriefingLeadStatus("就绪"), "就绪");

  // Briefing soft-nulls padded miseStatus to localized none in `{status}`.
  const paddedBriefing = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: restaurant(),
    summary: summary({ miseStatus: `${em}${status}${em}` }),
    insights: [],
    helpers
  });
  assert.equal(paddedBriefing.intent, "briefing");
  assert.match(
    paddedBriefing.answer,
    new RegExp(
      `ask\\.answer\\.briefing\\.lead:\\{restaurant=${restaurantName},status=ask\\.answer\\.briefing\\.status\\.none\\}`
    )
  );
  assert.doesNotMatch(paddedBriefing.answer, new RegExp(`status=${status}[,}]`));
  // Sibling restaurant.name still receives raw value on this tip.
  assert.match(
    paddedBriefing.answer,
    new RegExp(`ask\\.answer\\.briefing\\.lead:\\{restaurant=${restaurantName},`)
  );

  // Unicode-only-space miseStatus soft-nulls instead of blank-looking status.
  const blankBriefing = answerAskMise({
    question: "Give me a status overview",
    restaurant: restaurant(),
    summary: summary({ miseStatus: em }),
    insights: [],
    helpers
  });
  assert.equal(blankBriefing.intent, "briefing");
  assert.match(
    blankBriefing.answer,
    /ask\.answer\.briefing\.lead:\{restaurant=Luna Bistro,status=ask\.answer\.briefing\.status\.none\}/
  );
  assert.doesNotMatch(blankBriefing.answer, /\u2003/);

  // Empty miseStatus soft-nulls to localized none.
  const emptyBriefing = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: restaurant(),
    summary: summary({ miseStatus: "" }),
    insights: [],
    helpers
  });
  assert.equal(emptyBriefing.intent, "briefing");
  assert.match(
    emptyBriefing.answer,
    /ask\.answer\.briefing\.lead:\{restaurant=Luna Bistro,status=ask\.answer\.briefing\.status\.none\}/
  );

  // Ordinary ASCII miseStatus still interpolates cleanly into briefing.lead.
  const cleanBriefing = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: restaurant(),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(cleanBriefing.intent, "briefing");
  assert.match(
    cleanBriefing.answer,
    new RegExp(
      `ask\\.answer\\.briefing\\.lead:\\{restaurant=${restaurantName},status=${status}\\}`
    )
  );
  assert.doesNotMatch(cleanBriefing.answer, /ask\.answer\.briefing\.status\.none/);

  // Control-bearing miseStatus soft-nulls.
  const controlBriefing = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: restaurant(),
    summary: summary({ miseStatus: `${status}\u0007` }),
    insights: [],
    helpers
  });
  assert.equal(controlBriefing.intent, "briefing");
  assert.match(
    controlBriefing.answer,
    /ask\.answer\.briefing\.lead:\{restaurant=Luna Bistro,status=ask\.answer\.briefing\.status\.none\}/
  );

  // Non-briefing intents do not route through briefing.lead status soft-null.
  const stock = answerAskMise({
    question: "Which stock is low?",
    restaurant: restaurant(),
    summary: summary({ miseStatus: `${em}${status}${em}` }),
    insights: [],
    helpers
  });
  assert.equal(stock.intent, "stock");
  assert.doesNotMatch(stock.answer, /ask\.answer\.briefing\.lead/);
  assert.doesNotMatch(stock.answer, /ask\.answer\.briefing\.status\.none/);
});
