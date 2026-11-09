import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  answerAskMise,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import {
  asciiTrimAskMiseBriefingLeadRestaurantName,
  canonicalizeAskMiseBriefingLeadRestaurantName,
  normalizeAskMiseBriefingLeadRestaurantName
} from "../services/domain/presentationAskMiseBriefingLeadRestaurantNameIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMiseBriefingLeadRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseAnswerSource = readFileSync(new URL("../services/ai/askMise.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const askMiseScreenSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const autonomySource = readFileSync(new URL("../app/settings/autonomy.tsx", import.meta.url), "utf8");
const greetingRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseGreetingRestaurantNameIdentity.ts",
  import.meta.url
);
const greetingFirstNameIdentityPath = new URL(
  "../services/domain/presentationGreetingFirstNameIdentity.ts",
  import.meta.url
);
const homeGreetingRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationHomeGreetingRestaurantNameIdentity.ts",
  import.meta.url
);
const thinkingRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseThinkingRestaurantNameIdentity.ts",
  import.meta.url
);
const attentionTitleIdentityPath = new URL(
  "../services/domain/presentationAskMiseAnswerAttentionTitleIdentity.ts",
  import.meta.url
);

const restaurantName = "Luna Bistro";
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

function summary(overrides: Partial<AskMiseRestaurantContext> = {}): AskMiseRestaurantContext {
  return {
    restaurantName,
    miseStatus: "Ready",
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

function restaurant(overrides: { name?: string } = {}) {
  return {
    name: overrides.name ?? restaurantName,
    cuisine_type: "American",
    service_style: "fast_casual" as const,
    timezone: "America/New_York",
    currency: "USD"
  };
}

test("MISE-005AAZ pins Ask Mise briefing.lead restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAZ/);
  assert.match(askMiseAnswerSource, /MISE-005AAZ/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMiseBriefingLeadRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseAnswerSource,
    /from "\.\.\/domain\/presentationAskMiseBriefingLeadRestaurantNameIdentity"/
  );
  assert.match(askMiseAnswerSource, /normalizeAskMiseBriefingLeadRestaurantName\(/);
  assert.match(
    askMiseAnswerSource,
    /const briefingLeadRestaurantName = normalizeAskMiseBriefingLeadRestaurantName\(\s*restaurant\.name\s*\)/
  );
  assert.match(
    askMiseAnswerSource,
    /briefingLeadRestaurantName\s*\?\s*t\("ask\.answer\.briefing\.lead"/
  );
  assert.match(askMiseAnswerSource, /t\("ask\.answer\.briefing\.lead\.none"/);
  // Prior always-pass briefing.lead restaurant.name row is gone.
  assert.doesNotMatch(
    askMiseAnswerSource,
    /t\("ask\.answer\.briefing\.lead", \{\s*restaurant: restaurant\.name/
  );

  assert.match(catalogSource, /"ask\.answer\.briefing\.lead\.none": "I’m treating status as “\{status\}\.”"/);
  assert.match(catalogSource, /"ask\.answer\.briefing\.lead\.none": "El estado de Mise es “\{status\}\.”"/);
  assert.match(catalogSource, /"ask\.answer\.briefing\.lead\.none": "Mise 状态为“\{status\}”。"/);

  // Leave Ask Mise screen greeting.body restaurant.name alone (#1045).
  assert.match(
    askMiseScreenSource,
    /t\("ask\.greeting\.body", \{\s*restaurant: restaurant\.name/
  );
  assert.doesNotMatch(askMiseScreenSource, /normalizeAskMiseBriefingLeadRestaurantName/);
  assert.doesNotMatch(askMiseScreenSource, /presentationAskMiseBriefingLeadRestaurantNameIdentity/);
  assert.doesNotMatch(askMiseScreenSource, /ask\.answer\.briefing\.lead\.none/);

  // Leave Ask Mise thinkingSteps restaurant.name alone (#1210 sibling tip).
  assert.match(
    askMiseAnswerSource,
    /restaurantName: restaurant\.name/
  );
  assert.match(
    askMiseAnswerSource,
    /t\("ask\.thinking\.restaurant", \{\s*restaurant: input\.restaurantName\s*\}\)/
  );
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseThinkingRestaurantName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseThinkingRestaurantNameIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.thinking\.restaurant\.none/);

  // Leave Home / Autonomy subtitle restaurant.name alone.
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );
  assert.match(
    autonomySource,
    /restaurant\s*\?\s*t\("autonomy\.subtitle", \{\s*restaurant: restaurant\.name/
  );
  assert.doesNotMatch(homeSource, /normalizeAskMiseBriefingLeadRestaurantName/);
  assert.doesNotMatch(autonomySource, /normalizeAskMiseBriefingLeadRestaurantName/);

  // Leave sibling identity modules alone on main.
  assert.equal(filePresence(greetingRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(greetingFirstNameIdentityPath), "absent");
  assert.equal(filePresence(homeGreetingRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(thinkingRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(attentionTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationAskMiseGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationGreetingFirstNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseThinkingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseAnswerAttentionTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(identitySource, /General Tso/);

  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(restaurantName), restaurantName);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimAskMiseBriefingLeadRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeAskMiseBriefingLeadRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(`Café ${restaurantName}`), `Café ${restaurantName}`);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName("月桂小馆"), "月桂小馆");

  // Inventing proof: Unicode trim would invent a clean briefing restaurant name.
  assert.equal(`${em}${restaurantName}${em}`.trim(), restaurantName);
  assert.equal(Boolean(`${em}${restaurantName}${em}`), true);
  assert.equal(asciiTrimAskMiseBriefingLeadRestaurantName(`${em}${restaurantName}${em}`), `${em}${restaurantName}${em}`);
  assert.equal(canonicalizeAskMiseBriefingLeadRestaurantName(`${em}${restaurantName}${em}`), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(`${em}${restaurantName}${em}`), null);
  assert.equal(
    normalizeAskMiseBriefingLeadRestaurantName(`${em}${restaurantName}${em}`) ||
      "ask.answer.briefing.lead.none",
    "ask.answer.briefing.lead.none"
  );

  // Unicode-only-space is truthy and previously interpolated blank-looking.
  assert.equal(Boolean(em), true);
  assert.equal(em.trim(), "");
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(em), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(""), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(null), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(undefined), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName("   "), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(nbsp + restaurantName + nbsp), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(`\u0001${restaurantName}`), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(`${restaurantName}\u007f`), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(`${restaurantName}\t`), restaurantName);

  // Internal Unicode spaces are durable content, not end-padding inventing.
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(`Luna${em}Bistro`), `Luna${em}Bistro`);
  assert.equal(normalizeAskMiseBriefingLeadRestaurantName(`Luna${nbsp}Bistro`), `Luna${nbsp}Bistro`);

  // Briefing soft-nulls padded restaurant names to localized none.
  const paddedBriefing = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: restaurant({ name: `${em}${restaurantName}${em}` }),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(paddedBriefing.intent, "briefing");
  assert.match(paddedBriefing.answer, /ask\.answer\.briefing\.lead\.none:\{status=Ready\}/);
  assert.doesNotMatch(paddedBriefing.answer, new RegExp(restaurantName));
  assert.doesNotMatch(paddedBriefing.answer, /ask\.answer\.briefing\.lead:\{/);
  // Sibling thinkingSteps still receives raw restaurant.name on this tip.
  const paddedThinkingStep = paddedBriefing.thinkingSteps[0] ?? "";
  assert.match(
    paddedThinkingStep,
    new RegExp(`ask\\.thinking\\.restaurant:\\{restaurant=${em}${restaurantName}${em}`)
  );

  // Unicode-only-space restaurant name soft-nulls instead of blank-looking lead.
  const blankBriefing = answerAskMise({
    question: "Give me a status overview",
    restaurant: restaurant({ name: em }),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(blankBriefing.intent, "briefing");
  assert.match(blankBriefing.answer, /ask\.answer\.briefing\.lead\.none:\{status=Ready\}/);
  assert.doesNotMatch(blankBriefing.answer, /\u2003/);

  // Empty restaurant name soft-nulls to localized none.
  const emptyBriefing = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: restaurant({ name: "" }),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(emptyBriefing.intent, "briefing");
  assert.match(emptyBriefing.answer, /ask\.answer\.briefing\.lead\.none:\{status=Ready\}/);

  // Ordinary ASCII restaurant name still interpolates cleanly into briefing.lead.
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
      `ask\\.answer\\.briefing\\.lead:\\{restaurant=${restaurantName},status=Ready\\}`
    )
  );
  assert.doesNotMatch(cleanBriefing.answer, /ask\.answer\.briefing\.lead\.none/);

  // Non-briefing intents do not route through briefing.lead soft-null.
  const stock = answerAskMise({
    question: "Which stock is low?",
    restaurant: restaurant({ name: `${em}${restaurantName}${em}` }),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(stock.intent, "stock");
  assert.doesNotMatch(stock.answer, /ask\.answer\.briefing\.lead/);
  assert.doesNotMatch(stock.answer, /ask\.answer\.briefing\.lead\.none/);
});
