import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { ActivityEvent } from "../services/domain/activityEvents";
import {
  buildDailyOperatingPlan,
  type BuildDailyOperatingPlanInput
} from "../services/domain/operatingPlan";
import {
  canonicalOperatingPlanWhyText,
  normalizeOperatingPlanWhyText
} from "../services/domain/operatingPlanWhyIdentity";
import {
  deriveOperationalTodayTasks,
  type OperationalTodayTask
} from "../services/domain/todayTasks";
import type {
  Insight,
  InventoryOutlookItem,
  PurchaseRecommendation,
  SetupReadinessSummary,
  SupplierOrder
} from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/operatingPlanWhyIdentity.ts", import.meta.url),
  "utf8"
);
const operatingPlanSource = readFileSync(
  new URL("../services/domain/operatingPlan.ts", import.meta.url),
  "utf8"
);

const restaurantId = "rest_why_ascii";
const timeZone = "America/New_York";
const operatingDate = "2026-08-02";
const now = new Date("2026-08-02T15:30:00.000Z");

const why = "Need reorder before lunch";
const accentedWhy = "Cobertura baja mañana";
const multilineWhy = "Need reorder before lunch.\nConfirm walk-in.\tKeep cold.";

test("MISE-005QE pins operating-plan why / completion-result text to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005QE/);
  assert.match(operatingPlanSource, /MISE-005QE/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOperatingPlanWhyText("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    operatingPlanSource,
    /normalizeOperatingPlanWhyText\(recommendation\?\.reason\)/
  );
  assert.match(operatingPlanSource, /normalizeOperatingPlanWhyText\(task\.detail\)/);
  assert.match(
    operatingPlanSource,
    /normalizeOperatingPlanWhyText\(matched\?\.summary\)/
  );
  assert.match(operatingPlanSource, /normalizeOperatingPlanWhyText\(matched\?\.title\)/);
  assert.match(
    operatingPlanSource,
    /from "\.\/operatingPlanWhyIdentity"/
  );

  const whyForTaskBody = operatingPlanSource.slice(
    operatingPlanSource.indexOf("function whyForTask("),
    operatingPlanSource.indexOf("function neededByForTask(")
  );
  assert.doesNotMatch(whyForTaskBody, /recommendation\?\.reason\?\.trim\(\)/);
  assert.doesNotMatch(whyForTaskBody, /recommendation\.reason\.trim\(\)/);
  assert.doesNotMatch(whyForTaskBody, /task\.detail\.trim\(\)/);

  const completionBody = operatingPlanSource.slice(
    operatingPlanSource.indexOf("function completionResultForTask("),
    operatingPlanSource.indexOf("function activityMatchesTask(")
  );
  assert.doesNotMatch(completionBody, /matched\?\.summary\?\.trim\(\)/);
  assert.doesNotMatch(completionBody, /matched\?\.title\?\.trim\(\)/);

  // Sibling paths stay on their existing contracts in this tip.
  assert.match(
    operatingPlanSource,
    /const restaurantId = input\.restaurantId\.trim\(\);/
  );
  assert.match(
    operatingPlanSource,
    /const token = raw\.trim\(\)\.toLocaleLowerCase\("en-US"\);/
  );
  assert.match(
    operatingPlanSource,
    /evidence\.set\(windowId, existing \? `\$\{existing\}; \$\{raw\.trim\(\)\}` : raw\.trim\(\)\);/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /operatingPlanPrepWindow/);
  assert.doesNotMatch(identitySource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesBodyIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
});

test("ASCII C multiline prep keeps ordinary operating-plan why tokens stable", () => {
  assert.equal(canonicalOperatingPlanWhyText(`  ${why}  `), why);
  assert.equal(canonicalOperatingPlanWhyText(`\t${why}\n`), why);
  assert.equal(normalizeOperatingPlanWhyText(`  ${why}  `), why);

  assert.equal(canonicalOperatingPlanWhyText(accentedWhy), accentedWhy);
  assert.equal(normalizeOperatingPlanWhyText(accentedWhy), accentedWhy);

  assert.equal(canonicalOperatingPlanWhyText(multilineWhy), multilineWhy);
  assert.equal(normalizeOperatingPlanWhyText(multilineWhy), multilineWhy);

  const recommendations = [
    recommendation({
      id: "rec_clean",
      reason: `  ${why}  `
    })
  ];
  const tasks = deriveTasks({ recommendations });
  const plan = buildDailyOperatingPlan(baseInput({ tasks, recommendations }));
  const approval = plan.items.find((item) => item.sourceTask?.source.id === "rec_clean");
  assert.equal(approval?.why, why);
});

test("NBSP folds and em-space padding cannot invent operating-plan why tokens", () => {
  const nbspWhy = `\u00a0${why}\u00a0`;
  const emWhy = `\u2003${why}\u2003`;
  const internalEm = `Need\u2003reorder before lunch`;
  const internalNbsp = `Need\u00a0reorder before lunch`;
  const emMultiline = `\u2003${multilineWhy}\u2003`;

  assert.equal(nbspWhy.trim(), why);
  assert.equal(canonicalOperatingPlanWhyText(nbspWhy), why);
  assert.equal(normalizeOperatingPlanWhyText(nbspWhy), why);
  assert.equal(canonicalOperatingPlanWhyText(internalNbsp), "Need reorder before lunch");

  // Unicode em-space trim invents a clean why; C free-text prep does not.
  assert.equal(emWhy.trim(), why);
  assert.notEqual(canonicalOperatingPlanWhyText(emWhy), why);
  assert.equal(canonicalOperatingPlanWhyText(emWhy), emWhy);
  assert.equal(normalizeOperatingPlanWhyText(emWhy), emWhy);
  assert.notEqual(normalizeOperatingPlanWhyText(emWhy), why);

  const recommendations = [
    recommendation({
      id: "rec_em",
      reason: emWhy
    })
  ];
  const tasks = deriveTasks({ recommendations });
  const plan = buildDailyOperatingPlan(baseInput({ tasks, recommendations }));
  const approval = plan.items.find((item) => item.sourceTask?.source.id === "rec_em");
  assert.equal(approval?.why, emWhy);
  assert.notEqual(approval?.why, why);

  const detailTask = manualTask({
    id: "today:recommendation:rec_detail:review_recommendation",
    detail: emWhy,
    source: { kind: "recommendation", id: "rec_detail", status: "pending" },
    action: {
      intent: "review_recommendation",
      label: "Review recommendation",
      route: "/orders",
      entityId: "rec_detail"
    }
  });
  const detailPlan = buildDailyOperatingPlan(baseInput({ tasks: [detailTask] }));
  assert.equal(detailPlan.items[0]?.why, emWhy);
  assert.notEqual(detailPlan.items[0]?.why, why);

  assert.equal(canonicalOperatingPlanWhyText(internalEm), internalEm);
  assert.notEqual(
    canonicalOperatingPlanWhyText(internalEm),
    canonicalOperatingPlanWhyText(why)
  );

  assert.equal(emMultiline.trim(), multilineWhy);
  assert.notEqual(canonicalOperatingPlanWhyText(emMultiline), multilineWhy);
  assert.equal(canonicalOperatingPlanWhyText(emMultiline), emMultiline);
  assert.equal(normalizeOperatingPlanWhyText(emMultiline), emMultiline);

  assert.equal(
    canonicalOperatingPlanWhyText("Kelvin coverage note"),
    "Kelvin coverage note"
  );
  assert.notEqual(
    canonicalOperatingPlanWhyText("Kelvin coverage note"),
    canonicalOperatingPlanWhyText("Kelvin coverage note")
  );
});

test("operating-plan why / completion soft-empty and unsafe control fall through; activity summary stays non-inventing", () => {
  assert.equal(normalizeOperatingPlanWhyText(null), null);
  assert.equal(normalizeOperatingPlanWhyText(undefined), null);
  assert.equal(normalizeOperatingPlanWhyText(""), null);
  assert.equal(normalizeOperatingPlanWhyText("   "), null);
  assert.equal(normalizeOperatingPlanWhyText("\u00a0\u00a0"), null);
  assert.equal(normalizeOperatingPlanWhyText("\u2003"), null);
  assert.equal(normalizeOperatingPlanWhyText("\n\t\r"), null);
  assert.equal(normalizeOperatingPlanWhyText("Bad\u0000Why"), null);
  assert.equal(normalizeOperatingPlanWhyText("Bad\u000bWhy"), null);
  assert.equal(normalizeOperatingPlanWhyText("Bad\u007fWhy"), null);
  assert.equal(
    normalizeOperatingPlanWhyText("Need\treorder\nbefore lunch"),
    "Need\treorder\nbefore lunch"
  );

  const softEmptyRecommendations = [
    recommendation({
      id: "rec_soft",
      reason: "\u2003"
    })
  ];
  const softTasks = deriveTasks({
    recommendations: softEmptyRecommendations
  });
  const softPlan = buildDailyOperatingPlan(
    baseInput({
      tasks: softTasks,
      recommendations: softEmptyRecommendations
    })
  );
  const softApproval = softPlan.items.find(
    (item) => item.sourceTask?.source.id === "rec_soft"
  );
  assert.ok(softApproval);
  // Soft-empty reason/detail fall through to the task completion reason.
  assert.equal(softApproval?.why, softApproval?.sourceTask?.completion.reason);

  const emSummary = `\u2003Completed supplier send\u2003`;
  const cleanSummary = "Completed supplier send";
  assert.equal(emSummary.trim(), cleanSummary);

  const sentOrders = [order({ id: "order_sent", status: "sent", delivery_date: "2026-08-01" })];
  const sentTasks = deriveTasks({ orders: sentOrders, includeCompleted: true });
  const sentTask = sentTasks.find((task) => task.source.id === "order_sent");
  assert.ok(sentTask);

  const activity: ActivityEvent[] = [
    {
      id: "activity_em",
      restaurantId,
      locationId: null,
      occurredAt: "2026-08-01T12:00:00.000Z",
      createdAt: "2026-08-01T12:00:00.000Z",
      activityType: "order_sent",
      category: "orders",
      title: "\u2003Order sent\u2003",
      summary: emSummary,
      triggerType: "owner_send",
      triggerReference: "order_sent",
      evidenceReferences: [{ type: "supplier_order", id: "order_sent", summary: emSummary }],
      sourceSystems: ["mise", "gmail"],
      actionId: null,
      recommendationId: null,
      autonomyLevel: 3,
      confidence: null,
      status: "sent",
      requiresAttention: false,
      attentionDeadline: null,
      relatedEntityType: "supplier_order",
      relatedEntityId: "order_sent",
      parentActivityId: null,
      sequenceId: null,
      metadata: {},
      errorCode: null,
      errorMessage: null,
      resolvedAt: null,
      resolvedBy: null
    }
  ];

  const completedPlan = buildDailyOperatingPlan(
    baseInput({
      tasks: sentTasks,
      orders: sentOrders,
      activityEvents: activity
    })
  );
  const completed = completedPlan.items.find((item) => item.id === sentTask?.id);
  assert.equal(completed?.completionResult, emSummary);
  assert.notEqual(completed?.completionResult, cleanSummary);
});

function baseInput(
  overrides: Partial<BuildDailyOperatingPlanInput> & {
    tasks?: OperationalTodayTask[];
  } = {}
): BuildDailyOperatingPlanInput {
  return {
    restaurantId,
    restaurantTimeZone: timeZone,
    operatingDate,
    prepWindows: ["AM", "Dinner"],
    tasks: overrides.tasks ?? [],
    orders: overrides.orders ?? [],
    recommendations: overrides.recommendations ?? [],
    activityEvents: overrides.activityEvents ?? [],
    now,
    ...overrides
  };
}

function deriveTasks(input: {
  recommendations?: PurchaseRecommendation[];
  orders?: SupplierOrder[];
  includeCompleted?: boolean;
}) {
  return deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: timeZone,
    inventoryOutlooks: [outlook("inv_watch", "Watch")],
    recommendations: input.recommendations ?? [],
    orders: input.orders ?? [],
    setupReadiness: setupReadiness(),
    insights: [insight()],
    now,
    includeCompleted: input.includeCompleted
  });
}

