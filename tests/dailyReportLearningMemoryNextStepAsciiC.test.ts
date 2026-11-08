import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportLearningMemoryNextStep,
  canonicalizeDailyReportLearningMemoryNextStep,
  normalizeDailyReportLearningMemoryNextStep
} from "../services/domain/presentationDailyReportLearningMemoryNextStepIdentity";
import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import type { TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportLearningMemoryNextStepIdentity.ts",
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

const memoryNextStep = "Review the next Friday.";
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

test("MISE-005ZR pins Daily Report learning.memoryNextStep to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZR/);
  assert.match(dailyReportSource, /MISE-005ZR/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportLearningMemoryNextStep\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportLearningMemoryNextStepIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportLearningMemoryNextStep\(/);
  assert.match(
    dailyReportSource,
    /learningMemoryNextStep \|\|\s*t\("dailyReport\.learning\.memoryNextStep\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.metaLine[^>]*>\s*\{visibleReport\.learning\.memoryNextStep \?\? visibleReport\.learning\.credibilityNextStep\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.learning\.memoryNextStep\.none": "Next step"/);
  assert.match(catalogSource, /"dailyReport\.learning\.memoryNextStep\.none": "Siguiente"/);
  assert.match(catalogSource, /"dailyReport\.learning\.memoryNextStep\.none": "下一步"/);

  // Null raw memoryNextStep still falls through to credibilityNextStep.
  assert.match(
    dailyReportSource,
    /if \(rawMemoryNextStep == null\) \{\s*return visibleReport\.learning\.credibilityNextStep;/
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

  // Inventing path still embeds raw learningMemory.nextStep into memoryNextStep.
  assert.match(
    dailyOpsReportSource,
    /memoryNextStep:\s*learningMemory\?\.nextStep \?\? null/
  );

  // Do not pull in advice / memoryCopy / Insights memory / Home Approvals helpers.
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportAdviceActionDetail\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportAdviceActionTitle\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportLearningMemoryCopy\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeInsightsMemoryOperatorCopy\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeInsightsMemoryNextStep\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeHomeApprovalsCardTitle\(/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportLearningMemoryCopyIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationInsightsMemoryOperatorCopyIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationInsightsMemoryNextStepIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.equal(filePresence(adviceActionDetailIdentityPath), "absent");
  assert.equal(filePresence(adviceActionTitleIdentityPath), "absent");
  assert.equal(filePresence(learningMemoryCopyIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryOperatorCopyIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryNextStepIdentityPath), "absent");
  assert.equal(filePresence(homeApprovalsCardTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportLearningMemoryCopyIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryOperatorCopyIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryNextStepIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyReportLearningMemoryNextStep(memoryNextStep), memoryNextStep);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(` ${memoryNextStep} `), memoryNextStep);
  assert.equal(
    normalizeDailyReportLearningMemoryNextStep(`Case-${memoryNextStep}`),
    `Case-${memoryNextStep}`
  );
  assert.equal(normalizeDailyReportLearningMemoryNextStep("Next step"), "Next step");
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
      nextStep: "Keep reviewing outcomes."
    },
    ...overrides
  };
}

test("learningMemory.nextStep pass-through invents via trim and is soft-nulled on Daily Report", () => {
  const padded = `${em}${memoryNextStep}${em}`;
  const report = buildDailyOpsReport({
    restaurantName: "Harbor Kitchen",
    operatingDate: "2026-11-08",
    restaurantTimeZone: "America/Los_Angeles",
    restaurantCurrency: "USD",
    summary: summary(),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: {
      score: 72,
      label: "Mise memory is building",
      operatorCopy: "Friday dinner demand is usually higher.",
      nextStep: padded,
      signals: []
    },
    now: new Date("2026-11-08T22:00:00.000Z")
  });

  // Inventing proof: Daily Report learning.memoryNextStep still embeds raw nextStep.
  assert.equal(report.learning.memoryNextStep, padded);
  assert.equal(padded.trim(), memoryNextStep);
  assert.equal(report.learning.memoryNextStep!.trim(), memoryNextStep);
  assert.equal(Boolean(report.learning.memoryNextStep), true);
  // Non-nullish Unicode pad wins over credibilityNextStep via ?? .
  assert.notEqual(report.learning.memoryNextStep, null);
  assert.equal(
    report.learning.memoryNextStep ?? report.learning.credibilityNextStep,
    padded
  );

  // ASCII C prep refuses that inventing equality before Daily Report metaLine render.
  assert.equal(
    asciiTrimDailyReportLearningMemoryNextStep(report.learning.memoryNextStep!),
    report.learning.memoryNextStep
  );
  assert.equal(canonicalizeDailyReportLearningMemoryNextStep(report.learning.memoryNextStep!), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(report.learning.memoryNextStep), null);
  assert.equal(
    normalizeDailyReportLearningMemoryNextStep(report.learning.memoryNextStep) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report learning memory next steps", () => {
  const padded = `${em}${memoryNextStep}${em}`;
  const nbspStep = `${nbsp}${memoryNextStep}${nbsp}`;
  const internalEm = `Review${em}Friday`;
  const internalNbsp = `Review${nbsp}Friday`;

  // Inventing proof: Unicode trim would invent the clean learning memory next step.
  assert.equal(padded.trim(), memoryNextStep);
  assert.equal(nbspStep.trim(), memoryNextStep);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspStep), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportLearningMemoryNextStep(padded), padded);
  assert.equal(canonicalizeDailyReportLearningMemoryNextStep(padded), null);
  assert.equal(canonicalizeDailyReportLearningMemoryNextStep(nbspStep), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(padded), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(nbspStep), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportLearningMemoryNextStep(internalEm), internalEm);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report learning memory next steps", () => {
  assert.equal(normalizeDailyReportLearningMemoryNextStep(undefined), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(null), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(""), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep("   "), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(123 as unknown as string), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(`\u0001${memoryNextStep}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportLearningMemoryNextStep(`${memoryNextStep}\t`), memoryNextStep);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(`${memoryNextStep}\u0007`), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(em), null);
  // LF/TAB/CR are rejected for single-line next steps (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyReportLearningMemoryNextStep(`Review\tFriday`), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(`Review\nFriday`), null);
});

test("Daily Report learning memoryNextStep bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior memoryNextStep ?? credibilityNextStep path still rendered blank-looking metaLine bodies.
  assert.equal(normalizeDailyReportLearningMemoryNextStep(""), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(em), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(nbsp), null);

  // Raw Unicode-only free-text still soft-nulls when present on the learning section.
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
        nextStep: "Keep recording counts."
      }
    }),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: {
      score: 40,
      label: "Mise memory is building",
      operatorCopy: "Friday dinner demand is usually higher.",
      nextStep: em,
      signals: []
    },
    now: new Date("2026-11-08T22:00:00.000Z")
  });
  assert.equal(blankLooking.learning.memoryNextStep, em);
  assert.equal(Boolean(blankLooking.learning.memoryNextStep), true);
  // ?? keeps non-nullish Unicode pad instead of falling to credibilityNextStep.
  assert.equal(
    blankLooking.learning.memoryNextStep ?? blankLooking.learning.credibilityNextStep,
    em
  );
  assert.equal(
    normalizeDailyReportLearningMemoryNextStep(blankLooking.learning.memoryNextStep),
    null
  );

  const missingStep: string | null | undefined = undefined;
  const unicodeOnlyStep: string | null | undefined = em;
  assert.equal(missingStep ?? "Keep recording counts.", "Keep recording counts.");
  assert.equal(unicodeOnlyStep ?? "Keep recording counts.", em);
  assert.notEqual(unicodeOnlyStep ?? "Keep recording counts.", "Keep recording counts.");
  assert.equal(Boolean(unicodeOnlyStep), true);
  assert.match(
    dailyReportSource,
    /learningMemoryNextStep \|\|\s*t\("dailyReport\.learning\.memoryNextStep\.none"\)/
  );
});

test("Daily Report learning.memoryNextStep identity refuses Unicode inventing equality", () => {
  const padded = `${em}${memoryNextStep}${em}`;
  assert.notEqual(asciiTrimDailyReportLearningMemoryNextStep(padded), padded.trim());
  assert.equal(normalizeDailyReportLearningMemoryNextStep(padded), null);
  assert.equal(normalizeDailyReportLearningMemoryNextStep(padded) || "Next step", "Next step");
  assert.equal(normalizeDailyReportLearningMemoryNextStep(`\t${memoryNextStep}\n`), memoryNextStep);
});
