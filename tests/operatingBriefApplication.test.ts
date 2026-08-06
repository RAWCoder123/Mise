import assert from "node:assert/strict";
import test from "node:test";

import { seedDemoActivityFromState } from "../services/demo/demoActivity";
import { createInitialDemoState, DEMO_RESTAURANT_ID } from "../services/demoData";
import { buildInventoryOutlooks } from "../services/domain/miseDomain";
import { buildOperatingBrief } from "../services/domain/operatingBrief";
import { demandFallbackForRestaurant } from "../services/demoData";

test("seeded demo state produces an operating brief with real activity and approvals", () => {
  const state = createInitialDemoState("Toast", undefined, new Date("2026-08-02T15:00:00.000Z"));
  seedDemoActivityFromState(state);

  const restaurant = state.restaurants[0]!;
  assert.equal(restaurant.id, DEMO_RESTAURANT_ID);

  const outlooks = buildInventoryOutlooks(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    "2026-08-02",
    demandFallbackForRestaurant(DEMO_RESTAURANT_ID)
  );

  const brief = buildOperatingBrief({
    restaurant,
    operatingDate: "2026-08-02",
    generatedAt: "2026-08-02T15:00:00.000Z",
    sales: state.posSales,
    inventoryItems: state.inventoryItems,
    recommendations: state.purchaseRecommendations,
    orders: state.supplierOrders,
    insights: state.insights,
    activityEvents: state.activityEvents,
    inventoryOutlooks: outlooks,
    demoLabeled: true
  });

  assert.equal(brief.restaurantId, DEMO_RESTAURANT_ID);
  assert.equal(brief.demoLabeled, true);
  assert.ok(brief.liveActivity.length >= 1);
  assert.ok(brief.restaurantStatus.summary.length > 0);
  assert.ok(["on_track", "attention_needed", "at_risk"].includes(brief.restaurantStatus.status));
});
