import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import {
  canonicalDailyOpsAskBriefingText,
  normalizeDailyOpsAskBriefingText
} from "../services/domain/dailyOpsAskBriefingIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { Insight, PosSale, TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/dailyOpsAskBriefingIdentity.ts", import.meta.url),
  "utf8"
);
const dailyOpsReportSource = readFileSync(
  new URL("../services/domain/dailyOpsReport.ts", import.meta.url),
  "utf8"
);

const briefing = "Confirm walk-in before close";
const accentedBriefing = "Cobertura baja mañana";
const multilineBriefing = "Confirm walk-in before close.\nCheck herbs.\tKeep cold.";

function sale(partial: Partial<PosSale> & Pick<PosSale, "item_name">): PosSale {
  return {
    id: "sale-1",
    restaurant_id: "r1",
    sale_date: "2026-08-01",
    category: "Entree",
    quantity_sold: 4,
    gross_sales: 40,
    net_sales: 38,
    source_pos: "demo",
    created_at: "2026-08-01T12:00:00.000Z",
    ...partial
  };
}

function insight(
  partial: Partial<Insight> & Pick<Insight, "id" | "insight_type" | "title">
): Insight {
  return {
    restaurant_id: "r1",
    description: "desc",
    recommended_action: "Do the thing",
    why_it_matters: "It matters",
    severity: "warning",
    created_at: "2026-08-01T12:00:00.000Z",
    ...partial
  };
}

function summary(overrides: Partial<TodaySummary> = {}): TodaySummary {
  return {
    restaurantName: "Harbor",
    operatingSummary: "Two items need attention before tomorrow.",
    miseStatus: "Watch",
    learningNote: "Learning",
    salesToday: 1200,
    netSalesToday: 1100,
    itemsSold: 88,
    topItems: [sale({ item_name: "Chicken Bowl", quantity_sold: 12, gross_sales: 144 })],
    lowStockCount: 2,
    inventoryAlerts: 2,
    pendingRecommendations: 3,
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
      pendingOrderItems: 3
    },
    credibility: {
      score: 62,
      label: "Building trust",
      evidence: ["Sales history"],
      nextStep: "Keep logging deliveries"
    },
    ...overrides
  };
}

function task(
  partial: Partial<OperationalTodayTask> & Pick<OperationalTodayTask, "id" | "status">
): OperationalTodayTask {
  return {
    restaurantId: "r1",
    source: { kind: "inventory", id: partial.id, status: "open" },
    title: "Check walk-in",
    detail: "Count proteins",
    priority: "normal",
    dueAt: null,
    dueDate: "2026-08-01",
    action: {
      intent: "update_inventory_count",
      label: "Count",
      route: "/inventory",
      entityId: null
    },
    requiredRole: "member",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "Derived from inventory outlook"
    },
    ...partial
  };
}

function baseReportInput(askBriefingText: string | null | undefined) {
  return buildDailyOpsReport({
    restaurantName: "Harbor",
    operatingDate: "2026-08-01",
    restaurantTimeZone: "America/New_York",
    restaurantCurrency: "USD",
    summary: summary(),
    inventoryHealth: { good: 8, watch: 2, low: 1, critical: 1 },
    operationalTasks: [task({ id: "t1", status: "open" })],
    insights: [
      insight({
        id: "i-waste",
        insight_type: "waste",
        title: "Herbs overstocked"
      })
    ],
    askBriefingText
  });
}

