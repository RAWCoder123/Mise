import assert from "node:assert/strict";
import test from "node:test";

import type {
  MonitoringRow,
  OperatingBriefApprovalCard
} from "../services/domain/operatingBrief";
import {
  presentDataFreshnessLabel,
  presentOperatingBriefApproval,
  presentOperatingBriefMonitoringRow,
  presentOperatingBriefPulseSummary,
  presentRestaurantStatusEvidence
} from "../services/presentation/operatingBriefPresentation";
import type { DataFreshnessDescriptor } from "../services/domain/operatingBrief";

const locales = ["en", "es", "zh-Hans"] as const;
const itemName = "龙门 Tomato";
const supplierName = "Proveedor Ñ";

function recommendationCard(
  overrides: Partial<OperatingBriefApprovalCard> = {}
): OperatingBriefApprovalCard {
  return {
    id: "approval_rec_1",
    source: "recommendation",
    recommendationId: "rec_1",
    actionId: null,
    orderId: null,
    findingId: null,
    titleIsStructured: true,
    title: `Approve ${itemName} reorder`,
    decision: `Approve 18 lb from ${supplierName}`,
    whyItMatters: "Lunch usage was 24% above forecast.",
    recommendedAction: `Order 18 lb from ${supplierName}`,
    deadline: null,
    confidence: 0.72,
    confidenceRationale: "Based on an inventory count updated within 24 hours.",
    confidenceReasons: [{ code: "count_within_24h" }],
    expectedOperationalImpact: `Protects ${itemName} availability through the next service window.`,
    estimatedFinancialImpact: null,
    riskIfIgnored: `Ignoring this can force an 86 or emergency purchase for ${itemName}.`,
    workAlreadyCompleted: [
      "Compared current quantity with mapped demand",
      "Prepared a recommended reorder quantity"
    ],
    itemName,
    actionType: null,
    supplierName,
    quantity: 18,
    unit: "lb",
    ...overrides
  };
}

function actionCard(overrides: Partial<OperatingBriefApprovalCard> = {}): OperatingBriefApprovalCard {
  return {
    id: "approval_action_1",
    source: "action",
    recommendationId: null,
    actionId: "action_1",
    orderId: "order_1",
    findingId: null,
    titleIsStructured: true,
    title: `Approve send to ${supplierName}`,
    decision: "Approve prepared action (send_supplier_order)",
    whyItMatters: "Mise prepared this action and is waiting for an explicit operator decision.",
    recommendedAction: "Approve to continue, or reject to cancel execution.",
    deadline: null,
    confidence: null,
    confidenceRationale: null,
    confidenceReasons: null,
    expectedOperationalImpact: "Continues the prepared operational workflow.",
    estimatedFinancialImpact: null,
    riskIfIgnored: "Leaving this undecided blocks the prepared workflow.",
    workAlreadyCompleted: ["Prepared the action with evidence", "Checked autonomy and permission gates"],
    itemName: null,
    actionType: "send_supplier_order",
    supplierName,
    quantity: null,
    unit: null,
    ...overrides
  };
}

test("presentOperatingBriefApproval localizes recommendation copy and preserves stored reason", () => {
  for (const locale of locales) {
    const presented = presentOperatingBriefApproval(locale, recommendationCard());
    assert.ok(presented.title.includes(itemName), `${locale} title preserves item`);
    assert.ok(presented.recommendedAction.includes(supplierName), `${locale} action preserves supplier`);
    assert.equal(presented.whyItMatters, "Lunch usage was 24% above forecast.");
    if (locale === "es") {
      assert.match(presented.title, /Aprobar/);
      assert.match(presented.recommendedAction, /Pedir/);
    }
    if (locale === "zh-Hans") {
      assert.match(presented.title, /批准/);
      assert.match(presented.recommendedAction, /订购|下单/);
    }
  }
});

test("presentOperatingBriefApproval localizes structured action templates", () => {
  const presentedEs = presentOperatingBriefApproval("es", actionCard());
  assert.ok(presentedEs.title.includes(supplierName));
  assert.match(presentedEs.title, /Aprobar envío/);
  assert.match(presentedEs.whyItMatters, /preparó esta acción/i);
  assert.notEqual(presentedEs.recommendedAction, actionCard().recommendedAction);

  const customTitle = presentOperatingBriefApproval(
    "zh-Hans",
    actionCard({
      titleIsStructured: false,
      title: "Custom manager title Ñ"
    })
  );
  assert.equal(customTitle.title, "Custom manager title Ñ");
});

test("presentOperatingBriefApproval keeps finding prose unchanged", () => {
  const finding = recommendationCard({
    source: "finding",
    recommendationId: null,
    findingId: "finding_1",
    titleIsStructured: false,
    title: "Unmapped dish needs recipe",
    recommendedAction: "Map the sold dish before depletion.",
    whyItMatters: "Sales cannot deplete inventory without a recipe.",
    decision: "Map recipe",
    itemName: null,
    quantity: null,
    unit: null,
    supplierName: null,
    workAlreadyCompleted: ["Saw 12 sold units without a recipe"]
  });
  const presented = presentOperatingBriefApproval("es", finding);
  assert.equal(presented.title, finding.title);
  assert.equal(presented.recommendedAction, finding.recommendedAction);
  assert.equal(presented.whyItMatters, finding.whyItMatters);
});

