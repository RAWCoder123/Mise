import assert from "node:assert/strict";
import test from "node:test";

import { fromPosSyncCompleted } from "../services/domain/activityEvents";
import { buildOperatingBrief } from "../services/domain/operatingBrief";
import type {
  InventoryItem,
  InventoryPrediction,
  PosSale,
  PurchaseRecommendation,
  Restaurant,
  SupplierOrder
} from "../types/mise";
import { blockedRecommendationEvidence } from "./recommendationFixtures";

const restaurantId = "rest_brief";

function restaurant(): Restaurant {
  return {
    id: restaurantId,
    name: "Harbor Table",
    address: null,
    cuisine_type: "American",
    brand_color: "#B42318",
    accent_color: "#B42318",
    logo_url: null,
    service_style: "full_service",
    timezone: "America/New_York",
    currency: "USD",
    operational_profile: {
      serviceStyle: "full_service",
      orderCadence: ["Tue", "Fri"],
      prepWindows: ["AM"],
      primarySuppliers: ["Metro Produce"],
      inventoryReviewDays: ["daily"],
      notes: null
    },
    created_at: "2026-01-01T00:00:00.000Z"
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
    supplier_name: "Metro Produce",
    last_updated: "2026-08-02T11:00:00.000Z",
    ...overrides
  };
}

function prediction(overrides: Partial<InventoryPrediction> = {}): InventoryPrediction {
  return {
    averageDailyUsage: 20,
    historySampleDays: 28,
    historySource: "restaurant_history",
    todayDepletion: 8,
    projectedQuantity: 7.7,
    projectedStatus: "Critical",
    daysCoverage: 0.4,
    coverageLabel: "Under 1 service day of coverage",
    demandTrend: "rising",
    trendLabel: "Rising",
    suggestedOrderQuantity: 18,
    suggestedAction: "Order 18 lb",
    urgency: "high",
    basis: "Mapped POS demand",
    depletionCopy: "Likely to run out during dinner",
    confidenceCopy: "Based on 28 service days",
    recommendationCopy: "Approve reorder before cutoff",
    whyItMatters: "Lunch usage was 24% above forecast.",
    ...overrides
  };
}

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec_1",
    restaurant_id: restaurantId,
    inventory_item_id: "inv_chicken",
    item_name: "Chicken thighs",
    supplier_name: "Metro Produce",
    recommended_quantity: 18,
    unit: "lb",
    reason: "Lunch usage was 24% above forecast.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    confidence: "blocked",
    source_evidence: blockedRecommendationEvidence("inv_chicken", "2026-08-02T12:14:00.000Z"),
    created_at: "2026-08-02T12:14:00.000Z",
    ...overrides
  };
}

test("operating brief builds approvals, monitoring, and truthful activity without fabrication", () => {
  const sales: PosSale[] = [
    {
      id: "sale_1",
      restaurant_id: restaurantId,
      sale_date: "2026-08-02",
      item_name: "General Tso Chicken",
      category: "Entree",
      quantity_sold: 24,
      gross_sales: 360,
      net_sales: 340,
      source_pos: "Square",
      created_at: "2026-08-02T12:00:00.000Z"
    }
  ];
  const orders: SupplierOrder[] = [
    {
      id: "order_1",
      restaurant_id: restaurantId,
      supplier_name: "Metro Produce",
      order_message: "Please deliver",
      operator_note: null,
      status: "sent",
      delivery_date: "2026-08-03",
      created_at: "2026-08-02T10:00:00.000Z"
    }
  ];
  const completedActivity = fromPosSyncCompleted({
    restaurantId,
    occurredAt: "2026-08-02T08:12:00.000Z",
    importId: "import_1",
    recordsProcessed: 620,
    provider: "Square"
  });

  const brief = buildOperatingBrief({
    restaurant: restaurant(),
    operatingDate: "2026-08-02",
    generatedAt: "2026-08-02T15:00:00.000Z",
    lastSeenAt: "2026-08-02T07:00:00.000Z",
    sales,
    inventoryItems: [item()],
    recommendations: [recommendation()],
    orders,
    insights: [],
    activityEvents: [completedActivity],
    inventoryOutlooks: [{ item: item(), prediction: prediction() }],
    demoLabeled: true
  });

  assert.equal(brief.restaurantId, restaurantId);
  assert.equal(brief.demoLabeled, true);
  assert.equal(brief.restaurantStatus.status, "at_risk");
  assert.ok(brief.needsApproval.length >= 1);
  assert.match(brief.needsApproval[0]!.title, /Chicken/);
  assert.ok(brief.liveActivity.some((event) => event.activityType === "approval_required"));
  assert.ok(brief.liveActivity.some((event) => event.activityType === "pos_sync_completed"));
  assert.ok(brief.sinceYouWereAway.some((event) => event.activityType === "pos_sync_completed"));
  assert.ok(brief.miseIsWatching.some((row) => /Chicken/.test(row.title)));
  assert.ok(brief.miseIsWatching.some((row) => /Metro Produce/.test(row.title)));
  assert.equal(brief.outlook.staffingCoverage, "unknown");
  assert.match(brief.outlook.staffingDetail, /schedule integration/);
  assert.ok(brief.activityWindowSummary);
  assert.match(brief.restaurantStatus.dataFreshness.label, /current|Incomplete|stale|freshness/i);
});

test("operating brief rejects cross-tenant rows", () => {
  assert.throws(() =>
    buildOperatingBrief({
      restaurant: restaurant(),
      operatingDate: "2026-08-02",
      sales: [],
      inventoryItems: [item({ restaurant_id: "other" })],
      recommendations: [],
      orders: [],
      insights: []
    })
  );
});

test("healthy restaurant with no approvals is on track", () => {
  const brief = buildOperatingBrief({
    restaurant: restaurant(),
    operatingDate: "2026-08-02",
    generatedAt: "2026-08-02T15:00:00.000Z",
    sales: [
      {
        id: "sale_1",
        restaurant_id: restaurantId,
        sale_date: "2026-08-02",
        item_name: "Burger",
        category: "Entree",
        quantity_sold: 10,
        gross_sales: 120,
        net_sales: 110,
        source_pos: "Square",
        created_at: "2026-08-02T14:00:00.000Z"
      }
    ],
    inventoryItems: [item({ current_quantity: 40, last_updated: "2026-08-02T14:00:00.000Z" })],
    recommendations: [],
    orders: [],
    insights: [],
    inventoryOutlooks: [
      {
        item: item({ current_quantity: 40 }),
        prediction: prediction({
          projectedQuantity: 30,
          projectedStatus: "Good",
          daysCoverage: 3,
          whyItMatters: "Coverage is stable."
        })
      }
    ]
  });

  assert.equal(brief.restaurantStatus.status, "on_track");
  assert.equal(brief.needsApproval.length, 0);
});