function insight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "insight_1",
    restaurant_id: restaurantId,
    insight_type: "sales",
    title: "Sales spike",
    description: "Dinner covers are up.",
    recommended_action: "Confirm prep levels.",
    severity: "warning",
    created_at: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}

function manualTask(overrides: Partial<OperationalTodayTask> = {}): OperationalTodayTask {
  return {
    id: "today:recommendation:rec_x:review_recommendation",
    restaurantId,
    source: { kind: "recommendation", id: "rec_x", status: "pending" },
    title: "Review reorder",
    detail: "Pending operator review.",
    priority: "normal",
    dueAt: null,
    dueDate: null,
    action: {
      intent: "review_recommendation",
      label: "Review recommendation",
      route: "/orders",
      entityId: "rec_x"
    },
    requiredRole: "manager",
    status: "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "Recommendation remains pending operator review."
    },
    ...overrides
  };
}

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec_1",
    restaurant_id: restaurantId,
    inventory_item_id: "inv_1",
    item_name: "Chicken thighs",
    supplier_id: "10000000-0000-4000-8000-000000000011",
    supplier_name: "Metro Produce",
    recommended_quantity: 18,
    unit: "lb",
    reason: "Mapped POS demand exceeds coverage.",
    urgency: "medium",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order_1",
    restaurant_id: restaurantId,
    supplier_id: "10000000-0000-4000-8000-000000000011",
    supplier_name: "Metro Produce",
    order_message: "Please deliver chicken.",
    operator_note: null,
    status: "draft",
    delivery_date: null,
    created_at: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}

