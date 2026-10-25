import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDailyOpsReport } from "../services/domain/dailyOpsReport";
import {
  canonicalDailyOpsSignalLineText,
  normalizeDailyOpsSignalLineText
} from "../services/domain/dailyOpsSignalLineIdentity";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { Insight, PosSale, TodaySummary } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/dailyOpsSignalLineIdentity.ts", import.meta.url),
  "utf8"
);
const dailyOpsReportSource = readFileSync(
  new URL("../services/domain/dailyOpsReport.ts", import.meta.url),
  "utf8"
);

const action = "Special the herbs tonight";
const why = "Wilts tomorrow";
const accentedAction = "Revisar cobertura mañana";
const multilineAction = "Special the herbs tonight.\nCheck walk-in.\tKeep cold.";

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

function baseReportInput(
  wasteInsight: Partial<Insight> & Pick<Insight, "recommended_action" | "why_it_matters">
) {
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
        title: "Herbs overstocked",
        ...wasteInsight
      })
    ]
  });
}

function wasteSignalLine(report: ReturnType<typeof buildDailyOpsReport>) {
  return report.signalsByType.find((signal) => signal.type === "waste")?.line ?? null;
}

test("MISE-005QG pins Daily Ops pickSignalLine insight free-text to ASCII C", () => {
  assert.match(identitySource, /MISE-005QG/);
  assert.match(dailyOpsReportSource, /MISE-005QG/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalDailyOpsSignalLineText("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    dailyOpsReportSource,
    /normalizeDailyOpsSignalLineText\(best\.recommended_action\)/
  );
  assert.match(
    dailyOpsReportSource,
    /normalizeDailyOpsSignalLineText\(best\.why_it_matters\)/
  );
  assert.match(dailyOpsReportSource, /from "\.\/dailyOpsSignalLineIdentity"/);

  const pickSignalBody = dailyOpsReportSource.slice(
    dailyOpsReportSource.indexOf("function pickSignalLine("),
    dailyOpsReportSource.indexOf("function rankManagerActions(")
  );
  assert.doesNotMatch(pickSignalBody, /recommended_action\?\.trim\(\)/);
  assert.doesNotMatch(pickSignalBody, /why_it_matters\?\.trim\(\)/);
  assert.doesNotMatch(pickSignalBody, /recommended_action\.trim\(\)/);
  assert.doesNotMatch(pickSignalBody, /why_it_matters\.trim\(\)/);

  // Sibling paths stay on their existing contracts in this tip.
  assert.match(
    dailyOpsReportSource,
    /askBriefingText\?\.trim\(\) \? askBriefingText\.trim\(\) : null/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /dailyOpsAskBriefingIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanWhyIdentity/);
  assert.doesNotMatch(identitySource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /dailyReportRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingRecommendedActionIdentity/);
});

test("ASCII C multiline prep keeps ordinary Daily Ops signal-line tokens stable", () => {
  assert.equal(canonicalDailyOpsSignalLineText(`  ${action}  `), action);
  assert.equal(canonicalDailyOpsSignalLineText(`\t${action}\n`), action);
  assert.equal(normalizeDailyOpsSignalLineText(`  ${action}  `), action);

  assert.equal(canonicalDailyOpsSignalLineText(accentedAction), accentedAction);
  assert.equal(normalizeDailyOpsSignalLineText(accentedAction), accentedAction);

  assert.equal(canonicalDailyOpsSignalLineText(multilineAction), multilineAction);
  assert.equal(normalizeDailyOpsSignalLineText(multilineAction), multilineAction);

  const report = baseReportInput({
    recommended_action: `  ${action}  `,
    why_it_matters: `  ${why}  `
  });
  assert.equal(wasteSignalLine(report), `${action} — ${why}`);
});

test("NBSP folds and em-space padding cannot invent Daily Ops signal-line tokens", () => {
  const nbspAction = `\u00a0${action}\u00a0`;
  const emAction = `\u2003${action}\u2003`;
  const emWhy = `\u2003${why}\u2003`;
  const internalEm = `Special\u2003the herbs tonight`;
  const internalNbsp = `Special\u00a0the herbs tonight`;
  const emMultiline = `\u2003${multilineAction}\u2003`;

  assert.equal(nbspAction.trim(), action);
  assert.equal(canonicalDailyOpsSignalLineText(nbspAction), action);
  assert.equal(normalizeDailyOpsSignalLineText(nbspAction), action);
  assert.equal(
    canonicalDailyOpsSignalLineText(internalNbsp),
    "Special the herbs tonight"
  );

  // Unicode em-space trim invents a clean action; C free-text prep does not.
  assert.equal(emAction.trim(), action);
  assert.notEqual(canonicalDailyOpsSignalLineText(emAction), action);
  assert.equal(canonicalDailyOpsSignalLineText(emAction), emAction);
  assert.equal(normalizeDailyOpsSignalLineText(emAction), emAction);
  assert.notEqual(normalizeDailyOpsSignalLineText(emAction), action);

  const report = baseReportInput({
    recommended_action: emAction,
    why_it_matters: emWhy
  });
  const line = wasteSignalLine(report);
  assert.equal(line, `${emAction} — ${emWhy}`);
  assert.notEqual(line, `${action} — ${why}`);

  assert.equal(canonicalDailyOpsSignalLineText(internalEm), internalEm);
  assert.notEqual(
    canonicalDailyOpsSignalLineText(internalEm),
    canonicalDailyOpsSignalLineText(action)
  );

  assert.equal(emMultiline.trim(), multilineAction);
  assert.notEqual(canonicalDailyOpsSignalLineText(emMultiline), multilineAction);
  assert.equal(canonicalDailyOpsSignalLineText(emMultiline), emMultiline);
  assert.equal(normalizeDailyOpsSignalLineText(emMultiline), emMultiline);

  assert.equal(
    canonicalDailyOpsSignalLineText("Kelvin coverage note"),
    "Kelvin coverage note"
  );
});

test("Soft empty and unsafe controls fall through Daily Ops signal lines without inventing", () => {
  assert.equal(normalizeDailyOpsSignalLineText(null), null);
  assert.equal(normalizeDailyOpsSignalLineText(undefined), null);
  assert.equal(normalizeDailyOpsSignalLineText(""), null);
  assert.equal(normalizeDailyOpsSignalLineText("   "), null);
  assert.equal(normalizeDailyOpsSignalLineText("\t\n"), null);
  assert.equal(normalizeDailyOpsSignalLineText("\u2003"), null);
  assert.equal(normalizeDailyOpsSignalLineText("\u00a0"), null);
  assert.equal(normalizeDailyOpsSignalLineText("\u2003\u00a0\u2003"), null);

  assert.equal(normalizeDailyOpsSignalLineText(`\u0000${action}`), null);
  assert.equal(normalizeDailyOpsSignalLineText(`${action}\u0007`), null);
  assert.equal(normalizeDailyOpsSignalLineText(`${action}\u007f`), null);

  // LF/TAB/CR remain allowed inside insight prose.
  assert.equal(
    normalizeDailyOpsSignalLineText("Line one.\nLine two.\tKeep."),
    "Line one.\nLine two.\tKeep."
  );

  // Soft-empty action falls through to why (parity with prior `.trim()` falsy).
  assert.equal(
    wasteSignalLine(
      baseReportInput({
        recommended_action: "\u2003",
        why_it_matters: why
      })
    ),
    why
  );

  // Soft-empty why keeps action-only line (no trailing separator).
  assert.equal(
    wasteSignalLine(
      baseReportInput({
        recommended_action: action,
        why_it_matters: "\u2003"
      })
    ),
    action
  );

  // Soft-empty action+why fall through to description.
  assert.equal(
    wasteSignalLine(
      baseReportInput({
        recommended_action: "\u2003",
        why_it_matters: "\u00a0",
        description: "Raw description fallback"
      })
    ),
    "Raw description fallback"
  );

  assert.equal(
    wasteSignalLine(
      baseReportInput({
        recommended_action: `\u0000${action}`,
        why_it_matters: why
      })
    ),
    why
  );
});
