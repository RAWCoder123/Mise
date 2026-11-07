import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  answerAskMise,
  type AskMiseHelpers,
  type AskMiseRestaurantContext
} from "../services/ai/askMise";
import {
  asciiTrimAskMiseAnswerTaskTitle,
  canonicalizeAskMiseAnswerTaskTitle,
  normalizeAskMiseAnswerTaskTitle
} from "../services/domain/presentationAskMiseAnswerTaskTitleIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import { presentOperationalTodayTask } from "../services/presentation/operationsPresentation";
import type { MessageKey, MessageValues } from "../i18n/catalog";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMiseAnswerTaskTitleIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseAnswerSource = readFileSync(new URL("../services/ai/askMise.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const presentationSource = readFileSync(
  new URL("../services/presentation/operationsPresentation.ts", import.meta.url),
  "utf8"
);
const askMiseScreenSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const timelineSource = readFileSync(
  new URL("../components/operations/OperatingPlanTimeline.tsx", import.meta.url),
  "utf8"
);
const askMisePriorityTitleIdentityPath = new URL(
  "../services/domain/presentationAskMisePriorityTitleIdentity.ts",
  import.meta.url
);
const homeTaskRowTitleIdentityPath = new URL(
  "../services/domain/presentationHomeTaskRowTitleDisplayIdentity.ts",
  import.meta.url
);
const operatingPlanDisplayIdentityPath = new URL(
  "../services/domain/presentationOperatingPlanTaskTitleDisplayIdentity.ts",
  import.meta.url
);
const taskDetailOperationalTitleIdentityPath = new URL(
  "../services/domain/presentationTaskDetailOperationalTitleIdentity.ts",
  import.meta.url
);
const homeActivityRowTitleIdentityPath = new URL(
  "../services/domain/presentationHomeActivityRowTitleIdentity.ts",
  import.meta.url
);

const title = "Count walk-in";
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
    restaurantName: "Demo Kitchen",
    miseStatus: "Ready",
    salesToday: 1240,
    itemsSold: 86,
    topItems: [{ item_name: "Chicken Bowl" }],
    pendingRecommendations: 2,
    importantInsight: null,
    attentionCards: [],
    inventoryHealth: { low: 0, critical: 0 },
    operationalTasks: [task()],
    restaurantCurrency: "USD",
    ...overrides
  };
}

