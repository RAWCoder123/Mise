import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportLearningCredibilityLabel,
  canonicalizeDailyReportLearningCredibilityLabel,
  normalizeDailyReportLearningCredibilityLabel
} from "../services/domain/presentationDailyReportLearningCredibilityLabelIdentity";
import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import type { TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportLearningCredibilityLabelIdentity.ts",
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
const learningCredibilityNextStepIdentityPath = new URL(
  "../services/domain/presentationDailyReportLearningCredibilityNextStepIdentity.ts",
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

const credibilityLabel = "Credibility building";
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

function summary(overrides: Partial<TodaySummary> = {}): TodaySummary {
  return {
    restaurantName: "Harbor",
    operatingSummary: "Two items need attention before tomorrow.",
    miseStatus: "Watch",
    learningNote: "Learning",
    salesToday: 1200,
    netSalesToday: 1100,
    itemsSold: 80,
    topItems: [],
    lowStockCount: 2,
    inventoryAlerts: 2,
    pendingRecommendations: 1,
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
      projectedDepletedItems: 2,
      pendingOrderItems: 1
    },
    credibility: {
      score: 62,
      label: credibilityLabel,
      evidence: ["Sales history"],
      nextStep: "Keep logging deliveries"
    },
    ...overrides
  };
}

test("MISE-005AAR pins Daily Report learning.credibilityLabel to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAR/);
  assert.match(dailyReportSource, /MISE-005AAR/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportLearningCredibilityLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportLearningCredibilityLabelIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportLearningCredibilityLabel\(/);
  assert.match(
    dailyReportSource,
    /credibilityLabel \|\|\s*t\("dailyReport\.learning\.credibilityLabel\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.blockLabel[^>]*>\s*\{visibleReport\.learning\.credibilityLabel\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.learning\.credibilityLabel\.none": "Credibility"/);
  assert.match(catalogSource, /"dailyReport\.learning\.credibilityLabel\.none": "Credibilidad"/);
  assert.match(catalogSource, /"dailyReport\.learning\.credibilityLabel\.none": "可信度"/);

  // Leave sibling learning / advice surfaces as raw pass-through on this tip.
  assert.match(
    dailyReportSource,
    /visibleReport\.learning\.memoryCopy \? \(\s*<Text style=\{styles\.summaryCopy\}>\{visibleReport\.learning\.memoryCopy\}<\/Text>/
  );
  assert.match(
    dailyReportSource,
    /styles\.metaLine[^>]*>\s*\{visibleReport\.learning\.memoryNextStep \?\? visibleReport\.learning\.credibilityNextStep\}\s*<\/Text>/
  );
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

  // Inventing path still embeds raw summary.credibility.label into credibilityLabel.
  assert.match(
    dailyOpsReportSource,
    /credibilityLabel:\s*summary\.credibility\.label/
  );

  // Do not pull in sibling Daily Report / Insights helpers.
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportAdviceActionDetail\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportAdviceActionTitle\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportLearningMemoryCopy\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportLearningMemoryNextStep\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportLearningCredibilityNextStep\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeInsightsMemoryOperatorCopy\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeInsightsMemoryNextStep\(/);
  assert.doesNotMatch(identitySource, /presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportAdviceActionTitleIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportLearningMemoryCopyIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportLearningMemoryNextStepIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportLearningCredibilityNextStepIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(adviceActionDetailIdentityPath), "absent");
  assert.equal(filePresence(adviceActionTitleIdentityPath), "absent");
  assert.equal(filePresence(learningMemoryCopyIdentityPath), "absent");
  assert.equal(filePresence(learningMemoryNextStepIdentityPath), "absent");
  assert.equal(filePresence(learningCredibilityNextStepIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryOperatorCopyIdentityPath), "absent");
  assert.equal(filePresence(insightsMemoryNextStepIdentityPath), "absent");
});

test("Daily Report learning.credibilityLabel ASCII C preserves safe labels and rejects Unicode padding", () => {
  assert.equal(asciiTrimDailyReportLearningCredibilityLabel(credibilityLabel), credibilityLabel);
  assert.equal(
    asciiTrimDailyReportLearningCredibilityLabel(`  ${credibilityLabel}  `),
    credibilityLabel
  );
  assert.equal(
    canonicalizeDailyReportLearningCredibilityLabel(credibilityLabel),
    credibilityLabel
  );
  assert.equal(normalizeDailyReportLearningCredibilityLabel(credibilityLabel), credibilityLabel);
  assert.equal(
    normalizeDailyReportLearningCredibilityLabel(`\t${credibilityLabel}\n`),
    credibilityLabel
  );

  const padded = `${em}${credibilityLabel}${em}`;
  const nbspLabel = `${nbsp}${credibilityLabel}${nbsp}`;
  const internalEm = `Credibility${em}building`;
  const internalNbsp = `Credibility${nbsp}building`;

  assert.equal(asciiTrimDailyReportLearningCredibilityLabel(padded), padded);
  assert.notEqual(asciiTrimDailyReportLearningCredibilityLabel(padded), padded.trim());
  assert.equal(canonicalizeDailyReportLearningCredibilityLabel(padded), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(padded), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(nbspLabel), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportLearningCredibilityLabel(internalEm), internalEm);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Daily Report learning credibility labels", () => {
  assert.equal(normalizeDailyReportLearningCredibilityLabel(undefined), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(null), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(""), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel("   "), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(123 as unknown as string), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(`\u0001${credibilityLabel}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(
    normalizeDailyReportLearningCredibilityLabel(`${credibilityLabel}\t`),
    credibilityLabel
  );
  assert.equal(normalizeDailyReportLearningCredibilityLabel(`${credibilityLabel}\u0007`), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(em), null);
  // LF/TAB/CR are rejected for single-line labels (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyReportLearningCredibilityLabel(`Credibility\tbuilding`), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(`Credibility\nbuilding`), null);
});

test("Daily Report learning credibilityLabel bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior always-pass path still rendered blank-looking blockLabel bodies.
  assert.equal(normalizeDailyReportLearningCredibilityLabel(""), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(em), null);
  assert.equal(normalizeDailyReportLearningCredibilityLabel(nbsp), null);

  // Raw Unicode-only free-text still soft-nulls when present on the learning section.
  const blankLooking = buildDailyOpsReport({
    restaurantName: "Harbor Kitchen",
    operatingDate: "2026-11-09",
    restaurantTimeZone: "America/Los_Angeles",
    restaurantCurrency: "USD",
    summary: summary({
      credibility: {
        score: 40,
        label: em,
        evidence: ["Sales history"],
        nextStep: "Keep recording counts."
      }
    }),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: null,
    now: new Date("2026-11-09T22:00:00.000Z")
  });
  assert.equal(blankLooking.learning.credibilityLabel, em);
  assert.equal(Boolean(blankLooking.learning.credibilityLabel), true);
  assert.equal(
    normalizeDailyReportLearningCredibilityLabel(blankLooking.learning.credibilityLabel),
    null
  );

  // Safe labels still render after normalize.
  const safe = buildDailyOpsReport({
    restaurantName: "Harbor Kitchen",
    operatingDate: "2026-11-09",
    restaurantTimeZone: "America/Los_Angeles",
    restaurantCurrency: "USD",
    summary: summary(),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: null,
    now: new Date("2026-11-09T22:00:00.000Z")
  });
  assert.equal(safe.learning.credibilityLabel, credibilityLabel);
  assert.equal(
    normalizeDailyReportLearningCredibilityLabel(safe.learning.credibilityLabel),
    credibilityLabel
  );

  const missingLabel: string | null | undefined = undefined;
  const unicodeOnlyLabel: string | null | undefined = em;
  // Raw || without normalize cannot soft-null truthy Unicode-only space.
  assert.equal(missingLabel || "Credibility", "Credibility");
  assert.equal(unicodeOnlyLabel || "Credibility", em);
  assert.notEqual(unicodeOnlyLabel || "Credibility", "Credibility");
  assert.equal(Boolean(unicodeOnlyLabel), true);
  // After ASCII C normalize, soft-null restores the localized none fallback.
  assert.equal(
    normalizeDailyReportLearningCredibilityLabel(unicodeOnlyLabel) || "Credibility",
    "Credibility"
  );
  assert.match(
    dailyReportSource,
    /credibilityLabel \|\|\s*t\("dailyReport\.learning\.credibilityLabel\.none"\)/
  );
});

test("Daily Report learning.credibilityLabel identity refuses Unicode inventing equality", () => {
  const padded = `${em}${credibilityLabel}${em}`;
  assert.notEqual(asciiTrimDailyReportLearningCredibilityLabel(padded), padded.trim());
  assert.equal(normalizeDailyReportLearningCredibilityLabel(padded), null);
  assert.equal(
    normalizeDailyReportLearningCredibilityLabel(padded) || "Credibility",
    "Credibility"
  );
  assert.equal(
    normalizeDailyReportLearningCredibilityLabel(`\t${credibilityLabel}\n`),
    credibilityLabel
  );
});
