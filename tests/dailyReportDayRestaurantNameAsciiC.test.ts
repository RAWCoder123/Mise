import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportDayRestaurantName,
  canonicalizeDailyReportDayRestaurantName,
  normalizeDailyReportDayRestaurantName
} from "../services/domain/presentationDailyReportDayRestaurantNameIdentity";
import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import type { TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportDayRestaurantNameIdentity.ts",
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
const dailyReportDayMiseStatusIdentityPath = new URL(
  "../services/domain/presentationDailyReportDayMiseStatusIdentity.ts",
  import.meta.url
);
const askMiseBriefingLeadRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseBriefingLeadRestaurantNameIdentity.ts",
  import.meta.url
);
const askMiseThinkingRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationAskMiseThinkingRestaurantNameIdentity.ts",
  import.meta.url
);
const learningCredibilityLabelIdentityPath = new URL(
  "../services/domain/presentationDailyReportLearningCredibilityLabelIdentity.ts",
  import.meta.url
);

const restaurantName = "Harbor Kitchen";
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
    restaurantName,
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
      label: "Credibility building",
      evidence: ["Sales history"],
      nextStep: "Keep logging deliveries"
    },
    ...overrides
  };
}

test("MISE-005ABG pins Daily Report closeout day.restaurantName to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABG/);
  assert.match(dailyReportSource, /MISE-005ABG/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportDayRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimDailyReportDayRestaurantName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportDayRestaurantNameIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportDayRestaurantName\(/);
  assert.match(
    dailyReportSource,
    /restaurantName \|\|\s*t\("dailyReport\.day\.restaurantName\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.closeoutTitle[^>]*>\s*\{visibleReport\.day\.restaurantName\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.day\.restaurantName\.none": "None"/);
  assert.match(catalogSource, /"dailyReport\.day\.restaurantName\.none": "Ninguno"/);
  assert.match(catalogSource, /"dailyReport\.day\.restaurantName\.none": "无"/);

  // Leave sibling Daily Report closeout surfaces as raw pass-through on this tip.
  assert.match(
    dailyReportSource,
    /styles\.summaryCopy[^>]*>\s*\{visibleReport\.day\.operatingSummary\}\s*<\/Text>/
  );
  assert.match(
    dailyReportSource,
    /<Badge\s+label=\{visibleReport\.day\.miseStatus\}\s+tone="warning"\s*\/>/
  );
  assert.match(dailyReportSource, /dailyReport\.closeout\.dateBadge/);

  // Inventing path still embeds raw restaurantName into day.restaurantName.
  assert.match(dailyOpsReportSource, /restaurantName,/);

  // Leave Ask Mise briefing.lead restaurant.name raw on this tip (owned by #1211).
  assert.doesNotMatch(askMiseSource, /normalizeDailyReportDayRestaurantName\(/);
  assert.doesNotMatch(askMiseSource, /normalizeAskMiseBriefingLeadRestaurantName\(/);

  // Do not pull in sibling Ask Mise / Daily Report helpers.
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportDayMiseStatus\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeAskMiseBriefingLeadRestaurantName\(/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportLearningCredibilityLabel\(/);
  assert.doesNotMatch(identitySource, /presentationDailyReportDayMiseStatusIdentity/);
  assert.doesNotMatch(
    identitySource,
    /presentationAskMiseBriefingLeadRestaurantNameIdentity/
  );
  assert.doesNotMatch(identitySource, /presentationAskMiseThinkingRestaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportLearningCredibilityLabelIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(dailyReportDayMiseStatusIdentityPath), "absent");
  assert.equal(filePresence(askMiseBriefingLeadRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(askMiseThinkingRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(learningCredibilityLabelIdentityPath), "absent");
});

test("Daily Report day.restaurantName ASCII C preserves safe names and rejects Unicode padding", () => {
  assert.equal(asciiTrimDailyReportDayRestaurantName(restaurantName), restaurantName);
  assert.equal(asciiTrimDailyReportDayRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(canonicalizeDailyReportDayRestaurantName(restaurantName), restaurantName);
  assert.equal(normalizeDailyReportDayRestaurantName(restaurantName), restaurantName);
  assert.equal(normalizeDailyReportDayRestaurantName(`\t${restaurantName}\n`), restaurantName);

  const padded = `${em}${restaurantName}${em}`;
  const nbspName = `${nbsp}${restaurantName}${nbsp}`;
  const internalEm = `Harbor${em}Kitchen`;
  const internalNbsp = `Harbor${nbsp}Kitchen`;

  assert.equal(asciiTrimDailyReportDayRestaurantName(padded), padded);
  assert.notEqual(asciiTrimDailyReportDayRestaurantName(padded), padded.trim());
  assert.equal(canonicalizeDailyReportDayRestaurantName(padded), null);
  assert.equal(normalizeDailyReportDayRestaurantName(padded), null);
  assert.equal(normalizeDailyReportDayRestaurantName(nbspName), null);
  assert.equal(normalizeDailyReportDayRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeDailyReportDayRestaurantName(internalEm), internalEm);
  assert.equal(normalizeDailyReportDayRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeDailyReportDayRestaurantName(internalEm), internalEm);

  // Ordinary accented / CJK restaurant names remain stable.
  assert.equal(normalizeDailyReportDayRestaurantName("Café Luna"), "Café Luna");
  assert.equal(normalizeDailyReportDayRestaurantName("海港厨房"), "海港厨房");
});

test("soft empty, controls, and non-strings fail closed for Daily Report day.restaurantName", () => {
  assert.equal(normalizeDailyReportDayRestaurantName(undefined), null);
  assert.equal(normalizeDailyReportDayRestaurantName(null), null);
  assert.equal(normalizeDailyReportDayRestaurantName(""), null);
  assert.equal(normalizeDailyReportDayRestaurantName("   "), null);
  assert.equal(normalizeDailyReportDayRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeDailyReportDayRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeDailyReportDayRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeDailyReportDayRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeDailyReportDayRestaurantName(em), null);
  // LF/TAB/CR are rejected for single-line labels (full cntrl; no multiline allowlist).
  assert.equal(normalizeDailyReportDayRestaurantName(`Harbor\tKitchen`), null);
  assert.equal(normalizeDailyReportDayRestaurantName(`Harbor\nKitchen`), null);
});

test("Daily Report day.restaurantName bypass proof: empty and Unicode-only-space values soft-null to localized none", () => {
  // Prior always-pass path still rendered blank-looking closeout titles.
  assert.equal(normalizeDailyReportDayRestaurantName(""), null);
  assert.equal(normalizeDailyReportDayRestaurantName(em), null);
  assert.equal(normalizeDailyReportDayRestaurantName(nbsp), null);

  // Raw Unicode-only free-text still soft-nulls when present on the day section.
  const blankLooking = buildDailyOpsReport({
    restaurantName: em,
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
  assert.equal(blankLooking.day.restaurantName, em);
  assert.equal(Boolean(blankLooking.day.restaurantName), true);
  assert.equal(normalizeDailyReportDayRestaurantName(blankLooking.day.restaurantName), null);
  // Sibling miseStatus still receives the raw status on this tip.
  assert.equal(blankLooking.day.miseStatus, "Watch");

  // Safe restaurant names still render after normalize.
  const safe = buildDailyOpsReport({
    restaurantName,
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
  assert.equal(safe.day.restaurantName, restaurantName);
  assert.equal(normalizeDailyReportDayRestaurantName(safe.day.restaurantName), restaurantName);

  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  // Raw || without normalize cannot soft-null truthy Unicode-only space.
  assert.equal(missingName || "None", "None");
  assert.equal(unicodeOnlyName || "None", em);
  assert.notEqual(unicodeOnlyName || "None", "None");
  assert.equal(Boolean(unicodeOnlyName), true);
  // After ASCII C normalize, soft-null restores the localized none fallback.
  assert.equal(
    normalizeDailyReportDayRestaurantName(unicodeOnlyName) || "None",
    "None"
  );
  assert.match(
    dailyReportSource,
    /restaurantName \|\|\s*t\("dailyReport\.day\.restaurantName\.none"\)/
  );
});

test("Daily Report day.restaurantName identity refuses Unicode inventing equality", () => {
  const padded = `${em}${restaurantName}${em}`;
  assert.notEqual(asciiTrimDailyReportDayRestaurantName(padded), padded.trim());
  assert.equal(padded.trim(), restaurantName);
  assert.equal(normalizeDailyReportDayRestaurantName(padded), null);
  assert.equal(normalizeDailyReportDayRestaurantName(padded) || "None", "None");
  assert.equal(normalizeDailyReportDayRestaurantName(`\t${restaurantName}\n`), restaurantName);
});
