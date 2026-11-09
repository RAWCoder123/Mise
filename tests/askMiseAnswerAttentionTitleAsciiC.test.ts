import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  answerAskMise,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import {
  asciiTrimAskMiseAnswerAttentionTitle,
  canonicalizeAskMiseAnswerAttentionTitle,
  normalizeAskMiseAnswerAttentionTitle
} from "../services/domain/presentationAskMiseAnswerAttentionTitleIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { AttentionCard } from "../types/mise";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMiseAnswerAttentionTitleIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseAnswerSource = readFileSync(new URL("../services/ai/askMise.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const askMiseScreenSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const homeApprovalsCardTitleIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsCardTitleIdentity.ts",
  import.meta.url
);
const askMiseAnswerTaskTitleIdentityPath = new URL(
  "../services/domain/presentationAskMiseAnswerTaskTitleIdentity.ts",
  import.meta.url
);
const askMisePriorityTitleIdentityPath = new URL(
  "../services/domain/presentationAskMisePriorityTitleIdentity.ts",
  import.meta.url
);
const greetingFirstNameIdentityPath = new URL(
  "../services/domain/presentationGreetingFirstNameIdentity.ts",
  import.meta.url
);
const greetingRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseGreetingRestaurantNameIdentity.ts",
  import.meta.url
);

const title = "Chicken thigh low";
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

function attentionCard(overrides: Partial<AttentionCard> = {}): AttentionCard {
  return {
    id: "attn-1",
    title,
    detail: "Below reorder",
    actionLabel: "Open",
    route: "/inventory",
    severity: "warning",
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
    attentionCards: [attentionCard()],
    inventoryHealth: { low: 1, critical: 1 },
    operationalTasks: [task()],
    restaurantCurrency: "USD",
    ...overrides
  };
}

