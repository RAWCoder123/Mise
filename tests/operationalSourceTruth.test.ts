import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryEvent } from "../services/domain/inventoryLedger";
import {
  calculateOperationalSignals,
  latestVerifiedCountEvidence,
  recommendationEvidenceIsCurrent,
  type OperationalPlanningSnapshot
} from "../services/domain/operationalSignals";

const restaurantId = "10000000-0000-4000-8000-000000000001";
const inventoryItemId = "10000000-0000-4000-8000-000000000101";
const locationId = "10000000-0000-4000-8000-000000000201";
const generatedAt = "2026-08-15T16:00:00.000Z";

function inventoryEvent(
  id: string,
  sequence: number,
  eventType: InventoryEvent["eventType"],
  quantity: number,
  effectiveAt: string,
  overrides: Partial<InventoryEvent> = {}
): InventoryEvent {
  return {
    id,
    sequence,
    restaurantId,
    inventoryItemId,
    eventType,
    quantity,
    canonicalUnit: "g",
    effectiveAt,
    recordedAt: effectiveAt,
    actorUserId: "10000000-0000-4000-8000-000000000301",
    source: "test",
    sourceReference: null,
    reasonCode: null,
    clientEventId: `client-${id}`,
    idempotencyKey: `event-${id}`,
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

function baseSnapshot(overrides: Partial<OperationalPlanningSnapshot> = {}): OperationalPlanningSnapshot {
  return {
    restaurantId,
    operatingDate: "2026-08-15",
    inventoryItems: [{
      id: inventoryItemId,
      restaurant_id: restaurantId,
      item_name: "Tomatoes",
      supplier_name: "Produce Co.",
      unit: "lb",
      current_quantity: 99,
      par_level: 20,
      reorder_threshold: 12,
      last_updated: generatedAt
    }],
    sales: [],
    menuItemIngredients: [{
      restaurant_id: restaurantId,
      menu_item_name: "Tomato Bowl",
      inventory_item_id: inventoryItemId,
      quantity_used_per_sale: 1,
      unit: "lb"
    }],
    recommendationHistory: [],
    inventoryEvents: [
      inventoryEvent("10000000-0000-4000-8000-000000000401", 1, "count", 10 * 453.59237, "2026-08-15T12:00:00.000Z")
    ],
    planningMode: "manual_csv",
    planningRevision: 7,
    generatedAt,
    correlationId: "10000000-0000-4000-8000-000000000501",
    ...overrides
  };
}

test("count freshness comes only from the latest non-superseded physical count", () => {
  const staleCount = inventoryEvent(
    "10000000-0000-4000-8000-000000000411",
    1,
    "count",
    10 * 453.59237,
    "2026-08-12T12:00:00.000Z"
  );
  const recentReceipt = inventoryEvent(
    "10000000-0000-4000-8000-000000000412",
    2,
    "receipt",
    5 * 453.59237,
    "2026-08-15T15:55:00.000Z"
  );
  const signals = calculateOperationalSignals(baseSnapshot({
    inventoryEvents: [staleCount, recentReceipt]
  }));

  assert.equal(signals.recommendations.length, 0);
  assert.match(signals.insights[0]?.description ?? "", /older than 36 hours/i);
});

test("only post-count sales reduce the verified baseline", () => {
  const sales = [
    {
      restaurant_id: restaurantId,
      sale_date: "2026-08-15",
      item_name: "Tomato Bowl",
      quantity_sold: 100,
      occurred_at: "2026-08-15T11:59:59.000Z"
    },
    {
      restaurant_id: restaurantId,
      sale_date: "2026-08-15",
      item_name: "Tomato Bowl",
      quantity_sold: 2,
      occurred_at: "2026-08-15T12:30:00.000Z"
    },
    {
      restaurant_id: restaurantId,
      sale_date: "2026-08-16",
      item_name: "Tomato Bowl",
      quantity_sold: 100,
      occurred_at: "2026-08-16T12:30:00.000Z"
    }
  ];
  const signals = calculateOperationalSignals(baseSnapshot({ sales }));

  assert.equal(signals.recommendations[0]?.recommended_quantity, 12);
  assert.match(signals.insights[0]?.description ?? "", /projected at 8 lb/i);
  assert.equal(signals.recommendations[0]?.source_evidence.salesThrough, "2026-08-15T12:30:00.000Z");
});

test("superseded counts cannot remain the recommendation baseline", () => {
  const original = inventoryEvent(
    "10000000-0000-4000-8000-000000000421",
    1,
    "count",
    5 * 453.59237,
    "2026-08-15T12:00:00.000Z"
  );
  const replacement = inventoryEvent(
    "10000000-0000-4000-8000-000000000422",
    2,
    "count",
    15 * 453.59237,
    "2026-08-15T12:00:00.000Z",
    { supersedesEventId: original.id }
  );

  assert.equal(
    latestVerifiedCountEvidence(restaurantId, inventoryItemId, [original, replacement])?.countEventId,
    replacement.id
  );
  assert.equal(
    calculateOperationalSignals(baseSnapshot({ inventoryEvents: [original, replacement] })).recommendations.length,
    0
  );
});

test("live Square planning requires selected-location provider identity and a verified recipe chain", () => {
  const completeSale = {
    restaurant_id: restaurantId,
    sale_date: "2026-08-15",
    item_name: "Tomato Bowl",
    quantity_sold: 4,
    source_pos: "Square",
    occurred_at: "2026-08-15T13:00:00.000Z",
    pos_location_id: locationId,
    external_catalog_item_id: "catalog-tomato-bowl",
    external_variation_id: "variation-regular"
  };
  const verifiedRecipeMappings = [{
    restaurant_id: restaurantId,
    pos_location_id: locationId,
    catalog_mapping_id: "10000000-0000-4000-8000-000000000601",
    recipe_version_id: "10000000-0000-4000-8000-000000000701",
    external_catalog_item_id: "catalog-tomato-bowl",
    external_variation_id: "variation-regular",
    inventory_item_id: inventoryItemId,
    quantity_used_per_sale: 1,
    unit: "lb"
  }];
  const live = baseSnapshot({
    planningMode: "square_live",
    selectedPosLocationId: locationId,
    verifiedRecipeMappings,
    sales: [
      { ...completeSale, quantity_sold: 100, external_variation_id: null },
      { ...completeSale, quantity_sold: 100, pos_location_id: "other-location" },
      completeSale
    ]
  });
  const signals = calculateOperationalSignals(live);
  const recommendation = signals.recommendations[0];

  assert.equal(recommendation?.recommended_quantity, 14);
  assert.equal(recommendation?.confidence, "medium");
  assert.deepEqual(recommendation?.source_evidence.mappingIds, [verifiedRecipeMappings[0]!.catalog_mapping_id]);
  assert.deepEqual(recommendation?.source_evidence.recipeVersionIds, [verifiedRecipeMappings[0]!.recipe_version_id]);
  assert.equal(recommendation?.source_evidence.posLocationId, locationId);
});

test("recommendation evidence fails closed after a newer count or planning revision", () => {
  const snapshot = baseSnapshot();
  const recommendation = calculateOperationalSignals(snapshot).recommendations[0]!;
  assert.equal(
    recommendationEvidenceIsCurrent({
      restaurantId,
      inventoryItemId,
      evidence: recommendation.source_evidence,
      inventoryEvents: snapshot.inventoryEvents!,
      now: generatedAt,
      planningRevision: 7
    }),
    true
  );

  const newerCount = inventoryEvent(
    "10000000-0000-4000-8000-000000000431",
    2,
    "count",
    9 * 453.59237,
    "2026-08-15T15:00:00.000Z"
  );
  assert.equal(
    recommendationEvidenceIsCurrent({
      restaurantId,
      inventoryItemId,
      evidence: recommendation.source_evidence,
      inventoryEvents: [...snapshot.inventoryEvents!, newerCount],
      now: generatedAt,
      planningRevision: 7
    }),
    false
  );
  assert.equal(
    recommendationEvidenceIsCurrent({
      restaurantId,
      inventoryItemId,
      evidence: recommendation.source_evidence,
      inventoryEvents: snapshot.inventoryEvents!,
      now: generatedAt,
      planningRevision: 8
    }),
    false
  );
});
