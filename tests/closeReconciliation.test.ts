import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCloseReconciliation,
  closeReconciliationInsights,
  mergeCloseReconciliationInsights
} from "../services/domain/closeReconciliation";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { OperationalInsight } from "../services/domain/operationalSignals";

const restaurantId = "rest-close";
const timeZone = "America/New_York";
const operatingDate = "2026-08-05";

function item(overrides: Partial<{
  id: string;
  item_name: string;
  unit: string;
  current_quantity: number;
  reorder_threshold: number;
}> = {}) {
  return {
    id: overrides.id ?? "item-chicken",
    restaurant_id: restaurantId,
    item_name: overrides.item_name ?? "Chicken thighs",
    unit: overrides.unit ?? "g",
    current_quantity: overrides.current_quantity ?? 5000,
    reorder_threshold: overrides.reorder_threshold ?? 1000
  };
}

function event(
  id: string,
  sequence: number,
  eventType: InventoryEvent["eventType"],
  quantity: number,
  overrides: Partial<InventoryEvent> = {}
): InventoryEvent {
  return {
    id,
    sequence,
    restaurantId,
    inventoryItemId: "item-chicken",
    eventType,
    quantity,
    canonicalUnit: "g",
    // 18:00 America/New_York on 2026-08-05
    effectiveAt: overrides.effectiveAt ?? "2026-08-05T22:00:00.000Z",
    recordedAt: overrides.recordedAt ?? "2026-08-05T22:00:01.000Z",
    actorUserId: "manager-1",
    source: "test",
    sourceReference: null,
    reasonCode: null,
    clientEventId: `client-${id}`,
    idempotencyKey: `inventory-${id}`,
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

test("labels a close without waste or counts as incomplete instead of inventing a clean day", () => {
  const summary = buildCloseReconciliation({
    restaurantId,
    operatingDate,
    restaurantTimeZone: timeZone,
    inventoryItems: [item()],
    inventoryEvents: [],
    generatedAt: "2026-08-05T23:00:00.000Z"
  });
  assert.equal(summary.status, "incomplete");
  assert.equal(summary.wasteEventCount, 0);
  assert.ok(summary.unavailableSignals.includes("operating-day waste records"));
  assert.ok(summary.unavailableSignals.includes("operating-day physical counts"));
  assert.ok(summary.findings.some((finding) => finding.category === "data_quality"));
});

test("surfaces waste evidence and material count variance for the operating day", () => {
  const summary = buildCloseReconciliation({
    restaurantId,
    operatingDate,
    restaurantTimeZone: timeZone,
    inventoryItems: [item()],
    inventoryEvents: [
      event("baseline", 1, "count", 2000, {
        effectiveAt: "2026-08-05T12:00:00.000Z",
        recordedAt: "2026-08-05T12:00:01.000Z"
      }),
      event("usage", 2, "usage", 500, {
        effectiveAt: "2026-08-05T16:00:00.000Z",
        recordedAt: "2026-08-05T16:00:01.000Z"
      }),
      event("waste-1", 3, "waste", 400, {
        effectiveAt: "2026-08-05T20:00:00.000Z",
        recordedAt: "2026-08-05T20:00:01.000Z"
      }),
      // Projection expects ~1100 after usage/waste; observed 500 → material variance.
      event("close-count", 4, "count", 500, {
        effectiveAt: "2026-08-05T22:30:00.000Z",
        recordedAt: "2026-08-05T22:30:01.000Z"
      })
    ],
    generatedAt: "2026-08-05T23:00:00.000Z"
  });

  assert.equal(summary.status, "urgent");
  assert.equal(summary.wasteEventCount, 1);
  assert.equal(summary.materialVarianceCount, 1);
  assert.ok(summary.findings.some((finding) => finding.category === "waste"));
  assert.ok(summary.findings.some((finding) => finding.category === "variance"));
});

test("carries critical stock risk into close findings without fabricating quantities", () => {
  const summary = buildCloseReconciliation({
    restaurantId,
    operatingDate,
    restaurantTimeZone: timeZone,
    inventoryItems: [
      item({ current_quantity: 200, reorder_threshold: 1000 }),
      item({
        id: "item-lettuce",
        item_name: "Romaine",
        unit: "each",
        current_quantity: 40,
        reorder_threshold: 80
      })
    ],
    inventoryEvents: [event("waste-1", 1, "waste", 100)],
    stockRiskItemIds: ["item-lettuce"],
    generatedAt: "2026-08-05T23:00:00.000Z"
  });

  assert.equal(summary.status, "urgent");
  assert.ok(summary.criticalStockCount >= 2);
  const stock = summary.findings.find((finding) => finding.category === "stockout");
  assert.ok(stock);
  assert.match(stock!.explanation, /Romaine|Chicken/);
});

test("rejects cross-tenant evidence", () => {
  assert.throws(
    () =>
      buildCloseReconciliation({
        restaurantId,
        operatingDate,
        restaurantTimeZone: timeZone,
        inventoryItems: [item()],
        inventoryEvents: [event("x", 1, "waste", 1, { restaurantId: "other" })]
      }),
    /cross-restaurant inventory event/
  );
});

test("close insights merge ahead of planning insights without exceeding the cap", () => {
  const summary = buildCloseReconciliation({
    restaurantId,
    operatingDate,
    restaurantTimeZone: timeZone,
    inventoryItems: [item({ current_quantity: 100, reorder_threshold: 500 })],
    inventoryEvents: [event("waste-1", 1, "waste", 50)],
    generatedAt: "2026-08-05T23:00:00.000Z"
  });
  const closeInsights = closeReconciliationInsights(summary);
  assert.ok(closeInsights.length > 0);
  assert.equal(closeInsights[0]?.presentation.code, "insight.evidence.opaque");

  const planning: OperationalInsight[] = Array.from({ length: 8 }, (_, index) => ({
    id: `insight_plan_${index}`,
    restaurant_id: restaurantId,
    insight_type: "sales",
    title: `Plan ${index}`,
    description: "Planning insight",
    why_it_matters: null,
    recommended_action: "Review",
    severity: "info",
    created_at: "2026-08-05T22:00:00.000Z",
    presentation: {
      code: "insight.rule.sales.demand_rising",
      values: { itemName: `Item ${index}`, liftPercent: 20 }
    }
  }));

  const merged = mergeCloseReconciliationInsights(planning, closeInsights, 8);
  assert.equal(merged.length, 8);
  assert.ok(merged[0]?.id.startsWith("insight_close-"));
});