test("MISE-005AAX pins Ask Mise answer-text attentionTitles to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAX/);
  assert.match(askMiseAnswerSource, /MISE-005AAX/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMiseAnswerAttentionTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseAnswerSource,
    /from "\.\.\/domain\/presentationAskMiseAnswerAttentionTitleIdentity"/
  );
  assert.match(askMiseAnswerSource, /normalizeAskMiseAnswerAttentionTitle\(/);
  assert.match(
    askMiseAnswerSource,
    /normalizeAskMiseAnswerAttentionTitle\(card\.title\)\s*\|\|\s*t\("ask\.answer\.attentionTitle\.none"\)/
  );
  assert.doesNotMatch(
    askMiseAnswerSource,
    /const attentionTitles = summary\.attentionCards\.slice\(0, 3\)\.map\(\(card\) => card\.title\);/
  );

  assert.match(catalogSource, /"ask\.answer\.attentionTitle\.none": "Attention"/);
  assert.match(catalogSource, /"ask\.answer\.attentionTitle\.none": "Atención"/);
  assert.match(catalogSource, /"ask\.answer\.attentionTitle\.none": "关注"/);

  // Leave Ask Mise screen greeting / bubble chrome alone on this tip.
  assert.match(askMiseScreenSource, /\{message\.title \? <Text style=\{styles\.miseTitle\}>\{message\.title\}<\/Text> : null\}/);
  assert.doesNotMatch(askMiseScreenSource, /normalizeAskMiseAnswerAttentionTitle/);
  assert.doesNotMatch(askMiseScreenSource, /presentationAskMiseAnswerAttentionTitleIdentity/);

  // Leave Home ApprovalsSection card.title alone (#1049).
  assert.doesNotMatch(homeSource, /normalizeAskMiseAnswerAttentionTitle/);
  assert.doesNotMatch(homeSource, /presentationAskMiseAnswerAttentionTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeHomeApprovalsCardTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /home\.approvals\.cardTitle\.none/);

  // Leave Ask Mise answer-text topTaskTitles (#1164) and priority title alone.
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMiseAnswerTaskTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMiseAnswerTaskTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.answer\.taskTitle\.none/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMisePriorityTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMisePriorityTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeGreetingFirstName/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationGreetingFirstNameIdentity/);

  assert.equal(filePresence(homeApprovalsCardTitleIdentityPath), "absent");
  assert.equal(filePresence(askMiseAnswerTaskTitleIdentityPath), "absent");
  assert.equal(filePresence(askMisePriorityTitleIdentityPath), "absent");
  assert.equal(filePresence(greetingFirstNameIdentityPath), "absent");
  assert.equal(filePresence(greetingRestaurantNameIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseAnswerTaskTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMisePriorityTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationGreetingFirstNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(identitySource, /General Tso/);

  assert.equal(normalizeAskMiseAnswerAttentionTitle(title), title);
  assert.equal(normalizeAskMiseAnswerAttentionTitle(`  ${title}  `), title);
  assert.equal(asciiTrimAskMiseAnswerAttentionTitle(`\t${title}\n`), title);
  assert.equal(canonicalizeAskMiseAnswerAttentionTitle(`\t${title}\n`), title);

  // Inventing proof: Unicode trim would invent a clean attention title.
  assert.equal(`${em}${title}${em}`.trim(), title);
  assert.equal(Boolean(`${em}${title}${em}`), true);
  assert.equal(normalizeAskMiseAnswerAttentionTitle(`${em}${title}${em}`), null);
  assert.equal(
    normalizeAskMiseAnswerAttentionTitle(`${em}${title}${em}`) || "ask.answer.attentionTitle.none",
    "ask.answer.attentionTitle.none"
  );

  // Unicode-only-space is truthy and previously interpolated blank-looking.
  assert.equal(Boolean(em), true);
  assert.equal(em.trim(), "");
  assert.equal(normalizeAskMiseAnswerAttentionTitle(em), null);
  assert.equal(normalizeAskMiseAnswerAttentionTitle(""), null);
  assert.equal(normalizeAskMiseAnswerAttentionTitle(null), null);
  assert.equal(normalizeAskMiseAnswerAttentionTitle(undefined), null);
  assert.equal(normalizeAskMiseAnswerAttentionTitle(nbsp + title + nbsp), null);
  assert.equal(normalizeAskMiseAnswerAttentionTitle(`\u0001${title}`), null);
  assert.equal(normalizeAskMiseAnswerAttentionTitle(`${title}\u007f`), null);
  assert.equal(normalizeAskMiseAnswerAttentionTitle("Muslos de pollo bajos"), "Muslos de pollo bajos");
  assert.equal(normalizeAskMiseAnswerAttentionTitle("鸡腿库存偏低"), "鸡腿库存偏低");

  // Stock answer soft-nulls padded attention titles to localized none.
  const paddedStock = answerAskMise({
    question: "Which stock is low?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      attentionCards: [attentionCard({ title: `${em}${title}${em}` })]
    }),
    insights: [],
    helpers
  });
  assert.equal(paddedStock.intent, "stock");
  assert.match(paddedStock.answer, /ask\.answer\.stock\.named:\{items=ask\.answer\.attentionTitle\.none\}/);
  assert.doesNotMatch(paddedStock.answer, new RegExp(title));

  // Unicode-only-space attention title soft-nulls instead of blank-looking join.
  const blankStock = answerAskMise({
    question: "What inventory needs attention?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      attentionCards: [attentionCard({ title: em })]
    }),
    insights: [],
    helpers
  });
  assert.equal(blankStock.intent, "stock");
  assert.match(blankStock.answer, /ask\.answer\.stock\.named:\{items=ask\.answer\.attentionTitle\.none\}/);
  assert.doesNotMatch(blankStock.answer, /items=\u2003/);

  // Orders answer uses the same soft-null attentionTitles path.
  const paddedOrders = answerAskMise({
    question: "What orders need review?",
    restaurant: {
      name: "Demo Kitchen",
      cuisine_type: "American",
      service_style: "fast_casual",
      timezone: "America/New_York",
      currency: "USD"
    },
    summary: summary({
      inventoryHealth: { low: 0, critical: 0 },
      attentionCards: [attentionCard({ title: `${em}${title}${em}`, route: "/orders" })]
    }),
    insights: [],
    helpers
  });
  assert.equal(paddedOrders.intent, "orders");
  assert.match(paddedOrders.answer, /ask\.answer\.orders\.named:\{items=ask\.answer\.attentionTitle\.none\}/);
  assert.doesNotMatch(paddedOrders.answer, new RegExp(title));

  // Ordinary ASCII attention title still joins cleanly.
  const cleanStock = answerAskMise({
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
  assert.equal(cleanStock.intent, "stock");
  assert.match(cleanStock.answer, new RegExp(`ask\\.answer\\.stock\\.named:\\{items=${title}\\}`));
  assert.doesNotMatch(cleanStock.answer, /ask\.answer\.attentionTitle\.none/);
});