test("presentOperatingBriefPulseSummary localizes status copy from structured counts", () => {
  const brief = {
    restaurantStatus: {
      status: "attention_needed" as const,
      summary: "English only summary",
      lastUpdated: "2026-08-27T12:00:00.000Z",
      dataFreshness: {
        state: "fresh" as const,
        asOf: "2026-08-27T12:00:00.000Z",
        label: "fresh",
        missingData: [],
        missingCodes: [],
        ageHours: 2
      },
      confidence: 0.7,
      confidenceRationale: "ok",
      topRisk: null,
      topOpportunity: null,
      nextDecisionDeadline: null
    },
    needsApproval: [recommendationCard()],
    outlook: {
      expectedSales: null,
      expectedSalesContext: null,
      prepReadiness: "gaps" as const,
      prepReadinessDetail: "gaps",
      staffingCoverage: "unknown" as const,
      staffingDetail: "unknown",
      deliveryStatus: "none" as const,
      deliveryDetail: "none",
      menuRisks: [{ itemName, label: "Watch" as const, detail: "Coverage is thin." }],
      supplierCutoffDeadlines: [],
      preventableLoss: null
    }
  };

  const es = presentOperatingBriefPulseSummary("es", brief);
  assert.match(es, /Atención/i);
  assert.ok(!es.includes("Attention needed"));
  assert.ok(!es.includes("English only summary"));
});

test("presentOperatingBriefMonitoringRow localizes inventory, order, and approval rows", () => {
  const inventory: MonitoringRow = {
    id: "watch_inventory_1",
    kind: "inventory",
    title: `Tracking ${itemName} usage`,
    detail: "May run out today",
    startedAt: "2026-08-27T12:00:00.000Z",
    status: "monitoring",
    subjectName: itemName,
    deliveryDate: null,
    approvalCount: null,
    inventoryCoverage: {
      daysCoverage: 0.5,
      averageDailyUsage: 10,
      projectedQuantity: 4,
      parLevel: 20
    },
    relatedEntityType: "inventory_item",
    relatedEntityId: "inv_1"
  };
  const order: MonitoringRow = {
    id: "watch_order_1",
    kind: "supplier_order",
    title: `Waiting for ${supplierName} confirmation`,
    detail: "Expected delivery 2026-08-28.",
    startedAt: "2026-08-27T12:00:00.000Z",
    status: "waiting",
    subjectName: supplierName,
    deliveryDate: "2026-08-28",
    approvalCount: null,
    inventoryCoverage: null,
    relatedEntityType: "supplier_order",
    relatedEntityId: "order_1"
  };
  const approvals: MonitoringRow = {
    id: "watch_approvals",
    kind: "approvals",
    title: "Watching open approval deadlines",
    detail: "2 decisions still need an owner.",
    startedAt: "2026-08-27T12:00:00.000Z",
    status: "waiting",
    subjectName: null,
    deliveryDate: null,
    approvalCount: 2,
    inventoryCoverage: null,
    relatedEntityType: null,
    relatedEntityId: null
  };

  const zhInventory = presentOperatingBriefMonitoringRow("zh-Hans", inventory);
  assert.ok(zhInventory.title.includes(itemName));
  assert.match(zhInventory.title, /跟踪/);
  assert.match(zhInventory.detail, /今日可能用完/);
  assert.notEqual(zhInventory.detail, inventory.detail);

  const esInventory = presentOperatingBriefMonitoringRow("es", inventory);
  assert.match(esInventory.detail, /Podría agotarse hoy/);

  const esOrder = presentOperatingBriefMonitoringRow("es", order);
  assert.ok(esOrder.title.includes(supplierName));
  assert.match(esOrder.detail, /2026-08-28/);

  const esApprovals = presentOperatingBriefMonitoringRow("es", approvals);
  assert.match(esApprovals.detail, /2/);
  assert.ok(!esApprovals.title.includes("Watching open"));
});

