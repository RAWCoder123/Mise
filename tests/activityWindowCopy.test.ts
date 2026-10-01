import assert from "node:assert/strict";
import test from "node:test";

import {
  fromPosSyncCompleted,
  fromPurchaseRecommendationCreated,
  summarizeActivityWindow
} from "../services/domain/activityEvents";
import { presentActivityWindowSentence } from "../services/presentation/activityWindowCopy";
import type { PurchaseRecommendation } from "../types/mise";

const restaurantId = "rest_activity_window";
const supplierId = "10000000-0000-4000-8000-000000000099";

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec_window_1",
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

test("activity window sentence localizes structured counts without inventing work", () => {
  const events = [
    fromPurchaseRecommendationCreated(recommendation()),
    fromPosSyncCompleted({
      restaurantId,
      occurredAt: "2026-08-30T11:00:00.000Z",
      importId: "import_1",
      recordsProcessed: 12,
      provider: "square"
    })
  ];
  const summary = summarizeActivityWindow(events, "2026-08-30T07:00:00.000Z");

  assert.equal(summary.ordersPrepared, 1);
  assert.equal(summary.routineChecks, 1);
  assert.match(summary.sentence, /prepared 1 supplier order/);

  const english = presentActivityWindowSentence("en", summary, { sinceLabel: "7:00 AM" });
  assert.equal(
    english,
    "Since 7:00 AM, Mise prepared 1 supplier order and completed 1 routine check."
  );

  const spanish = presentActivityWindowSentence("es", summary, { sinceLabel: "7:00" });
  assert.match(spanish, /^Desde 7:00, Mise /);
  assert.match(spanish, /preparó 1 pedido de proveedor/);
  assert.match(spanish, /completó 1 revisión rutinaria/);
  assert.doesNotMatch(spanish, /prepared|completed|Since/);

  const chinese = presentActivityWindowSentence("zh-Hans", summary, { sinceLabel: "7:00" });
  assert.match(chinese, /^自 7:00 起，Mise /);
  assert.match(chinese, /准备了 1 份供应商订单/);
  assert.match(chinese, /完成了 1 项例行检查/);
  assert.doesNotMatch(chinese, /prepared|Since/);
});

test("activity window empty sentence localizes when no operator-facing work landed", () => {
  const summary = summarizeActivityWindow([], "2026-08-30T07:00:00.000Z");
  assert.equal(summary.forecastUpdates, 0);
  assert.match(summary.sentence, /recorded no operator-facing activity/);

  assert.equal(
    presentActivityWindowSentence("en", summary, { sinceLabel: "7:00 AM" }),
    "Since 7:00 AM, Mise recorded no operator-facing activity."
  );
  assert.equal(
    presentActivityWindowSentence("es", summary, { sinceLabel: "7:00" }),
    "Desde 7:00, Mise no registró actividad visible para el operador."
  );
  assert.equal(
    presentActivityWindowSentence("zh-Hans", summary, { sinceLabel: "7:00" }),
    "自 7:00 起，Mise 未记录面向运营者的活动。"
  );
});

test("activity window presentation falls back to earlier when since is unparsable", () => {
  const localized = presentActivityWindowSentence(
    "es",
    {
      since: "not-a-date",
      forecastUpdates: 2,
      ordersPrepared: 0,
      staffingRisks: 0,
      routineChecks: 0
    }
  );
  assert.match(localized, /^Desde antes, Mise /);
  assert.match(localized, /actualizó 2 pronósticos/);
});
