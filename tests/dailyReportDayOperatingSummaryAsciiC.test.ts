import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiPrepDailyReportDayOperatingSummary,
  canonicalizeDailyReportDayOperatingSummary,
  normalizeDailyReportDayOperatingSummary
} from "../services/domain/presentationDailyReportDayOperatingSummaryIdentity";
import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import type { TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationDailyReportDayOperatingSummaryIdentity.ts",
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

const dailyReportDayRestaurantNameIdentityPath = new URL(
  "../services/domain/presentationDailyReportDayRestaurantNameIdentity.ts",
  import.meta.url
);
const dailyReportDayMiseStatusIdentityPath = new URL(
  "../services/domain/presentationDailyReportDayMiseStatusIdentity.ts",
  import.meta.url
);
const dailyReportSignalLineIdentityPath = new URL(
  "../services/domain/presentationDailyReportSignalLineIdentity.ts",
  import.meta.url
);
const dailyReportAdviceActionDetailIdentityPath = new URL(
  "../services/domain/presentationDailyReportAdviceActionDetailIdentity.ts",
  import.meta.url
);
const dailyReportLearningMemoryCopyIdentityPath = new URL(
  "../services/domain/presentationDailyReportLearningMemoryCopyIdentity.ts",
  import.meta.url
);
const ordersDetailDeliveryEvidenceNotesIdentityPath = new URL(
  "../services/domain/ordersDetailDeliveryEvidenceNotesIdentity.ts",
  import.meta.url
);

const operatingSummary = "Two items need attention before tomorrow.";
const accentedSummary = "Dos artículos necesitan atención antes de mañana.";
const multilineSummary = "Two items need attention.\nReview before tomorrow.\tKeep the draft open.";
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
    restaurantName: "Harbor Kitchen",
    operatingSummary,
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

test("MISE-005ABH pins Daily Report closeout day.operatingSummary to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005ABH/);
  assert.match(dailyReportSource, /MISE-005ABH/);

  assert.ok(identitySource.includes("C_LEADING_WHITESPACE = /^[ \\t\\n\\v\\f\\r]+/;"));
  assert.ok(identitySource.includes("C_TRAILING_WHITESPACE = /[ \\t\\n\\v\\f\\r]+$/;"));
  assert.ok(identitySource.includes('.replace(/\\u00a0/g, " ")'));
  assert.ok(
    identitySource.includes(
      "UNSAFE_MULTILINE_CONTROL = /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/;"
    )
  );

  const prepBody = identitySource.slice(
    identitySource.indexOf("export function asciiPrepDailyReportDayOperatingSummary("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(prepBody, /\.trim\(\)/);
  assert.doesNotMatch(prepBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\\s/);

  assert.match(
    dailyReportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationDailyReportDayOperatingSummaryIdentity"/
  );
  assert.match(dailyReportSource, /normalizeDailyReportDayOperatingSummary\(/);
  assert.match(
    dailyReportSource,
    /operatingSummary \|\|\s*t\("dailyReport\.day\.operatingSummary\.none"\)/
  );
  assert.doesNotMatch(
    dailyReportSource,
    /styles\.summaryCopy[^>]*>\s*\{visibleReport\.day\.operatingSummary\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"dailyReport\.day\.operatingSummary\.none": "Summary"/);
  assert.match(catalogSource, /"dailyReport\.day\.operatingSummary\.none": "Resumen"/);
  assert.match(catalogSource, /"dailyReport\.day\.operatingSummary\.none": "摘要"/);

  // Leave sibling Daily Report closeout surfaces as raw pass-through on this tip.
  assert.match(
    dailyReportSource,
    /styles\.closeoutTitle[^>]*>\s*\{visibleReport\.day\.restaurantName\}\s*<\/Text>/
  );
  assert.match(
    dailyReportSource,
    /<Badge\s+label=\{visibleReport\.day\.miseStatus\}\s+tone="warning"\s*\/>/
  );
  assert.match(dailyReportSource, /dailyReport\.closeout\.dateBadge/);

  // Inventing path still embeds raw operatingSummary into day.operatingSummary.
  assert.match(dailyOpsReportSource, /operatingSummary: summary\.operatingSummary/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /from ["'].*presentationDailyReportDayRestaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationDailyReportDayMiseStatusIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationDailyReportSignalLineIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationDailyReportAdviceActionDetailIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationDailyReportLearningMemoryCopyIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailDeliveryEvidenceNotesIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportDayRestaurantName\b/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportDayMiseStatus\b/);
  assert.doesNotMatch(dailyReportSource, /normalizeDailyReportSignalLine\b/);
  assert.doesNotMatch(dailyReportSource, /normalizeOrdersDetailDeliveryEvidenceNotes\b/);
  assert.equal(filePresence(dailyReportDayRestaurantNameIdentityPath), "absent");
  assert.equal(filePresence(dailyReportDayMiseStatusIdentityPath), "absent");
  assert.equal(filePresence(dailyReportSignalLineIdentityPath), "absent");
  assert.equal(filePresence(dailyReportAdviceActionDetailIdentityPath), "absent");
  assert.equal(filePresence(dailyReportLearningMemoryCopyIdentityPath), "absent");
  assert.equal(filePresence(ordersDetailDeliveryEvidenceNotesIdentityPath), "absent");
});

test("ASCII C multiline prep keeps ordinary Daily Report operatingSummary stable", () => {
  assert.equal(asciiPrepDailyReportDayOperatingSummary(`  ${operatingSummary}  `), operatingSummary);
  assert.equal(asciiPrepDailyReportDayOperatingSummary(`\t${operatingSummary}\n`), operatingSummary);
  assert.equal(
    canonicalizeDailyReportDayOperatingSummary(`  ${operatingSummary}  `),
    operatingSummary
  );
  assert.equal(normalizeDailyReportDayOperatingSummary(`  ${operatingSummary}  `), operatingSummary);

  assert.equal(asciiPrepDailyReportDayOperatingSummary(accentedSummary), accentedSummary);
  assert.equal(normalizeDailyReportDayOperatingSummary(accentedSummary), accentedSummary);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(asciiPrepDailyReportDayOperatingSummary(multilineSummary), multilineSummary);
  assert.equal(normalizeDailyReportDayOperatingSummary(multilineSummary), multilineSummary);

  // CJK operating summary remains stable.
  const cjk = "明天之前有两件库存需要关注。";
  assert.equal(normalizeDailyReportDayOperatingSummary(cjk), cjk);
});

test("Unicode-only space cannot invent blank-looking Daily Report operatingSummary", () => {
  const emOnly = em;
  const nbspOnly = nbsp;
  const paddedSpaces = "   ";

  // Bypass proof: prior always-pass path rendered blank-looking summaryCopy.
  assert.equal(Boolean(emOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(paddedSpaces), true);
  assert.notEqual(emOnly.trim(), emOnly);
  assert.equal(emOnly.trim(), "");

  // Soft-null restores the intentional localized none fallback.
  assert.equal(normalizeDailyReportDayOperatingSummary(emOnly), null);
  assert.equal(normalizeDailyReportDayOperatingSummary(nbspOnly), null);
  assert.equal(normalizeDailyReportDayOperatingSummary(paddedSpaces), null);
  assert.equal(normalizeDailyReportDayOperatingSummary(null), null);
  assert.equal(normalizeDailyReportDayOperatingSummary(undefined), null);
  assert.equal(normalizeDailyReportDayOperatingSummary(""), null);
  assert.equal(Boolean(normalizeDailyReportDayOperatingSummary(emOnly)), false);

  // Raw Unicode-only free-text still soft-nulls when present on the day section.
  const blankLooking = buildDailyOpsReport({
    restaurantName: "Harbor Kitchen",
    operatingDate: "2026-11-09",
    restaurantTimeZone: "America/Los_Angeles",
    restaurantCurrency: "USD",
    summary: summary({ operatingSummary: em }),
    inventoryHealth: { good: 10, watch: 2, low: 0, critical: 0 },
    operationalTasks: [],
    insights: [],
    learningMemory: null,
    now: new Date("2026-11-09T22:00:00.000Z")
  });
  assert.equal(blankLooking.day.operatingSummary, em);
  assert.equal(Boolean(blankLooking.day.operatingSummary), true);
  assert.equal(normalizeDailyReportDayOperatingSummary(blankLooking.day.operatingSummary), null);
  // Sibling restaurantName / miseStatus still receive raw values on this tip.
  assert.equal(blankLooking.day.restaurantName, "Harbor Kitchen");
  assert.equal(blankLooking.day.miseStatus, "Watch");

  // Safe operating summaries still render after normalize.
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
  assert.equal(safe.day.operatingSummary, operatingSummary);
  assert.equal(
    normalizeDailyReportDayOperatingSummary(safe.day.operatingSummary),
    operatingSummary
  );

  const missingSummary: string | null | undefined = undefined;
  const unicodeOnlySummary: string | null | undefined = em;
  // Raw || without normalize cannot soft-null truthy Unicode-only space.
  assert.equal(missingSummary || "Summary", "Summary");
  assert.equal(unicodeOnlySummary || "Summary", em);
  assert.notEqual(unicodeOnlySummary || "Summary", "Summary");
  assert.equal(Boolean(unicodeOnlySummary), true);
  // After ASCII C normalize, soft-null restores the localized none fallback.
  assert.equal(
    normalizeDailyReportDayOperatingSummary(unicodeOnlySummary) || "Summary",
    "Summary"
  );
  assert.match(
    dailyReportSource,
    /operatingSummary \|\|\s*t\("dailyReport\.day\.operatingSummary\.none"\)/
  );
});

test("NBSP folds and em-space padding cannot invent clean Daily Report operatingSummary", () => {
  const nbspSummary = `${nbsp}${operatingSummary}${nbsp}`;
  const emSummary = `${em}${operatingSummary}${em}`;
  const internalEm = `Two\u2003items`;
  const internalNbsp = `Two\u00a0items`;
  const emMultiline = `${em}${multilineSummary}${em}`;

  // Pasted NBSP folds like sibling multiline free-text prep.
  assert.equal(nbspSummary.trim(), operatingSummary);
  assert.equal(asciiPrepDailyReportDayOperatingSummary(nbspSummary), operatingSummary);
  assert.equal(normalizeDailyReportDayOperatingSummary(nbspSummary), operatingSummary);

  // Unicode trim invents a clean body; ASCII C soft-null refuses to invent.
  assert.equal(emSummary.trim(), operatingSummary);
  assert.notEqual(asciiPrepDailyReportDayOperatingSummary(emSummary), operatingSummary);
  assert.equal(normalizeDailyReportDayOperatingSummary(emSummary), null);
  assert.equal(Boolean(normalizeDailyReportDayOperatingSummary(emSummary)), false);
  assert.equal(normalizeDailyReportDayOperatingSummary(emMultiline), null);

  // Internal em-space / folded NBSP stay (no inventing strip of interior).
  assert.equal(normalizeDailyReportDayOperatingSummary(internalEm), internalEm);
  assert.equal(normalizeDailyReportDayOperatingSummary(internalNbsp), "Two items");
});

test("Unsafe multiline controls soft-null for Daily Report operatingSummary display", () => {
  assert.equal(normalizeDailyReportDayOperatingSummary(`${operatingSummary}\u0000`), null);
  assert.equal(normalizeDailyReportDayOperatingSummary(`${operatingSummary}\u0007`), null);
  assert.equal(normalizeDailyReportDayOperatingSummary(`${operatingSummary}\u007f`), null);
  assert.equal(normalizeDailyReportDayOperatingSummary(123 as unknown as string), null);
  // LF/TAB/CR remain allowed.
  assert.equal(
    normalizeDailyReportDayOperatingSummary("Line one\nLine two\tTabbed\r"),
    "Line one\nLine two\tTabbed"
  );
});