function outlook(
  itemId: string,
  projectedStatus: "Watch" | "Low" | "Critical" | "Good"
): InventoryOutlookItem {
  return {
    item: {
      id: itemId,
      restaurant_id: restaurantId,
      item_name: itemId,
      category: "Protein",
      unit: "lb",
      current_quantity: 8,
      par_level: 40,
      reorder_threshold: 18,
      estimated_unit_cost: 3.5,
      supplier_id: "10000000-0000-4000-8000-000000000011",
      supplier_name: "Metro Produce",
      last_updated: "2026-08-02T11:00:00.000Z"
    },
    prediction: {
      averageDailyUsage: 10,
      historySampleDays: 14,
      historySource: "restaurant_history",
      todayDepletion: 4,
      projectedQuantity: 4,
      projectedStatus,
      daysCoverage: 0.4,
      coverageLabel: "Under 1 service day of coverage",
      demandTrend: "rising",
      trendLabel: "Rising",
      suggestedOrderQuantity: 12,
      suggestedAction: "Order 12 lb",
      urgency: "high",
      basis: "Mapped POS demand",
      depletionCopy: "Likely to run out during dinner",
      confidenceCopy: "Based on 14 service days",
      recommendationCopy: "Approve reorder before cutoff",
      whyItMatters: "Usage is above forecast.",
      countEvidence: "verified_count",
      countedAt: "2026-08-02T11:00:00.000Z",
      countAgeHours: 4,
      countFreshness: "fresh",
      unattributedTodayDepletion: 0,
      isTemporallyAuthoritative: true
    }
  };
}

function setupReadiness(): SetupReadinessSummary {
  return {
    percent: 100,
    currentStep: "email",
    steps: [
      {
        id: "profile",
        label: "Profile",
        status: "complete",
        detail: "Complete",
        missing: []
      },
      {
        id: "inventory",
        label: "Inventory",
        status: "complete",
        detail: "Complete",
        missing: []
      },
      {
        id: "recipes",
        label: "Recipes",
        status: "complete",
        detail: "Complete",
        missing: []
      },
      {
        id: "email",
        label: "Email",
        status: "complete",
        detail: "Complete",
        missing: []
      }
    ],
    missingInventory: [],
    missingRecipes: [],
    missingSuppliers: [],
    missingEmailSender: false,
    canShowSalesRhythm: true,
    canShowSupplierTrend: true,
    canShowRecipeCoverage: true,
    emailConnectionStatus: "connected"
  };
}
