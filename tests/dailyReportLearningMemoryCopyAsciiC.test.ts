import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportLearningMemoryCopy,
  canonicalizeDailyReportLearningMemoryCopy,
  normalizeDailyReportLearningMemoryCopy
} from "../services/domain/presentationDailyReportLearningMemoryCopyIdentity";
import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import type { TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportLearningMemoryCopyIdentity.ts",
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

const memoryCopy = "Friday dinner demand is usually higher.";
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

test("MISE-005ZQ pins Daily Report learning.memoryCopy to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZQ/);
  assert.match(dailyReportSource, /MISE-005ZQ/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportLearningMemoryCopy\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportLearningMemoryCopyIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportLearningMemoryCopy\(/);
  assert.match(
    dailyReportSource,
    /learningMemoryCopy \|\|\s*t\("dailyReport\.learning\.memoryCopy\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.summaryCopy[^>]*>\s*\{visibleReport\.learning\.memoryCopy\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.learning\.memoryCopy\.none": "Summary"/);
  assert.match(catalogSource, /"dailyReport\.learning\.memoryCopy\.none": "Resumen"/);
  assert.match(catalogSource, /"dailyReport\.learning\.memoryCopy\.none": "摘要"/);

  // Leave memoryNextStep / credibilityNextStep as raw pass-through on this tip.
  assert.match(
    dailyReportSource,
    /visibleReport\.learning\.memoryNextStep \?\? visibleReport\.learning\.credibilityNextStep/
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

  // Inventing path still embeds raw learningMemory.operatorCopy into memoryCopy.
  assert.match(
    dailyOpsReportSource,
    /memoryCopy:\s*learningMemory\?\.operatorCopy \?\? null/
  );

  // Do not pull in advice / Insights memory / Home Approvals helpers on this tip.
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportAdviceActionDetail\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportAdviceActionTitle\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeInsightsMemoryOperatorCopy\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeInsightsMemoryNextStep\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeHomeApprovalsCardTitle\(/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationInsightsMemoryOperatorCopyIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationInsightsMemoryNextStepIdentity/);
  assert.doesNotMatch(dailyReportSource, /presentationHomeApprovalsCardTitleIdentity/);
  assert.equal(filePresence(adviceActionDetailIdentityPath), "absent");
  assert.equal(filePresence(adviceActionTitleIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryOperatorCopyIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryNextStepIdentityPath), "absent");
  assert.equal(filePresence(homeApprovalsCardTitleIdentityPath), "absent");

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(identityCode, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryOperatorCopyIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsMemoryNextStepIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeApprovalsCardTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeDailyReportLearningMemoryCopy(memoryCopy), memoryCopy);
  assert.equal(normalizeDailyReportLearningMemoryCopy(` ${memoryCopy} `), memoryCopy);
  assert.equal(normalizeDailyReportLearningMemoryCopy(`Case-${memoryCopy}`), `Case-${memoryCopy}`);
  assert.equal(normalizeDailyReportLearningMemoryCopy("Summary"), "Summary");
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

test("learningMemory.operatorCopy pass-through invents via trim and is soft-nulled on Daily Report", () => {
  const padded = `${em}${memoryCopy}${em}`;
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
      operatorCopy: padded,
      nextStep: "Review the next Friday.",
      signals: []
    },
    now: new Date("2026-11-08T22:00:00.000Z")
  });

  // Inventing proof: Daily Report learning.memoryCopy still embeds raw operatorCopy.
  assert.equal(report.learning.memoryCopy, padded);
  assert.equal(padded.trim(), memoryCopy);
  assert.equal(report.learning.memoryCopy!.trim(), memoryCopy);
  assert.equal(Boolean(report.learning.memoryCopy), true);

  // ASCII C prep refuses that inventing equality before Daily Report summaryCopy render.
  assert.equal(asciiTrimDailyReportLearningMemoryCopy(report.learning.memoryCopy!), report.learning.memoryCopy);
  assert.equal(canonicalizeDailyReportLearningMemoryCopy(report.learning.memoryCopy!), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(report.learning.memoryCopy), null);
  assert.equal(
    normalizeDailyReportLearningMemoryCopy(report.learning.memoryCopy) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode padding invents via trim and is soft-nulled for Daily Report learning memory copies", () => {
  const padded = `${em}${memoryCopy}${em}`;
  const nbspCopy = `${nbsp}${memoryCopy}${nbsp}`;
  const internalEm = `Friday${em}dinner`;
  const internalNbsp = `Friday${nbsp}dinner`;

  // Inventing proof: Unicode trim would invent the clean learning memory copy.
  assert.equal(padded.trim(), memoryCopy);
  assert.equal(nbspCopy.trim(), memoryCopy);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspCopy), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimDailyReportLearningMemoryCopy(padded), padded);
  assert.equal(canonicalizeDailyReportLearningMemoryCopy(padded), null);
  assert.equal(canonicalizeDailyReportLearningMemoryCopy(nbspCopy), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(padded), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(nbspCopy), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportLearningMemoryCopy(internalEm), internalEm);
  assert.equal(normalizeDailyReportLearningMemoryCopy(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportLearningMemoryCopy(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report learning memory copies", () => {
  assert.equal(normalizeDailyReportLearningMemoryCopy(undefined), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(null), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(""), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy("   "), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(123 as unknown as string), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(`\u0001${memoryCopy}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportLearningMemoryCopy(`${memoryCopy}\t`), memoryCopy);
  assert.equal(normalizeDailyReportLearningMemoryCopy(`${memoryCopy}\u0007`), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(em), null);
  // LF/TAB/CR are rejected for single-line memory copies (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyReportLearningMemoryCopy(`Friday\tdinner`), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(`Friday\ndinner`), null);
});

test("Daily Report learning memoryCopy bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior truthy-gated always-pass-memoryCopy path still rendered blank-looking summaryCopy bodies.
  assert.equal(normalizeDailyReportLearningMemoryCopy(""), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(em), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(nbsp), null);

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
      operatorCopy: em,
      nextStep: "Keep recording counts.",
      signals: []
    },
    now: new Date("2026-11-08T22:00:00.000Z")
  });
  assert.equal(blankLooking.learning.memoryCopy, em);
  assert.equal(Boolean(blankLooking.learning.memoryCopy), true);
  assert.equal(normalizeDailyReportLearningMemoryCopy(blankLooking.learning.memoryCopy), null);

  const missingCopy: string | null | undefined = undefined;
  const unicodeOnlyCopy: string | null | undefined = em;
  assert.equal(missingCopy ?? "", "");
  assert.equal(unicodeOnlyCopy ?? "", em);
  assert.notEqual(unicodeOnlyCopy ?? "", "");
  assert.equal(Boolean(unicodeOnlyCopy), true);
  assert.match(
    dailyReportSource,
    /learningMemoryCopy \|\|\s*t\("dailyReport\.learning\.memoryCopy\.none"\)/
  );
});

test("Daily Report learning.memoryCopy identity refuses Unicode inventing equality", () => {
  const padded = `${em}${memoryCopy}${em}`;
  assert.notEqual(asciiTrimDailyReportLearningMemoryCopy(padded), padded.trim());
  assert.equal(normalizeDailyReportLearningMemoryCopy(padded), null);
  assert.equal(normalizeDailyReportLearningMemoryCopy(padded) || "Summary", "Summary");
  assert.equal(normalizeDailyReportLearningMemoryCopy(`\t${memoryCopy}\n`), memoryCopy);
});
