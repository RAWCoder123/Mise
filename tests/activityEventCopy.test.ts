import assert from "node:assert/strict";
import test from "node:test";

import {
  fromInventoryCountRecorded,
  fromInventoryReceipt,
  fromInventoryRiskSignal,
  fromInventoryWasteRecorded,
  fromPosSyncCompleted,
  fromPurchaseRecommendationApproved,
  fromPurchaseRecommendationCreated,
  fromPurchaseRecommendationDismissed,
  fromRecalculationRunActivity,
  fromSupplierOrderDrafted,
  fromSupplierOrderSent,
  type ActivityEvent
} from "../services/domain/activityEvents";
import {
  presentActivitySummary,
  presentActivityTitle
} from "../services/presentation/activityEventCopy";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";

const restaurantId = "rest_activity_copy";
const supplierId = "10000000-0000-4000-8000-000000000099";

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec_copy_1",
    restaurant_id: restaurantId,
    inventory_item_id: "inv_chicken",
    item_name: "Chicken thighs",
    supplier_id: supplierId,
    supplier_name: "Metro Produce",
    recommended_quantity: 18,
    unit: "lb",
    reason: "Lunch usage was above forecast.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-08-30T12:14:00.000Z",
    ...overrides
  };
}

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order_copy_1",
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: "Metro Produce",
    order_message: "Please deliver chicken thighs.",
    operator_note: null,
    status: "draft",
    delivery_date: "2026-08-31",
    created_at: "2026-08-30T12:20:00.000Z",
    ...overrides
  };
}

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inv_chicken",
    restaurant_id: restaurantId,
    item_name: "Chicken thighs",
    category: "Protein",
    unit: "lb",
    current_quantity: 15.7,
    par_level: 40,
    reorder_threshold: 18,
    estimated_unit_cost: 3.5,
    supplier_id: supplierId,
    supplier_name: "Metro Produce",
    last_updated: "2026-08-30T11:00:00.000Z",
    ...overrides
  };
}

test("purchase and order activity copy localizes in ES without translating business names", () => {
  const approval = fromPurchaseRecommendationCreated(recommendation());
  assert.equal(presentActivityTitle("es", approval), "Aprobación requerida");
  assert.match(presentActivitySummary("es", approval), /Chicken thighs/);
  assert.match(presentActivitySummary("es", approval), /18/);
  assert.match(presentActivitySummary("es", approval), /aprobación/i);
  assert.doesNotMatch(presentActivitySummary("es", approval), /ready for approval/);

  const created = fromPurchaseRecommendationCreated(recommendation({ status: "approved" }));
  assert.equal(presentActivityTitle("es", created), "Recomendación creada");
  assert.match(presentActivitySummary("es", created), /Chicken thighs/);

  const approved = fromPurchaseRecommendationApproved(recommendation({ status: "approved" }));
  assert.equal(presentActivityTitle("zh-Hans", approved), "订单已批准");
  assert.match(presentActivitySummary("zh-Hans", approved), /Chicken thighs/);

  const dismissed = fromPurchaseRecommendationDismissed(recommendation());
  assert.equal(presentActivityTitle("es", dismissed), "Recomendación descartada");
  assert.match(presentActivitySummary("es", dismissed), /Chicken thighs/);

  const drafted = fromSupplierOrderDrafted(order(), { itemCount: 3 });
  assert.equal(presentActivityTitle("es", drafted), "Pedido preparado");
  assert.match(presentActivitySummary("es", drafted), /Metro Produce/);
  assert.match(presentActivitySummary("es", drafted), /3/);
  assert.doesNotMatch(presentActivitySummary("es", drafted), /draft prepared/);

  const sent = fromSupplierOrderSent(order());
  assert.equal(presentActivityTitle("zh-Hans", sent), "订单已发送");
  assert.match(presentActivitySummary("zh-Hans", sent), /Metro Produce/);
});

