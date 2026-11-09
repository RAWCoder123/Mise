import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportDayMiseStatus,
  canonicalizeDailyReportDayMiseStatus,
  normalizeDailyReportDayMiseStatus
} from "../services/domain/presentationDailyReportDayMiseStatusIdentity";
import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import type { TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportDayMiseStatusIdentity.ts",
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
const askMiseSource = readFileSync(
  new URL("../services/ai/askMise.ts", import.meta.url),
  "utf8"
);
const askMiseBriefingLeadStatusIdentityPath = new URL(
  "../services/domain/presentationAskMiseBriefingLeadStatusIdentity.ts",
  import.meta.url
);
const learningCredibilityLabelIdentityPath = new URL(
  "../services/domain/presentationDailyReportLearningCredibilityLabelIdentity.ts",
  import.meta.url
);
const miseStatusLabelPath = new URL(
  "../services/presentation/miseStatusLabel.ts",
  import.meta.url
);

const miseStatus = "Watch";
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
    miseStatus,
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
      label: "Credibility building",
      evidence: ["Sales history"],
      nextStep: "Keep logging deliveries"
    },
    ...overrides
  };
}

test("MISE-005ABD pins Daily Report Badge day.miseStatus to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABD/);
  assert.match(dailyReportSource, /MISE-005ABD/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportDayMiseStatus\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportDayMiseStatusIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportDayMiseStatus\(/);
  assert.match(
    dailyReportSource,
    /miseStatus \|\|\s*t\("dailyReport\.day\.miseStatus\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /<Badge\s+label=\{visibleReport\.day\.miseStatus\}\s+tone="warning"\s*\/>/
  );

  assert.match(catalogSource, /"dailyReport\.day\.miseStatus\.none": "Unknown"/);
  assert.match(catalogSource, /"dailyReport\.day\.miseStatus\.none": "Desconocido"/);
  assert.match(catalogSource, /"dailyReport\.day\.miseStatus\.none": "未知"/);

  // Leave sibling Daily Report closeout surfaces as raw pass-through on this tip.
  assert.match(
    dailyReportSource,
    /styles\.closeoutTitle[^>]*>\s*\{visibleReport\.day\.restaurantName\}\s*<\/Text>/
  );
  assert.match(
    dailyReportSource,
    /styles\.summaryCopy[^>]*>\s*\{visibleReport\.day\.operatingSummary\}\s*<\/Text>/
  );
  assert.match(
    dailyReportSource,
    /dailyReport\.closeout\.dateBadge/
  );

  // Inventing path still embeds raw summary.miseStatus into day.miseStatus.
  assert.match(dailyOpsReportSource, /miseStatus:\s*summary\.miseStatus/);

  // Leave Ask Mise briefing.lead status raw on this tip (owned by #1214).
  assert.match(askMiseSource, /status:\s*summary\.miseStatus/);
  assert.doesNotMatch(askMiseSource, /normalizeDailyReportDayMiseStatus\(/);
  assert.doesNotMatch(askMiseSource, /normalizeAskMiseBriefingLeadStatus\(/);

  // Do not pull in sibling Ask Mise / Daily Report / i18n helpers.
  assert.doesNotMatch(dailyReportSource, /normalizeAskMiseBriefingLeadStatus\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportLearningCredibilityLabel\(/);
  assert.doesNotMatch(dailyReportSource, /presentMiseStatusLabel\(/);
  assert.doesNotMatch(identitySource, /presentationAskMiseBriefingLeadStatusIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportLearningCredibilityLabelIdentity/);
  assert.doesNotMatch(identitySource, /miseStatusLabel/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(askMiseBriefingLeadStatusIdentityPath), "absent");
  assert.equal(filePresence(learningCredibilityLabelIdentityPath), "absent");
  assert.equal(filePresence(miseStatusLabelPath), "absent");
});

test("Daily Report day.miseStatus ASCII C preserves safe statuses and rejects Unicode padding", () => {
  assert.equal(asciiTrimDailyReportDayMiseStatus(miseStatus), miseStatus);
  assert.equal(asciiTrimDailyReportDayMiseStatus(`  ${miseStatus}  `), miseStatus);
  assert.equal(canonicalizeDailyReportDayMiseStatus(miseStatus), miseStatus);
  assert.equal(normalizeDailyReportDayMiseStatus(miseStatus), miseStatus);
  assert.equal(normalizeDailyReportDayMiseStatus(`\t${miseStatus}\n`), miseStatus);

  const padded = `${em}${miseStatus}${em}`;
  const nbspStatus = `${nbsp}${miseStatus}${nbsp}`;
  const internalEm = `Wat${em}ch`;
  const internalNbsp = `Wat${nbsp}ch`;

  assert.equal(asciiTrimDailyReportDayMiseStatus(padded), padded);
  assert.notEqual(asciiTrimDailyReportDayMiseStatus(padded), padded.trim());
  assert.equal(canonicalizeDailyReportDayMiseStatus(padded), null);
  assert.equal(normalizeDailyReportDayMiseStatus(padded), null);
  assert.equal(normalizeDailyReportDayMiseStatus(nbspStatus), null);
  assert.equal(normalizeDailyReportDayMiseStatus(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportDayMiseStatus(internalEm), internalEm);
  assert.equal(normalizeDailyReportDayMiseStatus(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportDayMiseStatus(internalEm), internalEm);

  // Ordinary accented / CJK statuses remain stable.
  assert.equal(normalizeDailyReportDayMiseStatus("Atención"), "Atención");
  assert.equal(normalizeDailyReportDayMiseStatus("关注"), "关注");
});

test("soft empty, controls, and non-strings fail closed for Daily Report day.miseStatus", () => {
  assert.equal(normalizeDailyReportDayMiseStatus(undefined), null);
  assert.equal(normalizeDailyReportDayMiseStatus(null), null);
  assert.equal(normalizeDailyReportDayMiseStatus(""), null);
  assert.equal(normalizeDailyReportDayMiseStatus("   "), null);
  assert.equal(normalizeDailyReportDayMiseStatus(123 as unknown as string), null);
  assert.equal(normalizeDailyReportDayMiseStatus(`\u0001${miseStatus}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportDayMiseStatus(`${miseStatus}\t`), miseStatus);
  assert.equal(normalizeDailyReportDayMiseStatus(`${miseStatus}\u0007`), null);
  assert.equal(normalizeDailyReportDayMiseStatus(em), null);
  // LF/TAB/CR are rejected for single-line labels (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyReportDayMiseStatus(`Wat\tch`), null);
  assert.equal(normalizeDailyReportDayMiseStatus(`Wat\nch`), null);
});

test("Daily Report day.miseStatus bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior always-pass path still rendered blank-looking Badge labels.
  assert.equal(normalizeDailyReportDayMiseStatus(""), null);
  assert.equal(normalizeDailyReportDayMiseStatus(em), null);
  assert.equal(normalizeDailyReportDayMiseStatus(nbsp), null);

  // Raw Unicode-only free-text still soft-nulls when present on the day section.
  const blankLooking = buildDailyOpsReport({
    restaurantName: "Harbor Kitchen",
    operatingDate: "2026-11-09",
    restaurantTimeZone: "America/Los_Angeles",
    restaurantCurrency: "USD",
    summary: summary({ miseStatus: em }),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: null,
    now: new Date("2026-11-09T22:00:00.000Z")
  });
  assert.equal(blankLooking.day.miseStatus, em);
  assert.equal(Boolean(blankLooking.day.miseStatus), true);
  assert.equal(normalizeDailyReportDayMiseStatus(blankLooking.day.miseStatus), null);
  // Sibling restaurantName still receives the raw name on this tip.
  assert.equal(blankLooking.day.restaurantName, "Harbor Kitchen");

  // Safe statuses still render after normalize.
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
  assert.equal(safe.day.miseStatus, miseStatus);
  assert.equal(normalizeDailyReportDayMiseStatus(safe.day.miseStatus), miseStatus);

  const missingStatus: string | null | undefined = undefined;
  const unicodeOnlyStatus: string | null | undefined = em;
  // Raw || without normalize cannot soft-null truthy Unicode-only space.
  assert.equal(missingStatus || "Unknown", "Unknown");
  assert.equal(unicodeOnlyStatus || "Unknown", em);
  assert.notEqual(unicodeOnlyStatus || "Unknown", "Unknown");
  assert.equal(Boolean(unicodeOnlyStatus), true);
  // After ASCII C normalize, soft-null restores the localized none fallback.
  assert.equal(
    normalizeDailyReportDayMiseStatus(unicodeOnlyStatus) || "Unknown",
    "Unknown"
  );
  assert.match(
    dailyReportSource,
    /miseStatus \|\|\s*t\("dailyReport\.day\.miseStatus\.none"\)/
  );
});

test("Daily Report day.miseStatus identity refuses Unicode inventing equality", () => {
  const padded = `${em}${miseStatus}${em}`;
  assert.notEqual(asciiTrimDailyReportDayMiseStatus(padded), padded.trim());
  assert.equal(padded.trim(), miseStatus);
  assert.equal(normalizeDailyReportDayMiseStatus(padded), null);
  assert.equal(normalizeDailyReportDayMiseStatus(padded) || "Unknown", "Unknown");
  assert.equal(normalizeDailyReportDayMiseStatus(`\t${miseStatus}\n`), miseStatus);
});
