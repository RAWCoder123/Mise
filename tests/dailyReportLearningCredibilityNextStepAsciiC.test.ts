import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportLearningCredibilityNextStep,
  canonicalizeDailyReportLearningCredibilityNextStep,
  normalizeDailyReportLearningCredibilityNextStep
} from "../services/domain/presentationDailyReportLearningCredibilityNextStepIdentity";
import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import type { TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportLearningCredibilityNextStepIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const dailyReportSource = readFileSync(
  new URL("../app/more/daily-report.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const dailyOpsReportSource = readFileSync(
  new URL("../services/domain/dailyOpsReport.ts", import.meta.url),
  "utf8"
);
const adviceActionDetailIdentityPath = new URL(
  "../services/domain/presentationDailyReportAdviceActionDetailIdentity.ts",
  import.meta.url
);
const adviceActionTitleIdentityPath = new URL(
  "../services/domain/presentationDailyReportAdviceActionTitleIdentity.ts",
  import.meta.url
);
const learningMemoryCopyIdentityPath = new URL(
  "../services/domain/presentationDailyReportLearningMemoryCopyIdentity.ts",
  import.meta.url
);
const learningMemoryNextStepIdentityPath = new URL(
  "../services/domain/presentationDailyReportLearningMemoryNextStepIdentity.ts",
  import.meta.url
);
const insightsMemoryOperatorCopyIdentityPath = new URL(
  "../services/domain/presentationInsightsMemoryOperatorCopyIdentity.ts",
  import.meta.url
);
const insightsMemoryNextStepIdentityPath = new URL(
  "../services/domain/presentationInsightsMemoryNextStepIdentity.ts",
  import.meta.url
);
const homeApprovalsCardTitleIdentityPath = new URL(
  "../services/domain/presentationHomeApprovalsCardTitleIdentity.ts",
  import.meta.url
);

const credibilityNextStep = "Keep reviewing outcomes.";
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

test("MISE-005ZS pins Daily Report learning.credibilityNextStep to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZS/);
  assert.match(dailyReportSource, /MISE-005ZS/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportLearningCredibilityNextStep\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportLearningCredibilityNextStepIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportLearningCredibilityNextStep\(/);
  assert.match(
    dailyReportSource,
    /credibilityNextStep \|\|\s*t\("dailyReport\.learning\.credibilityNextStep\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.metaLine[^>]*>\s*\{visibleReport\.learning\.memoryNextStep \?\? visibleReport\.learning\.credibilityNextStep\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.learning\.credibilityNextStep\.none": "Next step"/);
  assert.match(catalogSource, /"dailyReport\.learning\.credibilityNextStep\.none": "Siguiente"/);
  assert.match(catalogSource, /"dailyReport\.learning\.credibilityNextStep\.none": "下一步"/);

  // Non-null raw memoryNextStep still passes through unchanged (leave #1176 alone).
  assert.match(
    dailyReportSource,
    /if \(rawMemoryNextStep != null\) \{\s*return rawMemoryNextStep;/
  );

  // Leave memoryCopy as raw pass-through on this tip.
  assert.match(
    dailyReportSource,
    /visibleReport\.learning\.memoryCopy \? \(\s*<Text style=\{styles\.summaryCopy\}>\{visibleReport\.learning\.memoryCopy\}<\/Text>/
  );

  // Leave advice title/detail and askBriefingText alone on this tip.
  assert.match(
    dailyReportSource,
    /styles\.adviceTitle[^>]*>\s*\{action\.title\}\s*<\/Text>/
  );
  assert.match(
    dailyReportSource,
    /styles\.summaryCopy[^>]*>\s*\{action\.detail\}\s*<\/Text>/
  );
  assert.match(
    dailyReportSource,
    /styles\.briefingText[^>]*>\s*\{visibleReport\.managerAdvice\.askBriefingText\}\s*<\/Text>/
  );

  // Inventing path still embeds raw summary.credibility.nextStep into credibilityNextStep.
  assert.match(
    dailyOpsReportSource,
    /credibilityNextStep:\s*summary\.credibility\.nextStep/
  );

  // Do not pull in advice / memoryCopy / memoryNextStep / Insights memory / Home Approvals helpers.
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportAdviceActionDetail\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportAdviceActionTitle\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportLearningMemoryCopy\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportLearningMemoryNextStep\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeInsightsMemoryOperatorCopy\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeInsightsMemoryNextStep\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeHomeApprovalsCardTitle\(/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportLearningMemoryCopyIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportLearningMemoryNextStepIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationInsightsMemoryOperatorCopyIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationInsightsMemoryNextStepIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.equal(filePresence(adviceActionDetailIdentityPath), "absent");
  assert.equal(filePresence(adviceActionTitleIdentityPath), "absent");
  assert.equal(filePresence(learningMemoryCopyIdentityPath), "absent");
  assert.equal(filePresence(learningMemoryNextStepIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryOperatorCopyIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryNextStepIdentityPath), "absent");
  assert.equal(filePresence(homeApprovalsCardTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportLearningMemoryCopyIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportLearningMemoryNextStepIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryOperatorCopyIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryNextStepIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(credibilityNextStep),
    credibilityNextStep
  );
  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(` ${credibilityNextStep} `),
    credibilityNextStep
  );
  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(`Case-${credibilityNextStep}`),
    `Case-${credibilityNextStep}`
  );
  assert.equal(normalizeDailyReportLearningCredibilityNextStep("Next step"), "Next step");
});

function summary(overrides: Partial<TodaySummary> = {}): TodaySummary {
  return {
    restaurantName: "Harbor Kitchen",
    operatingSummary: "Steady service.",
    miseStatus: "Watch",
    learningNote: "Learning",
    salesToday: 1200,
    netSalesToday: 1100,
    itemsSold: 80,
    topItems: [],
    lowStockCount: 0,
    inventoryAlerts: 0,
    pendingRecommendations: 0,
    importantInsight: null,
    attentionCards: [],
    salesTrend: [],
    recipeBaseline: {
      menuItemsTracked: 0,
      ingredientMappings: 0,
      inventoryItemsLinked: 0,
      posItemsCovered: 0,
      posItemsMissingRecipes: [],
      coveragePercent: 0,
      credibilityLabel: "Thin",
      operatorCopy: "",
      items: []
    },
    workflow: {
      posMenuItemsCovered: 0,
      recipeLinks: 0,
      projectedDepletedItems: 0,
      pendingOrderItems: 0
    },
    credibility: {
      score: 72,
      label: "Building trust",
      evidence: ["Sales history"],
      nextStep: credibilityNextStep
    },
    ...overrides
  };
}

test("credibility.nextStep pass-through invents via trim and is soft-nulled on Daily Report", () => {
  const padded = `${em}${credibilityNextStep}${em}`;
  const report = buildDailyOpsReport({
    restaurantName: "Harbor Kitchen",
    operatingDate: "2026-11-08",
    restaurantTimeZone: "America/Los_Angeles",
    restaurantCurrency: "USD",
    summary: summary({
      credibility: {
        score: 72,
        label: "Building trust",
        evidence: ["Sales history"],
        nextStep: padded
      }
    }),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: null,
    now: new Date("2026-11-08T22:00:00.000Z")
  });

  // Inventing proof: Daily Report learning.credibilityNextStep still embeds raw nextStep.
  assert.equal(report.learning.credibilityNextStep, padded);
  assert.equal(report.learning.memoryNextStep, null);
  assert.equal(padded.trim(), credibilityNextStep);
  assert.equal(report.learning.credibilityNextStep.trim(), credibilityNextStep);
  assert.equal(Boolean(report.learning.credibilityNextStep), true);
  // Null memoryNextStep falls through to credibilityNextStep via ?? .
  assert.equal(
    report.learning.memoryNextStep ?? report.learning.credibilityNextStep,
    padded
  );

  // ASCII C prep refuses that inventing equality before Daily Report metaLine render.
  assert.equal(
    asciiTrimDailyReportLearningCredibilityNextStep(report.learning.credibilityNextStep),
    report.learning.credibilityNextStep
  );
  assert.equal(
    canonicalizeDailyReportLearningCredibilityNextStep(report.learning.credibilityNextStep),
    null
  );
  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(report.learning.credibilityNextStep),
    null
  );
  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(report.learning.credibilityNextStep) ||
      "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report learning credibility next steps", () => {
  const padded = `${em}${credibilityNextStep}${em}`;
  const nbspStep = `${nbsp}${credibilityNextStep}${nbsp}`;
  const internalEm = `Keep${em}reviewing`;
  const internalNbsp = `Keep${nbsp}reviewing`;

  // Inventing proof: Unicode trim would invent the clean credibility next step.
  assert.equal(padded.trim(), credibilityNextStep);
  assert.equal(nbspStep.trim(), credibilityNextStep);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspStep), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportLearningCredibilityNextStep(padded), padded);
  assert.equal(canonicalizeDailyReportLearningCredibilityNextStep(padded), null);
  assert.equal(canonicalizeDailyReportLearningCredibilityNextStep(nbspStep), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(padded), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(nbspStep), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportLearningCredibilityNextStep(internalEm), internalEm);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report learning credibility next steps", () => {
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(undefined), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(null), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(""), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep("   "), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(123 as unknown as string), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(`\u0001${credibilityNextStep}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(`${credibilityNextStep}\t`),
    credibilityNextStep
  );
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(`${credibilityNextStep}\u0007`), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(em), null);
  // LF/TAB/CR are rejected for single-line next steps (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(`Keep\treviewing`), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(`Keep\nreviewing`), null);
});

test("Daily Report learning credibilityNextStep bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior memoryNextStep ?? credibilityNextStep path still rendered blank-looking metaLine bodies.
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(""), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(em), null);
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(nbsp), null);

  // Raw Unicode-only free-text still soft-nulls when present on the learning section fallthrough.
  const blankLooking = buildDailyOpsReport({
    restaurantName: "Harbor Kitchen",
    operatingDate: "2026-11-08",
    restaurantTimeZone: "America/Los_Angeles",
    restaurantCurrency: "USD",
    summary: summary({
      credibility: {
        score: 40,
        label: "Building trust",
        evidence: ["Sales history"],
        nextStep: em
      }
    }),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: null,
    now: new Date("2026-11-08T22:00:00.000Z")
  });
  assert.equal(blankLooking.learning.memoryNextStep, null);
  assert.equal(blankLooking.learning.credibilityNextStep, em);
  assert.equal(Boolean(blankLooking.learning.credibilityNextStep), true);
  // ?? fallthrough keeps non-nullish Unicode pad credibility next step.
  assert.equal(
    blankLooking.learning.memoryNextStep ?? blankLooking.learning.credibilityNextStep,
    em
  );
  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(blankLooking.learning.credibilityNextStep),
    null
  );

  // Non-null memoryNextStep still wins the ?? path (leave #1176 alone).
  const withMemory = buildDailyOpsReport({
    restaurantName: "Harbor Kitchen",
    operatingDate: "2026-11-08",
    restaurantTimeZone: "America/Los_Angeles",
    restaurantCurrency: "USD",
    summary: summary({
      credibility: {
        score: 40,
        label: "Building trust",
        evidence: ["Sales history"],
        nextStep: em
      }
    }),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: {
      score: 40,
      label: "Mise memory is building",
      operatorCopy: "Friday dinner demand is usually higher.",
      nextStep: "Review the next Friday.",
      signals: []
    },
    now: new Date("2026-11-08T22:00:00.000Z")
  });
  assert.equal(withMemory.learning.memoryNextStep, "Review the next Friday.");
  assert.equal(
    withMemory.learning.memoryNextStep ?? withMemory.learning.credibilityNextStep,
    "Review the next Friday."
  );

  const missingStep: string | null | undefined = undefined;
  const unicodeOnlyStep: string | null | undefined = em;
  assert.equal(missingStep ?? "Keep recording counts.", "Keep recording counts.");
  assert.equal(unicodeOnlyStep ?? "Keep recording counts.", em);
  assert.notEqual(unicodeOnlyStep ?? "Keep recording counts.", "Keep recording counts.");
  assert.equal(Boolean(unicodeOnlyStep), true);
  assert.match(
    dailyReportSource,
    /credibilityNextStep \|\|\s*t\("dailyReport\.learning\.credibilityNextStep\.none"\)/
  );
});

test("Daily Report learning.credibilityNextStep identity refuses Unicode inventing equality", () => {
  const padded = `${em}${credibilityNextStep}${em}`;
  assert.notEqual(asciiTrimDailyReportLearningCredibilityNextStep(padded), padded.trim());
  assert.equal(normalizeDailyReportLearningCredibilityNextStep(padded), null);
  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(padded) || "Next step",
    "Next step"
  );
  assert.equal(
    normalizeDailyReportLearningCredibilityNextStep(`\t${credibilityNextStep}\n`),
    credibilityNextStep
  );
});
