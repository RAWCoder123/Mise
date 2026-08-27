import assert from "node:assert/strict";
import test from "node:test";

import type {
  MonitoringRow,
  OperatingBriefApprovalCard
} from "../services/domain/operatingBrief";
import {
  presentOperatingBriefApproval,
  presentOperatingBriefMonitoringRow,
  presentOperatingBriefPulseSummary
} from "../services/presentation/operatingBriefPresentation";

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
        missingData: []
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
    detail: "Under 1 service day of coverage",
    startedAt: "2026-08-27T12:00:00.000Z",
    status: "monitoring",
    subjectName: itemName,
    deliveryDate: null,
    approvalCount: null,
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
    relatedEntityType: null,
    relatedEntityId: null
  };

  const zhInventory = presentOperatingBriefMonitoringRow("zh-Hans", inventory);
  assert.ok(zhInventory.title.includes(itemName));
  assert.match(zhInventory.title, /跟踪/);
  assert.equal(zhInventory.detail, inventory.detail);

  const esOrder = presentOperatingBriefMonitoringRow("es", order);
  assert.ok(esOrder.title.includes(supplierName));
  assert.match(esOrder.detail, /2026-08-28/);

  const esApprovals = presentOperatingBriefMonitoringRow("es", approvals);
  assert.match(esApprovals.detail, /2/);
  assert.ok(!esApprovals.title.includes("Watching open"));
});
