import assert from "node:assert/strict";
import test from "node:test";

import {
  assessOrderAutomation,
  type OrderAutomationPolicy
} from "../services/domain/orderAutomation";
import type { VerifiedCountCandidate } from "../services/domain/inventoryCountAuthority";
import type { InventoryItem, PurchaseRecommendation } from "../types/mise";

const restaurantId = "rest_automation";
const supplierId = "00000000-0000-4000-8000-000000000101";
const supplierName = "Fresh Produce Co.";
const now = new Date("2026-07-26T16:00:00.000Z");
const policy: OrderAutomationPolicy = {
  enabled: true,
  allowAutomaticSend: false,
  maximumOrderValue: 500,
  maximumLineValue: 250,
  maximumInventoryAgeHours: 24,
  maximumRecommendationAgeHours: 24,
  minimumHistoricalApprovals: 3,
  maximumQuantityVarianceRatio: 0.25,
  historyLookbackDays: 180
};

function inventory(
  id: string,
  overrides: Partial<InventoryItem> = {}
): InventoryItem {
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

/**
 * Ledger `count` evidence. Automation freshness must come from this, never from
 * `inventory_items.last_updated`, which also moves for policy and cost edits.
 */
function verifiedCounts(
  entries: readonly (readonly [string, string])[]
): VerifiedCountCandidate[] {
  return entries.map(([inventoryItemId, effectiveAt], index) => ({
    restaurantId,
    inventoryItemId,
    effectiveAt,
    eventType: "count",
    sequence: index + 1
  }));
}

function history(itemId: string, quantities: readonly number[]) {
  return quantities.map((quantity, index) =>
    recommendation(`history_${itemId}_${index}`, itemId, quantity, {
      status: "ordered",
      created_at: `2026-07-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`
    })
  );
}

test("stable, fresh, bounded supplier work becomes eligible only for an automatic draft", () => {
  const assessment = assessOrderAutomation({
    restaurantId,
    supplierId,
    supplierName,
    candidates: [recommendation("rec_tomatoes", "tomatoes", 20)],
    inventoryItems: [inventory("tomatoes")],
    recommendationHistory: history("tomatoes", [18, 20, 20, 22]),
    inventoryLedgerEvents: verifiedCounts([["tomatoes", "2026-07-26T12:00:00.000Z"]]),
    policy,
    delivery: {
      emailConnected: true,
      supplierRecipientConfigured: true
    },
    now
  });

  assert.equal(assessment.decision, "automatic_draft");
  assert.equal(assessment.estimatedOrderValue, 80);
  assert.deepEqual(assessment.blockers, []);
  assert.deepEqual(assessment.sendBlockers, ["automatic_send_disabled"]);
  assert.equal(assessment.lines[0]?.historicalMedianQuantity, 20);
  assert.equal(assessment.lines[0]?.quantityVarianceRatio, 0);
});

test("automatic send requires explicit policy plus verified delivery readiness", () => {
  const input = {
    restaurantId,
    supplierId,
    supplierName,
    candidates: [recommendation("rec_onions", "onions", 10)],
    inventoryItems: [inventory("onions", { estimated_unit_cost: 2.5 })],
    recommendationHistory: history("onions", [9, 10, 10]),
    inventoryLedgerEvents: verifiedCounts([["onions", "2026-07-26T12:00:00.000Z"]]),
    policy: { ...policy, allowAutomaticSend: true },
    now
  };

  const missingDelivery = assessOrderAutomation(input);
  assert.equal(missingDelivery.decision, "automatic_draft");
  assert.deepEqual(missingDelivery.sendBlockers, [
    "email_not_connected",
    "supplier_recipient_missing"
  ]);

  const ready = assessOrderAutomation({
    ...input,
    delivery: {
      emailConnected: true,
      supplierRecipientConfigured: true
    }
  });
  assert.equal(ready.decision, "automatic_send");
  assert.deepEqual(ready.blockers, []);
  assert.deepEqual(ready.sendBlockers, []);
});

test("stale counts, weak history, quantity drift, and missing prices force manual review", () => {
  const assessment = assessOrderAutomation({
    restaurantId,
    supplierId,
    supplierName,
    candidates: [
      recommendation("rec_herbs", "herbs", 30),
      recommendation("rec_garlic", "garlic", 8)
    ],
    inventoryItems: [
      inventory("herbs"),
      inventory("garlic", { estimated_unit_cost: 0 })
    ],
    recommendationHistory: [
      ...history("herbs", [10, 10, 10]),
      ...history("garlic", [8])
    ],
    inventoryLedgerEvents: verifiedCounts([
      ["herbs", "2026-07-24T12:00:00.000Z"],
      ["garlic", "2026-07-26T12:00:00.000Z"]
    ]),
    policy,
    now
  });

  assert.equal(assessment.decision, "manual_review");
  assert.equal(assessment.estimatedOrderValue, null);
  assert.ok(assessment.blockers.includes("stale_inventory_count"));
  assert.ok(assessment.blockers.includes("quantity_variance"));
  assert.ok(assessment.blockers.includes("missing_unit_cost"));
  assert.ok(assessment.blockers.includes("insufficient_history"));
});

test("tenant, supplier, unit, duplicate, line, and total limits fail closed", () => {
  const expensiveItem = inventory("avocado", { estimated_unit_cost: 20 });
  const assessment = assessOrderAutomation({
    restaurantId,
    supplierId,
    supplierName,
    candidates: [
      recommendation("rec_avocado_1", "avocado", 20),
      recommendation("rec_avocado_2", "avocado", 20, {
        restaurant_id: "another_restaurant",
        supplier_id: "00000000-0000-4000-8000-000000000102",
        supplier_name: "Another Supplier",
        unit: "case"
      })
    ],
    inventoryItems: [expensiveItem],
    recommendationHistory: history("avocado", [20, 20, 20]),
    policy: {
      ...policy,
      maximumOrderValue: 500,
      maximumLineValue: 250
    },
    now
  });

  assert.equal(assessment.decision, "manual_review");
  assert.ok(assessment.blockers.includes("tenant_mismatch"));
  assert.ok(assessment.blockers.includes("supplier_mismatch"));
  assert.ok(assessment.blockers.includes("unit_mismatch"));
  assert.ok(assessment.blockers.includes("duplicate_inventory_item"));
  assert.ok(assessment.blockers.includes("line_value_limit"));
  assert.ok(assessment.blockers.includes("order_value_limit"));
});

test("automation is off by default and never performs an ordering side effect", () => {
  const assessment = assessOrderAutomation({
    restaurantId,
    supplierId,
    supplierName,
    candidates: [recommendation("rec_default", "tomatoes", 20)],
    inventoryItems: [inventory("tomatoes")],
    recommendationHistory: history("tomatoes", [20, 20, 20]),
    now
  });

  assert.equal(assessment.decision, "manual_review");
  assert.ok(assessment.blockers.includes("automation_disabled"));
});

test("automation blocks when no verified count evidence exists, whatever last_updated says", () => {
  const base = {
    restaurantId,
    supplierId,
    supplierName,
    candidates: [recommendation("rec_kale", "kale", 12)],
    recommendationHistory: history("kale", [11, 12, 12]),
    policy,
    delivery: {
      emailConnected: true,
      supplierRecipientConfigured: true
    },
    now
  };

  // A freshly bumped `last_updated` is a policy/cost/supplier edit, not count evidence.
  const withoutEvidence = assessOrderAutomation({
    ...base,
    inventoryItems: [inventory("kale", { last_updated: now.toISOString() })]
  });
  assert.equal(withoutEvidence.decision, "manual_review");
  assert.ok(withoutEvidence.blockers.includes("stale_inventory_count"));

  const withEvidence = assessOrderAutomation({
    ...base,
    inventoryItems: [inventory("kale")],
    inventoryLedgerEvents: verifiedCounts([["kale", "2026-07-26T12:00:00.000Z"]])
  });
  assert.equal(withEvidence.decision, "automatic_draft");
  assert.deepEqual(withEvidence.blockers, []);
});

test("another restaurant's count evidence cannot make this restaurant's stock look fresh", () => {
  const assessment = assessOrderAutomation({
    restaurantId,
    supplierId,
    supplierName,
    candidates: [recommendation("rec_beets", "beets", 12)],
    inventoryItems: [inventory("beets")],
    recommendationHistory: history("beets", [11, 12, 12]),
    inventoryLedgerEvents: [
      {
        restaurantId: "rest_other_tenant",
        inventoryItemId: "beets",
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

  assert.equal(assessment.decision, "manual_review");
  assert.ok(assessment.blockers.includes("stale_inventory_count"));
});