test("MISE-005ZF pins Ask Mise answer-text topTaskTitles to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZF/);
  assert.match(askMiseAnswerSource, /MISE-005ZF/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMiseAnswerTaskTitle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseAnswerSource,
    /from "\.\.\/domain\/presentationAskMiseAnswerTaskTitleIdentity"/
  );
  assert.match(askMiseAnswerSource, /normalizeAskMiseAnswerTaskTitle\(/);
  assert.match(
    askMiseAnswerSource,
    /normalizeAskMiseAnswerTaskTitle\(presentOperationalTodayTask\(helpers\.locale, task\)\.title\)\s*\|\|\s*t\("ask\.answer\.taskTitle\.none"\)/
  );
  assert.doesNotMatch(
    askMiseAnswerSource,
    /const topTaskTitles = priorities\.map\(\(task\) => presentOperationalTodayTask\(helpers\.locale, task\)\.title\);/
  );

  assert.match(catalogSource, /"ask\.answer\.taskTitle\.none": "Task"/);
  assert.match(catalogSource, /"ask\.answer\.taskTitle\.none": "Tarea"/);
  assert.match(catalogSource, /"ask\.answer\.taskTitle\.none": "任务"/);

  // Leave Ask Mise priority-card presentation.title as raw pass-through on this tip.
  assert.match(askMiseScreenSource, /\{presentation\.title\}/);
  assert.doesNotMatch(askMiseScreenSource, /normalizeAskMiseAnswerTaskTitle/);
  assert.doesNotMatch(askMiseScreenSource, /presentationAskMiseAnswerTaskTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeAskMisePriorityTitle/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationAskMisePriorityTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /ask\.priority\.title\.none/);

  // Leave Home HomeTaskRow presentation.title alone (#1162).
  assert.match(homeSource, /title=\{presentation\.title\}/);
  assert.doesNotMatch(homeSource, /normalizeAskMiseAnswerTaskTitle/);
  assert.doesNotMatch(homeSource, /presentationAskMiseAnswerTaskTitleIdentity/);

  // Leave Operating Plan Timeline display presentation.title alone (#1161).
  assert.match(timelineSource, /\{presentation\.title\}/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeOperatingPlanTaskTitleDisplay\(/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationOperatingPlanTaskTitleDisplayIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeTaskDetailOperationalTitle\(/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeHomeActivityRowTitle\(/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationHomeActivityRowTitleIdentity/);
  assert.doesNotMatch(askMiseAnswerSource, /normalizeHomeTaskRowTitleDisplay/);
  assert.doesNotMatch(askMiseAnswerSource, /presentationHomeTaskRowTitleDisplayIdentity/);
  assert.equal(filePresence(askMisePriorityTitleIdentityPath), "absent");
  assert.equal(filePresence(homeTaskRowTitleIdentityPath), "absent");
  assert.equal(filePresence(operatingPlanDisplayIdentityPath), "absent");
  assert.equal(filePresence(taskDetailOperationalTitleIdentityPath), "absent");
  assert.equal(filePresence(homeActivityRowTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationAskMisePriorityTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeTaskRowTitleDisplayIdentity/);
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskTitleDisplayIdentity/);
  assert.doesNotMatch(identityCode, /presentationTaskDetailOperationalTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeActivityRowTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Descriptor-absent inventing path still lives in presentOperationalTodayTask.
  assert.match(
    presentationSource,
    /if \(!descriptor\) \{\s*return \{\s*title: task\.title,/
  );

  assert.equal(normalizeAskMiseAnswerTaskTitle(title), title);
  assert.equal(normalizeAskMiseAnswerTaskTitle(`  ${title}  `), title);
  assert.equal(asciiTrimAskMiseAnswerTaskTitle(`\t${title}\n`), title);
  assert.equal(canonicalizeAskMiseAnswerTaskTitle(`\t${title}\n`), title);

  // Descriptor-absent presentOperationalTodayTask still passes raw task.title.
  const presented = presentOperationalTodayTask("en", {
    title: `${em}${title}${em}`,
    detail: "walk-in evidence",
    presentation: undefined
  });
  assert.equal(presented.title, `${em}${title}${em}`);
  assert.equal(presented.title.trim(), title);
  assert.equal(normalizeAskMiseAnswerTaskTitle(presented.title), null);
  assert.equal(
    normalizeAskMiseAnswerTaskTitle(presented.title) || "ask.answer.taskTitle.none",
    "ask.answer.taskTitle.none"
  );

  const unicodeOnlyPresented = presentOperationalTodayTask("en", {
    title: em,
    detail: "walk-in evidence",
    presentation: undefined
  });
  assert.equal(unicodeOnlyPresented.title, em);
  assert.equal(Boolean(unicodeOnlyPresented.title), true);
  assert.equal(normalizeAskMiseAnswerTaskTitle(unicodeOnlyPresented.title), null);
});

test("Ask Mise answer-text topTaskTitles soft-nulls Unicode padding instead of inventing", () => {
  const padded = `${em}${title}${em}`;
  const nbspTitle = `${nbsp}${title}${nbsp}`;
  const internalEm = `Count${em}walk-in`;
  const internalNbsp = `Count${nbsp}walk-in`;

  assert.equal(padded.trim(), title);
  assert.notEqual(asciiTrimAskMiseAnswerTaskTitle(padded), padded.trim());
  assert.equal(normalizeAskMiseAnswerTaskTitle(padded), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(nbspTitle), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeAskMiseAnswerTaskTitle(internalEm), internalEm);
  assert.equal(normalizeAskMiseAnswerTaskTitle(internalNbsp), internalNbsp);
  assert.equal(normalizeAskMiseAnswerTaskTitle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Ask Mise answer-text task titles", () => {
  assert.equal(normalizeAskMiseAnswerTaskTitle(undefined), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(null), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(""), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle("   "), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(123 as unknown as string), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(`\u0001${title}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeAskMiseAnswerTaskTitle(`${title}\t`), title);
  assert.equal(normalizeAskMiseAnswerTaskTitle(`${title}\u0007`), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(em), null);
  // LF/TAB/CR are rejected for single-line titles (full cntrl; no multiline allowlist).
  assert.equal(normalizeAskMiseAnswerTaskTitle(`Count\twalk-in`), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(`Count\nwalk-in`), null);
});

test("Ask Mise answer-text bypass proof: empty and Unicode-only-space titles soft-null to localized none", () => {
  assert.equal(normalizeAskMiseAnswerTaskTitle(""), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(em), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(nbsp), null);
  const missingTitle: string | null | undefined = undefined;
  const unicodeOnlyTitle: string | null | undefined = em;
  assert.equal(missingTitle ?? "", "");
  assert.equal(unicodeOnlyTitle ?? "", em);
  assert.notEqual(unicodeOnlyTitle ?? "", "");
  assert.equal(Boolean(unicodeOnlyTitle), true);
  assert.match(
    askMiseAnswerSource,
    /normalizeAskMiseAnswerTaskTitle\(presentOperationalTodayTask\(helpers\.locale, task\)\.title\)\s*\|\|\s*t\("ask\.answer\.taskTitle\.none"\)/
  );
});

test("Ask Mise answer-text topTaskTitles identity refuses Unicode inventing equality", () => {
  const padded = `${em}${title}${em}`;
  assert.notEqual(asciiTrimAskMiseAnswerTaskTitle(padded), padded.trim());
  assert.equal(normalizeAskMiseAnswerTaskTitle(padded), null);
  assert.equal(normalizeAskMiseAnswerTaskTitle(padded) || "Task", "Task");
  assert.equal(normalizeAskMiseAnswerTaskTitle(`\t${title}\n`), title);
});

test("Ask Mise briefing and general answers use soft-nulled topTaskTitles", () => {
  const paddedTask = task({
    id: "task-padded",
    title: `${em}${title}${em}`,
    presentation: undefined
  });
  const blankTask = task({
    id: "task-blank",
    title: em,
    presentation: undefined
  });

  const briefing = answerAskMise({
    question: "Give me a quick briefing",
    restaurant: {
      name: "Harbor Bistro",
      cuisine_type: "Seafood",
      service_style: "full_service",
      timezone: "America/Los_Angeles",
      currency: "USD"
    },
    summary: summary({
      restaurantName: "Harbor Bistro",
      operationalTasks: [paddedTask, blankTask]
    }),
    insights: [],
    helpers
  });

  assert.equal(briefing.intent, "briefing");
  // Mock translator returns the message key itself (not localized "Task").
  assert.match(
    briefing.answer,
    /ask\.answer\.briefing\.focus:\{tasks=ask\.answer\.taskTitle\.none; ask\.answer\.taskTitle\.none\}/
  );
  assert.doesNotMatch(briefing.answer, /Count walk-in/);
  assert.doesNotMatch(briefing.answer, new RegExp(em));

  const general = answerAskMise({
    question: "hello there",
    restaurant: {
      name: "Harbor Bistro",
      cuisine_type: "Seafood",
      service_style: "full_service",
      timezone: "America/Los_Angeles",
      currency: "USD"
    },
    summary: summary({
      restaurantName: "Harbor Bistro",
      operationalTasks: [paddedTask, blankTask],
      inventoryHealth: { low: 0, critical: 0 },
      pendingRecommendations: 0
    }),
    insights: [],
    helpers
  });

  assert.equal(general.intent, "general");
  assert.match(
    general.answer,
    /ask\.answer\.general\.tasks:\{count=2,tasks=ask\.answer\.taskTitle\.none; ask\.answer\.taskTitle\.none\}/
  );
  assert.doesNotMatch(general.answer, /Count walk-in/);
});