test("MISE-005QF pins Daily Ops askBriefingText to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005QF/);
  assert.match(dailyOpsReportSource, /MISE-005QF/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalDailyOpsAskBriefingText("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    dailyOpsReportSource,
    /normalizeDailyOpsAskBriefingText\(askBriefingText\)/
  );
  assert.match(
    dailyOpsReportSource,
    /from "\.\/dailyOpsAskBriefingIdentity"/
  );

  const managerAdviceBody = dailyOpsReportSource.slice(
    dailyOpsReportSource.indexOf("managerAdvice: {"),
    dailyOpsReportSource.indexOf("function emptySupplierReliabilitySummary(")
  );
  assert.doesNotMatch(managerAdviceBody, /askBriefingText\?\.trim\(\)/);
  assert.doesNotMatch(managerAdviceBody, /askBriefingText\.trim\(\)/);

  // Sibling paths stay on their existing contracts in this tip.
  assert.match(
    dailyOpsReportSource,
    /const action = best\.recommended_action\?\.trim\(\);/
  );
  assert.match(dailyOpsReportSource, /const why = best\.why_it_matters\?\.trim\(\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /dailyReportRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanWhyIdentity/);
  assert.doesNotMatch(identitySource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsLessonIdentity/);
});

test("ASCII C multiline prep keeps ordinary Daily Ops ask briefing tokens stable", () => {
  assert.equal(canonicalDailyOpsAskBriefingText(`  ${briefing}  `), briefing);
  assert.equal(canonicalDailyOpsAskBriefingText(`\t${briefing}\n`), briefing);
  assert.equal(normalizeDailyOpsAskBriefingText(`  ${briefing}  `), briefing);

  assert.equal(canonicalDailyOpsAskBriefingText(accentedBriefing), accentedBriefing);
  assert.equal(normalizeDailyOpsAskBriefingText(accentedBriefing), accentedBriefing);

  assert.equal(canonicalDailyOpsAskBriefingText(multilineBriefing), multilineBriefing);
  assert.equal(normalizeDailyOpsAskBriefingText(multilineBriefing), multilineBriefing);

  const report = baseReportInput(`  ${briefing}  `);
  assert.equal(report.managerAdvice.askBriefingText, briefing);
});

test("NBSP folds and em-space padding cannot invent Daily Ops ask briefing tokens", () => {
  const nbspBriefing = `\u00a0${briefing}\u00a0`;
  const emBriefing = `\u2003${briefing}\u2003`;
  const internalEm = `Confirm\u2003walk-in before close`;
  const internalNbsp = `Confirm\u00a0walk-in before close`;
  const emMultiline = `\u2003${multilineBriefing}\u2003`;

  assert.equal(nbspBriefing.trim(), briefing);
  assert.equal(canonicalDailyOpsAskBriefingText(nbspBriefing), briefing);
  assert.equal(normalizeDailyOpsAskBriefingText(nbspBriefing), briefing);
  assert.equal(
    canonicalDailyOpsAskBriefingText(internalNbsp),
    "Confirm walk-in before close"
  );

  // Unicode em-space trim invents a clean briefing; C free-text prep does not.
  assert.equal(emBriefing.trim(), briefing);
  assert.notEqual(canonicalDailyOpsAskBriefingText(emBriefing), briefing);
  assert.equal(canonicalDailyOpsAskBriefingText(emBriefing), emBriefing);
  assert.equal(normalizeDailyOpsAskBriefingText(emBriefing), emBriefing);
  assert.notEqual(normalizeDailyOpsAskBriefingText(emBriefing), briefing);

  const report = baseReportInput(emBriefing);
  assert.equal(report.managerAdvice.askBriefingText, emBriefing);
  assert.notEqual(report.managerAdvice.askBriefingText, briefing);

  assert.equal(canonicalDailyOpsAskBriefingText(internalEm), internalEm);
  assert.notEqual(
    canonicalDailyOpsAskBriefingText(internalEm),
    canonicalDailyOpsAskBriefingText(briefing)
  );

  assert.equal(emMultiline.trim(), multilineBriefing);
  assert.notEqual(canonicalDailyOpsAskBriefingText(emMultiline), multilineBriefing);
  assert.equal(canonicalDailyOpsAskBriefingText(emMultiline), emMultiline);
  assert.equal(normalizeDailyOpsAskBriefingText(emMultiline), emMultiline);

  assert.equal(
    canonicalDailyOpsAskBriefingText("Kelvin coverage note"),
    "Kelvin coverage note"
  );
});

test("Soft empty and unsafe controls omit Daily Ops ask briefing without inventing", () => {
  assert.equal(normalizeDailyOpsAskBriefingText(null), null);
  assert.equal(normalizeDailyOpsAskBriefingText(undefined), null);
  assert.equal(normalizeDailyOpsAskBriefingText(""), null);
  assert.equal(normalizeDailyOpsAskBriefingText("   "), null);
  assert.equal(normalizeDailyOpsAskBriefingText("\t\n"), null);
  assert.equal(normalizeDailyOpsAskBriefingText("\u2003"), null);
  assert.equal(normalizeDailyOpsAskBriefingText("\u00a0"), null);
  assert.equal(normalizeDailyOpsAskBriefingText("\u2003\u00a0\u2003"), null);

  assert.equal(normalizeDailyOpsAskBriefingText(`\u0000${briefing}`), null);
  assert.equal(normalizeDailyOpsAskBriefingText(`${briefing}\u0007`), null);
  assert.equal(normalizeDailyOpsAskBriefingText(`${briefing}\u007f`), null);

  // LF/TAB/CR remain allowed inside briefing prose.
  assert.equal(
    normalizeDailyOpsAskBriefingText("Line one.\nLine two.\tKeep."),
    "Line one.\nLine two.\tKeep."
  );

  assert.equal(baseReportInput(null).managerAdvice.askBriefingText, null);
  assert.equal(baseReportInput("\u2003").managerAdvice.askBriefingText, null);
  assert.equal(baseReportInput(`\u0000${briefing}`).managerAdvice.askBriefingText, null);
});