test("presentOperatingBriefApproval localizes structured confidence rationale fragments", () => {
  const card = recommendationCard({
    confidenceReasons: [
      { code: "restaurant_history_samples", sampleDays: 9 },
      { code: "count_within_24h" },
      { code: "coverage_below_reorder" }
    ],
    confidenceRationale:
      "Based on 9 restaurant service-day samples, an inventory count updated within 24 hours, projected coverage below the reorder threshold."
  });

  const en = presentOperatingBriefApproval("en", card);
  assert.match(en.confidenceRationale ?? "", /Based on/);
  assert.match(en.confidenceRationale ?? "", /9 restaurant service-day samples/);
  assert.match(en.confidenceRationale ?? "", /within 24 hours/);
  assert.match(en.confidenceLine ?? "", /^72% · /);
  assert.ok((en.confidenceLine ?? "").includes(en.confidenceRationale ?? ""));

  const es = presentOperatingBriefApproval("es", card);
  assert.match(es.confidenceRationale ?? "", /Basado en/i);
  assert.match(es.confidenceRationale ?? "", /9/);
  assert.match(es.confidenceRationale ?? "", /24 horas/);
  assert.ok(!(es.confidenceRationale ?? "").includes("Based on"));
  assert.match(es.confidenceLine ?? "", /72\s*%/);

  const zh = presentOperatingBriefApproval("zh-Hans", card);
  assert.match(zh.confidenceRationale ?? "", /基于/);
  assert.match(zh.confidenceRationale ?? "", /24/);
  assert.ok(!(zh.confidenceRationale ?? "").includes("Based on"));
  assert.match(zh.confidenceLine ?? "", /72%/);

  const unavailable = presentOperatingBriefApproval(
    "es",
    recommendationCard({
      confidence: null,
      confidenceReasons: [{ code: "unavailable" }],
      confidenceRationale:
        "Confidence is unavailable until Mise can calculate this item's demand and count freshness."
    })
  );
  assert.match(unavailable.confidenceRationale ?? "", /confianza no está disponible/i);
  assert.ok(!(unavailable.confidenceRationale ?? "").includes("Confidence is unavailable"));
  assert.equal(unavailable.confidenceLine, unavailable.confidenceRationale);
});

test("presentDataFreshnessLabel and restaurant status evidence localize structured freshness", () => {
  const incomplete: DataFreshnessDescriptor = {
    state: "incomplete",
    asOf: "2026-08-27T12:00:00.000Z",
    label: "Incomplete: missing POS sales, verified inventory counts.",
    missingData: ["POS sales", "verified inventory counts"],
    missingCodes: ["pos_sales", "verified_inventory_counts"],
    ageHours: null
  };
  const stale: DataFreshnessDescriptor = {
    state: "stale",
    asOf: "2026-08-25T12:00:00.000Z",
    label: "Last operational update was about 48 hours ago.",
    missingData: [],
    missingCodes: [],
    ageHours: 48
  };
  const fresh: DataFreshnessDescriptor = {
    state: "fresh",
    asOf: "2026-08-27T12:00:00.000Z",
    label: "Operational data is current enough for service decisions.",
    missingData: [],
    missingCodes: [],
    ageHours: 3
  };

  const esIncomplete = presentDataFreshnessLabel("es", incomplete);
  assert.match(esIncomplete, /Incompleto/i);
  assert.match(esIncomplete, /ventas POS/i);
  assert.ok(!esIncomplete.includes("POS sales"));

  const zhStale = presentDataFreshnessLabel("zh-Hans", stale);
  assert.match(zhStale, /48/);
  assert.ok(!zhStale.includes("Last operational update"));

  const evidence = presentRestaurantStatusEvidence("es", {
    status: "attention_needed",
    summary: "English only summary",
    lastUpdated: fresh.asOf,
    dataFreshness: fresh,
    confidence: 0.82,
    confidenceRationale: "Confidence reflects current inventory and sales coverage with no major data gaps.",
    topRisk: null,
    topOpportunity: null,
    nextDecisionDeadline: null
  });
  assert.match(evidence.confidenceRationale, /confianza refleja/i);
  assert.ok(!evidence.confidenceRationale.includes("Confidence reflects"));
  assert.match(evidence.confidenceScore, /82\s*%/);
  assert.equal(evidence.rationaleDistinctFromFreshness, true);
  assert.match(evidence.metaLine, /Datos:/i);
  assert.match(evidence.metaLine, /Confianza/i);
  assert.match(evidence.metaLine, /confianza refleja/i);
  assert.match(evidence.metaLineCompact, /Confianza/i);
  assert.ok(!evidence.metaLineCompact.includes("confianza refleja"));
  assert.ok(!evidence.metaLine.includes("English only summary"));

  const incompleteEvidence = presentRestaurantStatusEvidence("en", {
    status: "at_risk",
    summary: "At risk",
    lastUpdated: incomplete.asOf,
    dataFreshness: incomplete,
    confidence: 0.34,
    confidenceRationale: incomplete.label,
    topRisk: incomplete.label,
    topOpportunity: null,
    nextDecisionDeadline: null
  });
  assert.equal(incompleteEvidence.rationaleDistinctFromFreshness, false);
  assert.equal(incompleteEvidence.metaLine, incompleteEvidence.metaLineCompact);
  assert.match(incompleteEvidence.metaLine, /Confidence 34\s*%/);
  assert.ok(!incompleteEvidence.metaLine.includes("Confidence 34%:"));
  assert.match(incompleteEvidence.confidenceRationale, /Incomplete/i);
});
