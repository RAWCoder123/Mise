import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assessOrderAutomation,
  deriveOrderAutomationPolicy,
  summarizeOrderAutomationReadiness,
  type OrderAutomationAssessment,
  type OrderAutomationPolicy
} from "../services/domain/orderAutomation";
import {
  orderAutomationBlockerLabelKey,
  orderAutomationDecisionLabelKey,
  presentOrderAutomationBlockerKeys,
  presentOrderAutomationSummaryKey
} from "../services/presentation/orderAutomationPresentation";
import type { InventoryItem, PurchaseRecommendation } from "../types/mise";

const restaurantId = "rest_automation";
const supplierId = "00000000-0000-4000-8000-000000000101";
const supplierName = "Fresh Produce Co.";
const now = new Date("2026-07-26T16:00:00.000Z");

function inventory(id: string, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id,
    restaurant_id: restaurantId,
    item_name: id,
    category: "Produce",
    unit: "lb",
    current_quantity: 2,
    par_level: 20,
    reorder_threshold: 5,
    estimated_unit_cost: 4,
    supplier_id: supplierId,
    supplier_name: supplierName,
    last_updated: "2026-07-26T12:00:00.000Z",
    ...overrides
  };
}

function recommendation(
  id: string,
  itemId: string,
  quantity: number,
  overrides: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id,
    restaurant_id: restaurantId,
    inventory_item_id: itemId,
    item_name: itemId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    recommended_quantity: quantity,
    unit: "lb",
    reason: "Projected stock is below the reorder threshold.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-07-26T12:30:00.000Z",
    ...overrides
  };
}

function history(itemId: string, quantities: readonly number[]) {
  return quantities.map((quantity, index) =>
    recommendation(`history_${itemId}_${index}`, itemId, quantity, {
      status: "ordered",
      created_at: `2026-07-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`
    })
  );
}

test("deriveOrderAutomationPolicy maps draft enablement and spend without unlocking approved send", () => {
  const policy = deriveOrderAutomationPolicy(
    [
      {
        actionType: "prepare_supplier_order_draft",
        enabled: true,
        requiresApproval: true,
        spendLimitCents: 40000,
        supplierId: null
      },
      {
        actionType: "send_supplier_order",
        enabled: true,
        requiresApproval: true,
        spendLimitCents: 20000,
        supplierId: null
      }
    ],
    supplierId
  );

  assert.equal(policy.enabled, true);
  assert.equal(policy.allowAutomaticSend, false);
  assert.equal(policy.maximumOrderValue, 400);
  assert.equal(policy.maximumLineValue, 250);
});

test("deriveOrderAutomationPolicy prefers supplier-scoped draft rules over restaurant-wide", () => {
  const policy = deriveOrderAutomationPolicy(
    [
      {
        actionType: "prepare_supplier_order_draft",
        enabled: false,
        requiresApproval: true,
        spendLimitCents: 50000,
        supplierId: null
      },
      {
        actionType: "prepare_supplier_order_draft",
        enabled: true,
        requiresApproval: true,
        spendLimitCents: 15000,
        supplierId
      }
    ],
    supplierId
  );

  assert.equal(policy.enabled, true);
  assert.equal(policy.maximumOrderValue, 150);
  assert.equal(policy.maximumLineValue, 150);
});

test("summarizeOrderAutomationReadiness counts decisions without inventing suppliers", () => {
  const summary = summarizeOrderAutomationReadiness([
    {
      restaurantId,
      supplierId,
      supplierName,
      decision: "manual_review",
      estimatedOrderValue: null,
      lines: [],
      blockers: ["automation_disabled"],
      sendBlockers: ["automatic_send_disabled"]
    },
    {
      restaurantId,
      supplierId: "00000000-0000-4000-8000-000000000102",
      supplierName: "Dairy",
      decision: "automatic_draft",
      estimatedOrderValue: 40,
      lines: [],
      blockers: [],
      sendBlockers: ["automatic_send_disabled"]
    }
  ]);

  assert.deepEqual(summary, {
    manualReviewCount: 1,
    automaticDraftCount: 1,
    automaticSendCount: 0,
    supplierCount: 2
  });
  assert.equal(presentOrderAutomationSummaryKey(summary), "autonomy.readiness.summary.needsReview");
  assert.equal(
    presentOrderAutomationSummaryKey({
      manualReviewCount: 0,
      automaticDraftCount: 0,
      automaticSendCount: 0,
      supplierCount: 0
    }),
    "autonomy.readiness.summary.empty"
  );
});

test("presentOrderAutomationBlockerKeys stays draft-first and capped", () => {
  const assessment: OrderAutomationAssessment = {
    restaurantId,
    supplierId,
    supplierName,
    decision: "automatic_draft",
    estimatedOrderValue: 48,
    lines: [],
    blockers: [],
    sendBlockers: ["automatic_send_disabled", "email_not_connected"]
  };
  assert.deepEqual(presentOrderAutomationBlockerKeys(assessment, 4), [
    "autonomy.readiness.sendBlocker.automaticSendDisabled",
    "autonomy.readiness.sendBlocker.emailNotConnected"
  ]);
  assert.equal(orderAutomationDecisionLabelKey("manual_review"), "autonomy.readiness.decision.manualReview");
  assert.equal(
    orderAutomationBlockerLabelKey("stale_inventory_count"),
    "autonomy.readiness.blocker.staleInventoryCount"
  );
});

test("enabled autonomy policy with ledger evidence can reach automatic_draft", () => {
  const policy: OrderAutomationPolicy = deriveOrderAutomationPolicy([
    {
      actionType: "prepare_supplier_order_draft",
      enabled: true,
      requiresApproval: true,
      spendLimitCents: 50000,
      supplierId: null
    }
  ]);
  const assessment = assessOrderAutomation({
    restaurantId,
    supplierId,
    supplierName,
    candidates: [recommendation("rec_kale", "kale", 12)],
    inventoryItems: [inventory("kale")],
    recommendationHistory: history("kale", [11, 12, 12]),
    inventoryLedgerEvents: [
      {
        restaurantId,
        inventoryItemId: "kale",
        effectiveAt: "2026-07-26T12:00:00.000Z",
        eventType: "count",
        sequence: 1
      }
    ],
    policy,
    delivery: {
      emailConnected: true,
      supplierRecipientConfigured: true
    },
    now
  });
  assert.equal(assessment.decision, "automatic_draft");
  assert.deepEqual(assessment.blockers, []);
});

test("orders application readiness fetch wires ledger evidence and autonomy policy", () => {
  const source = readFileSync(join(process.cwd(), "services/application/orders.ts"), "utf8");
  assert.match(source, /fetchInventoryLedgerEvidence/);
  assert.match(source, /inventoryLedgerEvents:\s*ledger\.events/);
  assert.match(source, /ledgerComplete:\s*ledger\.complete/);
  assert.match(source, /deriveOrderAutomationPolicy/);
  assert.match(source, /fetchRestaurantOrderAutomationReadiness/);
  assert.match(source, /fetchAutonomyRules/);
});

test("Autonomy settings surfaces readiness presentation without inventing ready claims", () => {
  const source = readFileSync(join(process.cwd(), "app/settings/autonomy.tsx"), "utf8");
  assert.match(source, /fetchRestaurantOrderAutomationReadiness/);
  assert.match(source, /presentOrderAutomationBlockerKeys/);
  assert.match(source, /setReadiness\(null\)/);
  assert.match(source, /readinessError/);
  assert.match(source, /autonomy\.readiness\.title/);
});
