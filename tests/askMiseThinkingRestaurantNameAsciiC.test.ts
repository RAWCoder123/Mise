import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  answerAskMise,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import {
  asciiTrimAskMiseThinkingRestaurantName,
  canonicalizeAskMiseThinkingRestaurantName,
  normalizeAskMiseThinkingRestaurantName
} from "../services/domain/presentationAskMiseThinkingRestaurantNameIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMiseThinkingRestaurantNameIdentity.ts", import.meta.url),
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

test("MISE-005AAY pins Ask Mise thinkingSteps restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAY/);
  assert.match(askMiseAnswerSource, /MISE-005AAY/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMiseThinkingRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseAnswerSource,
    /from "\.\.\/domain\/presentationAskMiseThinkingRestaurantNameIdentity"/
  );
  assert.match(askMiseAnswerSource, /normalizeAskMiseThinkingRestaurantName\(/);
  assert.match(
    askMiseAnswerSource,
    /restaurantName: normalizeAskMiseThinkingRestaurantName\(restaurant\.name\)/
  );
  assert.match(
    askMiseAnswerSource,
    /input\.restaurantName\s*\?\s*t\("ask\.thinking\.restaurant"/
  );
  assert.match(askMiseAnswerSource, /t\("ask\.thinking\.restaurant\.none"\)/);
  assert.match(askMiseAnswerSource, /restaurantName: string \| null/);
  // Prior always-pass first thinking step (no soft-null ternary) is gone.
  assert.doesNotMatch(
    askMiseAnswerSource,
    /const steps = \[\s*t\("ask\.thinking\.restaurant", \{\s*restaurant: input\.restaurantName\s*\}\)/
  );

  assert.match(catalogSource, /"ask\.thinking\.restaurant\.none": "Pulling the live board…"/);
  assert.match(catalogSource, /"ask\.thinking\.restaurant\.none": "Revisando el tablero en vivo…"/);
  assert.match(catalogSource, /"ask\.thinking\.restaurant\.none": "正在拉取实时看板…"/);

  // Leave Ask Mise screen greeting.body restaurant.name alone (#1045).
  assert.match(
    askMiseScreenSource,
    /t\("ask\.greeting\.body", \{\s*restaurant: restaurant\.name/
  );
  assert.doesNotMatch(askMiseScreenSource, /normalizeAskMiseThinkingRestaurantName/);
  assert.doesNotMatch(askMiseScreenSource, /presentationAskMiseThinkingRestaurantNameIdentity/);
  assert.doesNotMatch(askMiseScreenSource, /ask\.thinking\.restaurant\.none/);

  // Leave Ask Mise answer-text briefing.lead restaurant.name alone (sibling tip).
  assert.match(
    askMiseAnswerSource,
    /t\("ask\.answer\.briefing\.lead", \{\s*restaurant: restaurant\.name/
  );
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseGreetingRestaurantName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.greeting\.body\.none/);

  // Leave Home / Autonomy subtitle restaurant.name alone.
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );
  assert.match(
    autonomySource,
    /restaurant\s*\?\s*t\("autonomy\.subtitle", \{\s*restaurant: restaurant\.name/
  );
  assert.doesNotMatch(homeSource, /normalizeAskMiseThinkingRestaurantName/);
  assert.doesNotMatch(autonomySource, /normalizeAskMiseThinkingRestaurantName/);

  // Leave Ask Mise attentionTitles / greeting identity modules alone on main.
  assert.equal(filePresence(greetingRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(greetingFirstNameIdentityPath), "absent");
  assert.equal(filePresence(homeGreetingRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(attentionTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationAskMiseGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationGreetingFirstNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseAnswerAttentionTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(identitySource, /General Tso/);

  assert.equal(normalizeAskMiseThinkingRestaurantName(restaurantName), restaurantName);
  assert.equal(normalizeAskMiseThinkingRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimAskMiseThinkingRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeAskMiseThinkingRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(normalizeAskMiseThinkingRestaurantName(`Café ${restaurantName}`), `Café ${restaurantName}`);
  assert.equal(normalizeAskMiseThinkingRestaurantName("月桂小馆"), "月桂小馆");

  // Inventing proof: Unicode trim would invent a clean thinking restaurant name.
  assert.equal(`${em}${restaurantName}${em}`.trim(), restaurantName);
  assert.equal(Boolean(`${em}${restaurantName}${em}`), true);
  assert.equal(asciiTrimAskMiseThinkingRestaurantName(`${em}${restaurantName}${em}`), `${em}${restaurantName}${em}`);
  assert.equal(canonicalizeAskMiseThinkingRestaurantName(`${em}${restaurantName}${em}`), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(`${em}${restaurantName}${em}`), null);
  assert.equal(
    normalizeAskMiseThinkingRestaurantName(`${em}${restaurantName}${em}`) || "ask.thinking.restaurant.none",
    "ask.thinking.restaurant.none"
  );

  // Unicode-only-space is truthy and previously interpolated blank-looking.
  assert.equal(Boolean(em), true);
  assert.equal(em.trim(), "");
  assert.equal(normalizeAskMiseThinkingRestaurantName(em), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(""), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(null), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(undefined), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName("   "), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(nbsp + restaurantName + nbsp), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(`\u0001${restaurantName}`), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(`${restaurantName}\u007f`), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeAskMiseThinkingRestaurantName(`${restaurantName}\t`), restaurantName);

  // Internal Unicode spaces are durable content, not end-padding inventing.
  assert.equal(normalizeAskMiseThinkingRestaurantName(`Luna${em}Bistro`), `Luna${em}Bistro`);
  assert.equal(normalizeAskMiseThinkingRestaurantName(`Luna${nbsp}Bistro`), `Luna${nbsp}Bistro`);

  // Thinking steps soft-null padded restaurant names to localized none.
  const paddedThinking = answerAskMise({
    question: "Which stock is low?",
    restaurant: restaurant({ name: `${em}${restaurantName}${em}` }),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(paddedThinking.intent, "stock");
  assert.equal(paddedThinking.thinkingSteps[0], "ask.thinking.restaurant.none");
  assert.doesNotMatch(paddedThinking.thinkingSteps.join("\n"), new RegExp(restaurantName));
  assert.doesNotMatch(paddedThinking.thinkingSteps.join("\n"), /ask\.thinking\.restaurant:\{/);

  // Unicode-only-space restaurant name soft-nulls instead of blank-looking step.
  const blankThinking = answerAskMise({
    question: "What inventory needs attention?",
    restaurant: restaurant({ name: em }),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(blankThinking.thinkingSteps[0], "ask.thinking.restaurant.none");
  assert.doesNotMatch(blankThinking.thinkingSteps.join("\n"), /\u2003/);

  // Empty restaurant name soft-nulls to localized none.
  const emptyThinking = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: restaurant({ name: "" }),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(emptyThinking.thinkingSteps[0], "ask.thinking.restaurant.none");

  // Ordinary ASCII restaurant name still interpolates cleanly into thinking.
  const cleanThinking = answerAskMise({
    question: "Which stock is low?",
    restaurant: restaurant(),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(cleanThinking.intent, "stock");
  assert.equal(
    cleanThinking.thinkingSteps[0],
    `ask.thinking.restaurant:{restaurant=${restaurantName}}`
  );
  assert.doesNotMatch(cleanThinking.thinkingSteps.join("\n"), /ask\.thinking\.restaurant\.none/);

  // briefing.lead still receives raw restaurant.name on this tip (sibling surface).
  const briefing = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: restaurant({ name: `${em}${restaurantName}${em}` }),
    summary: summary(),
    insights: [],
    helpers
  });
  assert.equal(briefing.intent, "briefing");
  assert.match(
    briefing.answer,
    new RegExp(`ask\\.answer\\.briefing\\.lead:\\{restaurant=${em}${restaurantName}${em}`)
  );
  assert.equal(briefing.thinkingSteps[0], "ask.thinking.restaurant.none");
});