test("inventory, waste, POS, and risk activity copy localizes from metadata", () => {
  const counted = fromInventoryCountRecorded(item(), { occurredAt: "2026-08-30T13:00:00.000Z" });
  assert.equal(presentActivityTitle("es", counted), "Conteo de inventario registrado");
  assert.match(presentActivitySummary("es", counted), /Chicken thighs/);
  assert.match(presentActivitySummary("es", counted), /15[.,]7/);

  const delivery = fromInventoryReceipt(item(), {
    occurredAt: "2026-08-30T14:00:00.000Z",
    quantityReceived: 12
  });
  assert.equal(presentActivityTitle("zh-Hans", delivery), "已记录收货");
  assert.match(presentActivitySummary("zh-Hans", delivery), /Chicken thighs/);

  const waste = fromInventoryWasteRecorded(item(), {
    occurredAt: "2026-08-30T15:00:00.000Z",
    quantity: 2,
    canonicalUnit: "lb",
    repeatedRecently: true
  });
  assert.equal(presentActivityTitle("es", waste), "Patrón de merma necesita revisión");
  assert.match(presentActivitySummary("es", waste), /Chicken thighs/);
  assert.doesNotMatch(presentActivitySummary("es", waste), /recorded as waste/);

  const pos = fromPosSyncCompleted({
    restaurantId,
    occurredAt: "2026-08-30T16:00:00.000Z",
    importId: "import_1",
    recordsProcessed: 4,
    provider: "Square"
  });
  assert.equal(presentActivityTitle("es", pos), "Sincronización POS completada");
  assert.match(presentActivitySummary("es", pos), /Square/);
  assert.match(presentActivitySummary("es", pos), /4/);
  assert.doesNotMatch(presentActivitySummary("es", pos), /sale rows imported/);

  const risk = fromInventoryRiskSignal({
    restaurantId,
    item: item(),
    occurredAt: "2026-08-30T17:00:00.000Z",
    projectedQuantity: 3.5,
    reason: "English free-form risk reason that must not leak when metadata is present."
  });
  assert.equal(presentActivityTitle("es", risk), "Riesgo de inventario detectado");
  assert.match(presentActivitySummary("es", risk), /Chicken thighs/);
  assert.doesNotMatch(presentActivitySummary("es", risk), /free-form/);
});

test("recalculation activity distinguishes opening success from failure copy", () => {
  const success = fromRecalculationRunActivity({
    id: "run_ok",
    restaurantId,
    cycle: "daily_open",
    operatingDate: "2026-08-30",
    status: "succeeded",
    attempt: 1,
    maxAttempts: 3,
    jobName: "daily_open",
    monitoringOwner: "mise",
    completedAt: "2026-08-30T11:05:00.000Z",
    durationMs: 1200,
    timedOut: false,
    failureReason: null,
    cycleKey: "2026-08-30:daily_open"
  });
  assert.ok(success);
  assert.equal(presentActivityTitle("es", success!), "Recálculo de apertura completado");
  assert.match(presentActivitySummary("es", success!), /pronósticos/i);

  const failed = fromRecalculationRunActivity({
    id: "run_fail",
    restaurantId,
    cycle: "mid_shift",
    operatingDate: "2026-08-30",
    status: "failed",
    attempt: 2,
    maxAttempts: 3,
    jobName: "mid_shift",
    monitoringOwner: "mise",
    completedAt: "2026-08-30T15:05:00.000Z",
    durationMs: 800,
    timedOut: false,
    failureReason: "Provider timeout",
    cycleKey: "2026-08-30:mid_shift"
  });
  assert.ok(failed);
  assert.equal(presentActivityTitle("zh-Hans", failed!), "计划重算失败");
  assert.match(presentActivitySummary("zh-Hans", failed!), /班中/);
  assert.match(presentActivitySummary("zh-Hans", failed!), /Provider timeout/);
});

test("opaque finding titles stay durable while structured types still localize", () => {
  const opaque: ActivityEvent = {
    id: "activity_opaque",
    restaurantId,
    locationId: null,
    occurredAt: "2026-08-30T18:00:00.000Z",
    createdAt: "2026-08-30T18:00:00.000Z",
    activityType: "menu_item_performance_analyzed",
    category: "sales",
    title: "Salmon roll velocity dropped",
    summary: "Mapped POS velocity fell versus the trailing week.",
    triggerType: "operational_finding",
    triggerReference: "finding_1",
    evidenceReferences: [],
    sourceSystems: ["mise"],
    actionId: null,
    recommendationId: null,
    autonomyLevel: 2,
    confidence: 0.7,
    status: "waiting_for_approval",
    requiresAttention: true,
    attentionDeadline: null,
    relatedEntityType: "finding",
    relatedEntityId: "finding_1",
    parentActivityId: null,
    sequenceId: null,
    metadata: { category: "sales", severity: "watch" },
    errorCode: null,
    errorMessage: null,
    resolvedAt: null,
    resolvedBy: null
  };

  assert.equal(presentActivityTitle("es", opaque), "Salmon roll velocity dropped");
  assert.equal(
    presentActivitySummary("es", opaque),
    "Mapped POS velocity fell versus the trailing week."
  );

  const orderTitle = presentActivityTitle("es", fromSupplierOrderSent(order()));
  assert.equal(orderTitle, "Pedido enviado");
});
