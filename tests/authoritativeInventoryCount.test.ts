import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COUNT_BOUNDARY_RULE,
  COUNT_CLOCK_SKEW_TOLERANCE_MS,
  COUNT_VALIDITY_RULE,
  buildInventoryCountEvidence,
  dayResolutionConsumptionIsAfterCount,
  isStrictlyAfterCount,
  isTemporallyValidCount,
  missingInventoryCountEvidence,
  projectionContaminated,
  projectAuthoritativeOnHand,
  resolveVerifiedInventoryCount,
  verifiedCountSupersedes,
  withPendingCountEvidence,
  type AuthoritativeConsumptionEntry,
  type InventoryCountEvidence,
  type VerifiedCountCandidate
} from "../services/domain/inventoryCountAuthority";
import {
  acceptInventoryEvent,
  projectInventoryEvents,
  type InventoryEvent
} from "../services/domain/inventoryLedger";
import {
  buildInventoryOutlooks,
  buildInventoryPrediction,
  shouldSuppressRecommendationForItem
} from "../services/domain/miseDomain";
import { assessOrderAutomation } from "../services/domain/orderAutomation";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import type { InventoryItem, MenuItemIngredient, PosSale, PurchaseRecommendation } from "../types/mise";

const restaurantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const restaurantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "item-chicken";
const freshFoodsSupplierId = "11111111-1111-4111-8111-111111111111";
const differentSupplierId = "22222222-2222-4222-8222-222222222222";
const operatingDate = "2026-08-17";
/** Shared evaluation instant, so validity and freshness do not depend on wall clock. */
const evaluatedAt = "2026-08-17T23:00:00.000Z";

/** A clearly future instant, relative to whenever this suite runs. */
function futureIso(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** One canonical gram per native unit keeps ledger and native quantities directly comparable. */
const CANONICAL_PER_UNIT = 1;

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: itemId,
    restaurant_id: restaurantA,
    item_name: "Chicken breast",
    category: "Protein",
    unit: "lb",
    current_quantity: 20,
    par_level: 40,
    reorder_threshold: 10,
    estimated_unit_cost: 4,
    supplier_id: freshFoodsSupplierId,
    supplier_name: "Fresh Foods",
    // Deliberately far newer than any count: a policy/cost edit must never read as a count.
    last_updated: "2026-08-17T23:59:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: CANONICAL_PER_UNIT,
    canonical_unit_verification_status: "verified",
    canonical_unit_verified_at: "2026-08-01T12:00:00.000Z",
    canonical_unit_verified_by: "owner-a",
    ...overrides
  };
}

function ledgerEvent(overrides: Partial<InventoryEvent> & Pick<InventoryEvent, "sequence" | "eventType" | "quantity" | "effectiveAt">): InventoryEvent {
  return {
    id: `event-${overrides.sequence}`,
    restaurantId: restaurantA,
    inventoryItemId: itemId,
    canonicalUnit: "g",
    recordedAt: overrides.effectiveAt,
    actorUserId: "owner-a",
    source: "test",
    sourceReference: null,
    reasonCode: null,
    clientEventId: `client-${overrides.sequence}`,
    idempotencyKey: `idem-${overrides.sequence}`,
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

function evidenceFor(
  events: readonly VerifiedCountCandidate[],
  options: { restaurantId?: string; generatedAt?: string; item?: InventoryItem } = {}
): InventoryCountEvidence {
  const restaurantId = options.restaurantId ?? restaurantA;
  const scopedItem = options.item ?? item({ restaurant_id: restaurantId });
  const map = buildInventoryCountEvidence({
    restaurantId,
    items: [scopedItem],
    ledgerEvents: events,
    generatedAt: options.generatedAt ?? evaluatedAt
  });
  return map.get(scopedItem.id) ?? missingInventoryCountEvidence(restaurantId, scopedItem.id);
}

function countEvent(
  effectiveAt: string,
  quantity: number,
  overrides: Partial<VerifiedCountCandidate> = {}
): VerifiedCountCandidate {
  return {
    id: `count-${effectiveAt}`,
    restaurantId: restaurantA,
    inventoryItemId: itemId,
    eventType: "count",
    effectiveAt,
    quantity,
    sequence: 1,
    ...overrides
  };
}

function consumption(
  occurredAt: string,
  quantity: number,
  overrides: Partial<AuthoritativeConsumptionEntry> = {}
): AuthoritativeConsumptionEntry {
  return {
    restaurantId: restaurantA,
    inventoryItemId: itemId,
    quantity,
    resolution: "instant",
    occurredAt,
    ...overrides
  };
}

/** Reads the projected on-hand a low-stock signal presents. */
function lowStockProjectedQuantity(
  insights: ReturnType<typeof calculateOperationalSignals>["insights"]
) {
  const presentation = insights.find((insight) => insight.id === `insight_low_${itemId}`)?.presentation;
  if (!presentation || presentation.code !== "insight.rule.inventory.stock_risk") return null;
  return presentation.values.projectedQuantity;
}

function project(input: {
  evidence: InventoryCountEvidence;
  movements?: Parameters<typeof projectAuthoritativeOnHand>[0]["movements"];
  consumption?: readonly AuthoritativeConsumptionEntry[];
  restaurantId?: string;
  asOf?: string;
}) {
  return projectAuthoritativeOnHand({
    restaurantId: input.restaurantId ?? restaurantA,
    inventoryItemId: itemId,
    evidence: input.evidence,
    movements: input.movements,
    consumption: input.consumption,
    asOf: input.asOf ?? evaluatedAt
  });
}

// A: opening count
test("an opening count establishes the baseline and later consumption depletes it once", () => {
  const evidence = evidenceFor([countEvent("2026-08-17T08:00:00.000Z", 20)]);
  const projection = project({
    evidence,
    consumption: [consumption("2026-08-17T09:00:00.000Z", 4)]
  });

  assert.equal(projection.evidence, "verified_count");
  assert.equal(projection.baselineQuantity, 20);
  assert.equal(projection.appliedConsumption, 4);
  assert.equal(projection.projectedQuantity, 16);
  assert.equal(projection.unattributedConsumption, 0);
  assert.equal(projection.isTemporallyAuthoritative, true);
});

// B: midday count
test("a midday count is not reduced again by consumption that happened before it", () => {
  const evidence = evidenceFor([countEvent("2026-08-17T13:00:00.000Z", 10)]);
  const morningOnly = project({
    evidence,
    consumption: [
      consumption("2026-08-17T09:00:00.000Z", 4),
      consumption("2026-08-17T11:30:00.000Z", 3)
    ]
  });

  assert.equal(morningOnly.baselineQuantity, 10);
  assert.equal(morningOnly.appliedConsumption, 0);
  assert.equal(morningOnly.projectedQuantity, 10);

  const withDinner = project({
    evidence,
    consumption: [
      consumption("2026-08-17T09:00:00.000Z", 4),
      consumption("2026-08-17T11:30:00.000Z", 3),
      consumption("2026-08-17T18:30:00.000Z", 2)
    ]
  });

  assert.equal(withDinner.appliedConsumption, 2);
  assert.equal(withDinner.projectedQuantity, 8);
});

test("day-resolution POS sales cannot deplete a count taken inside the same operating day", () => {
  const evidence = evidenceFor([countEvent("2026-08-17T13:00:00.000Z", 10)]);
  const sameDay = project({
    evidence,
    consumption: [
      { restaurantId: restaurantA, inventoryItemId: itemId, quantity: 6, resolution: "operating_day", operatingDate }
    ]
  });

  assert.equal(sameDay.appliedConsumption, 0);
  assert.equal(sameDay.unattributedConsumption, 6);
  assert.equal(sameDay.projectedQuantity, 10);
  // Mise reports reduced authority instead of fabricating intra-day precision.
  assert.equal(sameDay.isTemporallyAuthoritative, false);

  const nextDay = project({
    evidence,
    consumption: [
      { restaurantId: restaurantA, inventoryItemId: itemId, quantity: 6, resolution: "operating_day", operatingDate: "2026-08-18" }
    ]
  });

  assert.equal(nextDay.appliedConsumption, 6);
  assert.equal(nextDay.unattributedConsumption, 0);
  assert.equal(nextDay.projectedQuantity, 4);
  assert.equal(nextDay.isTemporallyAuthoritative, true);
});

// C: non-count update
test("a policy, cost, or supplier edit never makes a stale count look fresh", () => {
  const staleCount = countEvent("2026-08-10T08:00:00.000Z", 20);
  const edited = item({
    last_updated: "2026-08-17T17:59:00.000Z",
    estimated_unit_cost: 9.5,
    par_level: 60,
    supplier_id: differentSupplierId,
    supplier_name: "Different Supplier"
  });
  const evidence = evidenceFor([staleCount], { item: edited });

  assert.equal(evidence.status, "verified");
  assert.equal(evidence.countedAt, "2026-08-10T08:00:00.000Z");
  assert.equal(evidence.freshness, "stale");
  assert.ok((evidence.countAgeHours ?? 0) > 36);

  const withoutAnyCount = evidenceFor([], { item: edited });
  assert.equal(withoutAnyCount.status, "missing");
  assert.equal(withoutAnyCount.freshness, "unverified");
  assert.equal(withoutAnyCount.countedAt, null);
  // Fail closed: no verified count means no projected quantity at all.
  const projection = project({ evidence: withoutAnyCount });
  assert.equal(projection.evidence, "no_verified_count");
  assert.equal(projection.projectedQuantity, null);
  assert.equal(projection.isTemporallyAuthoritative, false);
});

// D: receipt after the count
test("a receipt after the count increases projected inventory exactly once", () => {
  const evidence = evidenceFor([countEvent("2026-08-17T08:00:00.000Z", 20)]);
  const projection = project({
    evidence,
    movements: [
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-17T10:00:00.000Z", quantityDelta: 12 },
      // A receipt before the count is already inside the counted quantity.
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-17T07:00:00.000Z", quantityDelta: 50 }
    ],
    consumption: [consumption("2026-08-17T11:00:00.000Z", 4)]
  });

  assert.equal(projection.appliedAdditions, 12);
  assert.equal(projection.projectedQuantity, 28);

  // The append-only ledger projection agrees: count 20, then a 12 unit receipt.
  const ledger = projectInventoryEvents(restaurantA, itemId, [
    ledgerEvent({ sequence: 1, eventType: "receipt", quantity: 50, effectiveAt: "2026-08-17T07:00:00.000Z" }),
    ledgerEvent({ sequence: 2, eventType: "count", quantity: 20, effectiveAt: "2026-08-17T08:00:00.000Z" }),
    ledgerEvent({ sequence: 3, eventType: "receipt", quantity: 12, effectiveAt: "2026-08-17T10:00:00.000Z" })
  ]);
  assert.equal(ledger.quantity / CANONICAL_PER_UNIT, 32);
  assert.equal(ledger.quantity / CANONICAL_PER_UNIT - projection.appliedConsumption, 28);
});

// E: superseding count
test("a newer verified count supersedes the previous baseline without double-applying history", () => {
  const events = [
    countEvent("2026-08-16T08:00:00.000Z", 30, { id: "count-morning", sequence: 1 }),
    countEvent("2026-08-17T08:00:00.000Z", 12, { id: "count-today", sequence: 4 })
  ];
  const resolved = resolveVerifiedInventoryCount(restaurantA, itemId, events, CANONICAL_PER_UNIT);
  assert.equal(resolved?.countedAt, "2026-08-17T08:00:00.000Z");
  assert.equal(resolved?.countedQuantity, 12);

  const projection = project({
    evidence: evidenceFor(events),
    movements: [
      // Receipt and waste that the newer count already observed.
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-16T14:00:00.000Z", quantityDelta: 25 },
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-17T07:00:00.000Z", quantityDelta: -3 },
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-17T09:00:00.000Z", quantityDelta: 5 }
    ],
    consumption: [
      consumption("2026-08-16T19:00:00.000Z", 9),
      consumption("2026-08-17T12:00:00.000Z", 2)
    ]
  });

  assert.equal(projection.baselineQuantity, 12);
  assert.equal(projection.appliedAdditions, 5);
  assert.equal(projection.appliedLedgerReductions, 0);
  assert.equal(projection.appliedConsumption, 2);
  assert.equal(projection.projectedQuantity, 15);

  // The ledger projection reaches the same post-count position independently.
  const ledger = projectInventoryEvents(restaurantA, itemId, [
    ledgerEvent({ sequence: 1, eventType: "count", quantity: 30, effectiveAt: "2026-08-16T08:00:00.000Z" }),
    ledgerEvent({ sequence: 2, eventType: "receipt", quantity: 25, effectiveAt: "2026-08-16T14:00:00.000Z" }),
    ledgerEvent({ sequence: 3, eventType: "waste", quantity: 3, effectiveAt: "2026-08-17T07:00:00.000Z" }),
    ledgerEvent({ sequence: 4, eventType: "count", quantity: 12, effectiveAt: "2026-08-17T08:00:00.000Z" }),
    ledgerEvent({ sequence: 5, eventType: "receipt", quantity: 5, effectiveAt: "2026-08-17T09:00:00.000Z" })
  ]);
  assert.equal(ledger.quantity / CANONICAL_PER_UNIT, 17);
  assert.equal(ledger.quantity / CANONICAL_PER_UNIT - projection.appliedConsumption, 15);
});

// F: tenant isolation
test("another restaurant's inventory evidence cannot influence this restaurant", () => {
  const foreignCount = countEvent("2026-08-17T08:00:00.000Z", 500, {
    id: "count-foreign",
    restaurantId: restaurantB
  });

  assert.equal(resolveVerifiedInventoryCount(restaurantA, itemId, [foreignCount], CANONICAL_PER_UNIT), null);
  const evidence = evidenceFor([foreignCount]);
  assert.equal(evidence.status, "missing");

  const scopedEvidence = evidenceFor([countEvent("2026-08-17T08:00:00.000Z", 20)]);
  const projection = project({
    evidence: scopedEvidence,
    movements: [
      { restaurantId: restaurantB, inventoryItemId: itemId, effectiveAt: "2026-08-17T10:00:00.000Z", quantityDelta: 900 }
    ],
    consumption: [
      { ...consumption("2026-08-17T11:00:00.000Z", 19), restaurantId: restaurantB }
    ]
  });
  assert.equal(projection.appliedAdditions, 0);
  assert.equal(projection.appliedConsumption, 0);
  assert.equal(projection.projectedQuantity, 20);

  // Restaurant B keeps its own evidence.
  const foreignEvidence = evidenceFor([foreignCount], { restaurantId: restaurantB });
  assert.equal(foreignEvidence.status, "verified");
  assert.equal(foreignEvidence.restaurantId, restaurantB);
});

// G: temporal boundary
test("evidence exactly at the count instant is inside the baseline and never applied twice", () => {
  assert.equal(COUNT_BOUNDARY_RULE, "count_instant_included_in_baseline");

  const countedAt = "2026-08-17T13:00:00.000Z";
  const evidence = evidenceFor([countEvent(countedAt, 10)]);

  assert.equal(isStrictlyAfterCount(countedAt, countedAt), false);
  assert.equal(isStrictlyAfterCount(countedAt, "2026-08-17T13:00:00.001Z"), true);
  assert.equal(isStrictlyAfterCount(countedAt, "2026-08-17T12:59:59.999Z"), false);
  assert.equal(isStrictlyAfterCount(null, countedAt), false);
  assert.equal(isStrictlyAfterCount(countedAt, "not-a-timestamp"), false);

  const atBoundary = project({ evidence, consumption: [consumption(countedAt, 5)] });
  assert.equal(atBoundary.appliedConsumption, 0);
  assert.equal(atBoundary.projectedQuantity, 10);

  const oneMillisecondLater = project({
    evidence,
    consumption: [consumption("2026-08-17T13:00:00.000Z", 5), consumption("2026-08-17T13:00:00.001Z", 5)]
  });
  assert.equal(oneMillisecondLater.appliedConsumption, 5);
  assert.equal(oneMillisecondLater.projectedQuantity, 5);

  const movementAtBoundary = project({
    evidence,
    movements: [
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: countedAt, quantityDelta: 7 }
    ]
  });
  assert.equal(movementAtBoundary.appliedAdditions, 0);
  assert.equal(movementAtBoundary.projectedQuantity, 10);

  // Same rule for day resolution: only a strictly later operating date is attributable.
  assert.equal(dayResolutionConsumptionIsAfterCount(operatingDate, operatingDate), false);
  assert.equal(dayResolutionConsumptionIsAfterCount(operatingDate, "2026-08-18"), true);
  assert.equal(dayResolutionConsumptionIsAfterCount(operatingDate, "2026-08-16"), false);

  // And for suppression: an equal-timestamp count does not release a handled item.
  assert.equal(verifiedCountSupersedes(evidence, countedAt), false);
  assert.equal(verifiedCountSupersedes(evidence, "2026-08-17T12:00:00.000Z"), true);

  // Ties on the same instant are broken by ledger sequence, so resolution is deterministic.
  const tied = resolveVerifiedInventoryCount(
    restaurantA,
    itemId,
    [countEvent(countedAt, 10, { id: "count-low", sequence: 2 }), countEvent(countedAt, 4, { id: "count-high", sequence: 9 })],
    CANONICAL_PER_UNIT
  );
  assert.equal(tied?.eventId, "count-high");
  assert.equal(tied?.countedQuantity, 4);
});

test("count evidence anchors the projected on-hand a screen reads", () => {
  const sales: PosSale[] = [
    {
      id: "sale-morning",
      restaurant_id: restaurantA,
      source_record_id: "pos-1",
      sale_date: operatingDate,
      item_name: "Chicken bowl",
      category: "Entree",
      quantity_sold: 8,
      gross_sales: 120,
      net_sales: 110,
      source_pos: "Test POS",
      created_at: "2026-08-17T10:00:00.000Z"
    }
  ];
  const mappings: MenuItemIngredient[] = [
    {
      id: "mapping-1",
      restaurant_id: restaurantA,
      menu_item_name: "Chicken bowl",
      inventory_item_id: itemId,
      quantity_used_per_sale: 0.5,
      unit: "lb"
    }
  ];
  const countedItem = item({ current_quantity: 10 });

  // Count yesterday: today's day-resolution sales are provably after it.
  const yesterdayCount = buildInventoryPrediction(
    countedItem,
    sales,
    mappings,
    operatingDate,
    undefined,
    undefined,
    evidenceFor([countEvent("2026-08-16T08:00:00.000Z", 10)], { item: countedItem })
  );
  assert.equal(yesterdayCount.todayDepletion, 4);
  assert.equal(yesterdayCount.projectedQuantity, 6);
  assert.equal(yesterdayCount.unattributedTodayDepletion, 0);
  assert.equal(yesterdayCount.countEvidence, "verified_count");
  assert.equal(yesterdayCount.isTemporallyAuthoritative, true);

  // Count today: the counter already saw the morning's sales.
  const middayCount = buildInventoryPrediction(
    countedItem,
    sales,
    mappings,
    operatingDate,
    undefined,
    undefined,
    evidenceFor([countEvent("2026-08-17T13:00:00.000Z", 10)], { item: countedItem })
  );
  assert.equal(middayCount.todayDepletion, 0);
  assert.equal(middayCount.projectedQuantity, 10);
  assert.equal(middayCount.unattributedTodayDepletion, 4);
  assert.equal(middayCount.isTemporallyAuthoritative, false);
  // Demand memory still sees the real sales, so coverage is not silently inflated.
  assert.ok(middayCount.averageDailyUsage > 0);

  // No verified count: the projection is labeled unverified even though
  // `last_updated` was touched moments ago.
  const unverified = buildInventoryPrediction(countedItem, sales, mappings, operatingDate);
  assert.equal(unverified.countEvidence, "no_verified_count");
  assert.equal(unverified.countedAt, null);
  assert.equal(unverified.countFreshness, "unverified");
  assert.equal(unverified.isTemporallyAuthoritative, false);
});

test("server-shared signals anchor depletion and unsuppression to verified count time", () => {
  const snapshotBase = {
    restaurantId: restaurantA,
    operatingDate,
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: restaurantA,
        item_name: "Chicken breast",
        supplier_id: freshFoodsSupplierId,
        supplier_name: "Fresh Foods",
        unit: "lb",
        current_quantity: 12,
        par_level: 40,
        // Both the 12 lb midday baseline and the 8 lb next-day projection sit at or
        // below reorder, so each case produces a comparable low-stock signal.
        reorder_threshold: 12,
        last_updated: "2026-08-17T23:59:00.000Z"
      }
    ],
    sales: [
      { restaurant_id: restaurantA, sale_date: operatingDate, item_name: "Chicken bowl", quantity_sold: 8 }
    ],
    menuItemIngredients: [
      {
        restaurant_id: restaurantA,
        menu_item_name: "Chicken bowl",
        inventory_item_id: itemId,
        quantity_used_per_sale: 0.5,
        unit: "lb"
      }
    ],
    recommendationHistory: [],
    timeZone: "UTC"
  };

  const middayCounted = calculateOperationalSignals({
    ...snapshotBase,
    inventoryLedgerEvents: [countEvent("2026-08-17T13:00:00.000Z", 12)]
  });
  // 12 counted at 13:00 stays 12; the morning's 4 lb is not subtracted again.
  assert.equal(lowStockProjectedQuantity(middayCounted.insights), 12);

  const countedYesterday = calculateOperationalSignals({
    ...snapshotBase,
    inventoryLedgerEvents: [countEvent("2026-08-16T13:00:00.000Z", 12)]
  });
  assert.equal(lowStockProjectedQuantity(countedYesterday.insights), 8);

  // A handled recommendation is released only by a count newer than the decision.
  const handled = {
    inventory_item_id: itemId,
    recommended_quantity: 20,
    unit: "lb",
    status: "dismissed",
    created_at: "2026-08-17T09:00:00.000Z"
  };
  const stillSuppressed = calculateOperationalSignals({
    ...snapshotBase,
    recommendationHistory: [handled],
    inventoryLedgerEvents: [countEvent("2026-08-17T08:00:00.000Z", 12)]
  });
  assert.equal(stillSuppressed.recommendations.length, 0);

  const recounted = calculateOperationalSignals({
    ...snapshotBase,
    recommendationHistory: [handled],
    inventoryLedgerEvents: [countEvent("2026-08-17T13:00:00.000Z", 12)]
  });
  assert.equal(recounted.recommendations.length, 1);

  // Without any count evidence Mise stays fail-closed on the handled decision.
  const noEvidence = calculateOperationalSignals({
    ...snapshotBase,
    recommendationHistory: [handled]
  });
  assert.equal(noEvidence.recommendations.length, 0);
});

test("suppression ignores non-count row updates and stays closed without evidence", () => {
  const handled: PurchaseRecommendation = {
    id: "rec-handled",
    restaurant_id: restaurantA,
    inventory_item_id: itemId,
    item_name: "Chicken breast",
    supplier_id: freshFoodsSupplierId,
    supplier_name: "Fresh Foods",
    recommended_quantity: 20,
    unit: "lb",
    reason: "Operator dismissed during service.",
    urgency: "high",
    status: "dismissed",
    supplier_order_id: null,
    created_at: "2026-08-17T12:00:00.000Z"
  };
  const edited = item({ last_updated: "2026-08-17T23:00:00.000Z", par_level: 80 });

  const beforeEvidence = buildInventoryCountEvidence({
    restaurantId: restaurantA,
    items: [edited],
    ledgerEvents: [countEvent("2026-08-17T08:00:00.000Z", 20)]
  });
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, edited, [handled], beforeEvidence), true);
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, edited, [handled]), true);

  const afterEvidence = buildInventoryCountEvidence({
    restaurantId: restaurantA,
    items: [edited],
    ledgerEvents: [countEvent("2026-08-17T14:00:00.000Z", 20)]
  });
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, edited, [handled], afterEvidence), false);

  // Evidence from another tenant is ignored rather than trusted.
  const foreignEvidence = buildInventoryCountEvidence({
    restaurantId: restaurantB,
    items: [item({ restaurant_id: restaurantB })],
    ledgerEvents: [countEvent("2026-08-17T14:00:00.000Z", 20, { restaurantId: restaurantB })]
  });
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, edited, [handled], foreignEvidence), true);
});

test("pending count evidence anchors signals recomputed inside a count approval", () => {
  const existing = [countEvent("2026-08-16T08:00:00.000Z", 30, { sequence: 7 })];
  const pending = withPendingCountEvidence(existing, {
    restaurantId: restaurantA,
    inventoryItemIds: [itemId],
    countedAt: "2026-08-17T13:00:00.000Z"
  });

  assert.equal(pending.length, 2);
  const resolved = resolveVerifiedInventoryCount(restaurantA, itemId, pending, CANONICAL_PER_UNIT);
  assert.equal(resolved?.countedAt, "2026-08-17T13:00:00.000Z");
  assert.ok((resolved?.sequence ?? 0) > 7);
  // The approval has no persisted ledger quantity yet, so no baseline is claimed.
  assert.equal(resolved?.countedQuantity, null);
  assert.equal(project({ evidence: evidenceFor(pending) }).projectedQuantity, null);
});

test("the planning snapshot and Edge workflow carry authoritative count evidence", () => {
  const migration = readFileSync(
    "supabase/migrations/20260817120000_authoritative_inventory_count_evidence.sql",
    "utf8"
  );
  const edgeWorkflow = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const signals = readFileSync("services/domain/operationalSignals.ts", "utf8");

  // The snapshot RPC keeps its role gate, search_path, and tenant scope while adding
  // the newest verified count per item plus the restaurant timezone.
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+private\.fetch_operational_planning_snapshot/i
  );
  assert.match(migration, /security\s+definer[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    /actor_has_restaurant_role\([\s\S]*array\['owner',\s*'admin',\s*'manager'\]/i
  );
  assert.match(migration, /'inventoryLedgerEvents'/);
  assert.match(migration, /'timeZone'/);
  assert.match(
    migration,
    /distinct\s+on\s*\(event\.inventory_item_id\)[\s\S]*event_type\s*=\s*'count'[\s\S]*order\s+by\s+event\.inventory_item_id,\s*event\.effective_at\s+desc,\s*event\.sequence\s+desc/i
  );
  assert.match(migration, /where\s+event\.restaurant_id\s*=\s*p_restaurant_id/i);
  // No privilege, policy, or RLS relaxation rides along with this read-only change.
  assert.doesNotMatch(migration, /^\s*(grant|revoke)\s/im);
  assert.doesNotMatch(migration, /^\s*(create|drop)\s+policy\s/im);
  assert.doesNotMatch(migration, /^\s*alter\s+table\s/im);

  assert.match(edgeWorkflow, /withPendingCountEvidence\(snapshot\.inventoryLedgerEvents/);
  assert.match(signals, /inventoryLedgerEvents\?:\s*readonly\s+LedgerProjectionEvent\[\]/);
  // Planning depletion no longer reads the generic row mutation timestamp.
  assert.doesNotMatch(signals, /Date\.parse\(item\.last_updated\)/);

  // Every real planning path must supply the FULL ledger, not just count rows:
  // counts alone cannot detect an out-of-order projection. A regression to a
  // count-only read here would silently reopen the contamination hole.
  const evidenceReader = readFileSync("services/application/inventoryEvidence.ts", "utf8");
  assert.match(evidenceReader, /sinceSequence/);
  assert.match(evidenceReader, /complete:\s*countsComplete\s*&&\s*followingComplete/);
  for (const path of [
    "services/application/inventory.ts",
    "services/application/operatingBrief.ts",
    "services/application/today.ts",
    "services/application/operatingPlan.ts"
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /fetchInventoryLedgerEvidence\(/, path);
    assert.match(source, /ledgerComplete/, path);
    assert.doesNotMatch(source, /fetchVerifiedInventoryCountEvents\(/, path);
  }
});

// Future-dated count evidence: a physical count is an observation of the present.
test("A materially future-dated count is neither fresh nor authoritative", () => {
  const asOf = evaluatedAt;
  const future = countEvent("2026-08-24T08:00:00.000Z", 500, { id: "count-future" });

  assert.equal(COUNT_VALIDITY_RULE, "reject_counts_effective_after_evaluation_instant");
  assert.equal(isTemporallyValidCount(future.effectiveAt, asOf), false);
  assert.equal(resolveVerifiedInventoryCount(restaurantA, itemId, [future], CANONICAL_PER_UNIT, { asOf }), null);

  const evidence = evidenceFor([future], { generatedAt: asOf });
  // The future row was the last count applied, so the materialized projection is
  // contaminated — a strictly stronger statement than "never counted".
  assert.equal(evidence.status, "contaminated");
  assert.equal(evidence.countedAt, null);
  assert.equal(evidence.countAgeHours, null);
  assert.equal(evidence.freshness, "unverified");

  // Fail closed rather than reporting a fabricated projection.
  const projection = project({ evidence });
  assert.equal(projection.evidence, "no_verified_count");
  assert.equal(projection.projectedQuantity, null);
  assert.equal(projection.isTemporallyAuthoritative, false);

  // A future timestamp is never flattened into age zero.
  assert.notEqual(evidence.countAgeHours, 0);
});

test("only clock-skew-sized drift is tolerated, and the tolerance cannot be widened", () => {
  const asOf = evaluatedAt;
  const withinSkew = new Date(Date.parse(asOf) + 60_000).toISOString();
  const beyondSkew = new Date(Date.parse(asOf) + COUNT_CLOCK_SKEW_TOLERANCE_MS + 1_000).toISOString();

  assert.equal(COUNT_CLOCK_SKEW_TOLERANCE_MS, 120_000);
  assert.equal(isTemporallyValidCount(withinSkew, asOf), true);
  assert.equal(isTemporallyValidCount(beyondSkew, asOf), false);
  // Drift inside the tolerance is reported as a zero-age observation, not a negative one.
  assert.equal(evidenceFor([countEvent(withinSkew, 20)], { generatedAt: asOf }).countAgeHours, 0);

  // A caller cannot opt into a larger window than the shared tolerance.
  assert.equal(
    isTemporallyValidCount(beyondSkew, asOf, 30 * 86_400_000),
    false
  );
  // A caller may opt into a stricter window.
  assert.equal(isTemporallyValidCount(withinSkew, asOf, 0), false);
});

test("a future count never hides the newest valid count for the item", () => {
  const asOf = evaluatedAt;
  const events = [
    countEvent("2026-08-16T08:00:00.000Z", 30, { id: "count-old", sequence: 1 }),
    countEvent("2026-08-17T08:00:00.000Z", 12, { id: "count-valid", sequence: 2 }),
    // Newest by timestamp and by sequence, and therefore the dangerous case.
    countEvent("2026-08-24T08:00:00.000Z", 999, { id: "count-future", sequence: 9 })
  ];

  // The resolver still identifies the newest VALID count as the authoritative one.
  const resolved = resolveVerifiedInventoryCount(restaurantA, itemId, events, CANONICAL_PER_UNIT, { asOf });
  assert.equal(resolved?.eventId, "count-valid");
  assert.equal(resolved?.countedAt, "2026-08-17T08:00:00.000Z");
  assert.equal(resolved?.countedQuantity, 12);

  // But the future row was the last count APPLIED, so the materialized quantity that
  // planning would start from is tainted and the item has no usable evidence yet.
  assert.equal(projectionContaminated(restaurantA, itemId, events, { asOf }), true);
  assert.equal(evidenceFor(events, { generatedAt: asOf }).status, "contaminated");

  // When the future row was applied BEFORE a valid count, the projection was
  // re-anchored by that valid count and the item is trustworthy again.
  const recounted = [
    countEvent("2026-08-24T08:00:00.000Z", 999, { id: "count-future", sequence: 2 }),
    countEvent("2026-08-17T08:00:00.000Z", 12, { id: "count-valid", sequence: 5 })
  ];
  assert.equal(projectionContaminated(restaurantA, itemId, recounted, { asOf }), false);
  const evidence = evidenceFor(recounted, { generatedAt: asOf });
  assert.equal(evidence.status, "verified");
  assert.equal(evidence.countedAt, "2026-08-17T08:00:00.000Z");
  assert.equal(evidence.freshness, "fresh");

  // The valid count still anchors the window; the future row contributes nothing.
  const projection = project({
    evidence,
    consumption: [consumption("2026-08-17T09:00:00.000Z", 4)]
  });
  assert.equal(projection.baselineQuantity, 12);
  assert.equal(projection.appliedConsumption, 4);
  assert.equal(projection.projectedQuantity, 8);
});

test("future count evidence cannot release recommendation suppression", () => {
  const handled: PurchaseRecommendation = {
    id: "rec-handled-future",
    restaurant_id: restaurantA,
    inventory_item_id: itemId,
    item_name: "Chicken breast",
    supplier_id: freshFoodsSupplierId,
    supplier_name: "Fresh Foods",
    recommended_quantity: 20,
    unit: "lb",
    reason: "Operator dismissed during service.",
    urgency: "high",
    status: "dismissed",
    supplier_order_id: null,
    created_at: "2026-08-17T12:00:00.000Z"
  };
  const asOf = evaluatedAt;
  const scopedItem = item();

  const futureOnly = buildInventoryCountEvidence({
    restaurantId: restaurantA,
    items: [scopedItem],
    ledgerEvents: [countEvent("2026-08-24T08:00:00.000Z", 20, { id: "count-future" })],
    generatedAt: asOf
  });
  assert.equal(verifiedCountSupersedes(futureOnly.get(itemId)!, handled.created_at), false);
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, scopedItem, [handled], futureOnly), true);

  // A future count alongside a pre-decision count also keeps the suppression closed.
  const futureAndStale = buildInventoryCountEvidence({
    restaurantId: restaurantA,
    items: [scopedItem],
    ledgerEvents: [
      countEvent("2026-08-17T08:00:00.000Z", 20, { id: "count-before", sequence: 1 }),
      countEvent("2026-08-24T08:00:00.000Z", 20, { id: "count-future", sequence: 9 })
    ],
    generatedAt: asOf
  });
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, scopedItem, [handled], futureAndStale), true);

  // Only a real post-decision count releases it.
  const released = buildInventoryCountEvidence({
    restaurantId: restaurantA,
    items: [scopedItem],
    ledgerEvents: [countEvent("2026-08-17T14:00:00.000Z", 20, { id: "count-after" })],
    generatedAt: asOf
  });
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, scopedItem, [handled], released), false);
});

test("server-shared signals ignore future count evidence and keep the valid anchor", () => {
  const snapshot = {
    restaurantId: restaurantA,
    operatingDate,
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: restaurantA,
        item_name: "Chicken breast",
        supplier_id: freshFoodsSupplierId,
        supplier_name: "Fresh Foods",
        unit: "lb",
        current_quantity: 12,
        par_level: 40,
        reorder_threshold: 12,
        last_updated: "2026-08-17T23:59:00.000Z"
      }
    ],
    sales: [
      { restaurant_id: restaurantA, sale_date: operatingDate, item_name: "Chicken bowl", quantity_sold: 8 }
    ],
    menuItemIngredients: [
      {
        restaurant_id: restaurantA,
        menu_item_name: "Chicken bowl",
        inventory_item_id: itemId,
        quantity_used_per_sale: 0.5,
        unit: "lb"
      }
    ],
    recommendationHistory: [],
    timeZone: "UTC"
  };

  // A count dated a week out is the last count applied, so `current_quantity` is
  // tainted: the item produces no quantity-based signal at all until a real recount.
  const futureOnly = calculateOperationalSignals({
    ...snapshot,
    inventoryLedgerEvents: [countEvent(futureIso(7), 12, { id: "count-future" })]
  });
  assert.equal(lowStockProjectedQuantity(futureOnly.insights), null);
  assert.equal(futureOnly.recommendations.length, 0);

  // Same when an older valid count exists behind the future row.
  const validBehindFuture = calculateOperationalSignals({
    ...snapshot,
    inventoryLedgerEvents: [
      countEvent("2026-08-16T13:00:00.000Z", 12, { id: "count-valid", sequence: 1 }),
      countEvent(futureIso(7), 12, { id: "count-future", sequence: 9 })
    ]
  });
  assert.equal(lowStockProjectedQuantity(validBehindFuture.insights), null);
  assert.equal(validBehindFuture.recommendations.length, 0);

  // A legitimate recount applied after the future row restores normal output.
  const recounted = calculateOperationalSignals({
    ...snapshot,
    inventoryLedgerEvents: [
      countEvent(futureIso(7), 999, { id: "count-future", sequence: 1 }),
      countEvent("2026-08-16T13:00:00.000Z", 12, { id: "count-recount", sequence: 9 })
    ]
  });
  assert.equal(lowStockProjectedQuantity(recounted.insights), 8);
  assert.equal(recounted.recommendations.length, 1);

  // And a future row cannot unsuppress a handled decision.
  const handled = {
    inventory_item_id: itemId,
    recommended_quantity: 20,
    unit: "lb",
    status: "dismissed",
    created_at: "2026-08-17T09:00:00.000Z"
  };
  const suppressed = calculateOperationalSignals({
    ...snapshot,
    recommendationHistory: [handled],
    inventoryLedgerEvents: [countEvent(futureIso(7), 12, { id: "count-future" })]
  });
  assert.equal(suppressed.recommendations.length, 0);
});

test("the ledger refuses to append future-dated count evidence", () => {
  const recordedAt = "2026-08-17T18:00:00.000Z";
  const base = {
    restaurantId: restaurantA,
    inventoryItemId: itemId,
    eventType: "count" as const,
    quantity: 20,
    canonicalUnit: "g" as const,
    source: "approve_count_session",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "client-count-1",
    idempotencyKey: "idem-count-1",
    supersedesEventId: null,
    metadata: {}
  };
  const authority = { id: "event-1", actorUserId: "owner-a", recordedAt };

  const future = acceptInventoryEvent({
    existingEvents: [],
    candidate: { ...base, effectiveAt: "2026-08-24T08:00:00.000Z" },
    authority
  });
  assert.equal(future.status, "rejected");
  assert.equal("reason" in future ? future.reason : null, "future_dated_count");

  // E: a count effective at the moment it is recorded still succeeds.
  const current = acceptInventoryEvent({
    existingEvents: [],
    candidate: { ...base, effectiveAt: recordedAt },
    authority
  });
  assert.equal(current.status, "accepted");

  // Non-count ledger rows share the same clock-skew guard: future receipts must
  // not project into on-hand ahead of the server clock.
  const futureReceipt = acceptInventoryEvent({
    existingEvents: [],
    candidate: {
      ...base,
      eventType: "receipt",
      effectiveAt: "2026-08-24T08:00:00.000Z",
      clientEventId: "client-receipt-1",
      idempotencyKey: "idem-receipt-1"
    },
    authority
  });
  assert.equal(futureReceipt.status, "rejected");
  assert.equal("reason" in futureReceipt ? futureReceipt.reason : null, "future_dated_event");
});

test("a current-time count approval still produces usable authoritative evidence", () => {
  // Mirrors approveInventoryCountSession and the Edge approve_count_session path:
  // countedAt is stamped just before the recompute, so it must remain valid.
  const countedAt = new Date().toISOString();
  const pending = withPendingCountEvidence([], {
    restaurantId: restaurantA,
    inventoryItemIds: [itemId],
    countedAt
  });
  const evidence = buildInventoryCountEvidence({
    restaurantId: restaurantA,
    items: [item()],
    ledgerEvents: pending,
    generatedAt: new Date(Date.parse(countedAt) + 5).toISOString()
  }).get(itemId);

  assert.ok(evidence);
  assert.equal(evidence.status, "verified");
  assert.equal(evidence.freshness, "fresh");
  assert.equal(evidence.countedAt, countedAt);
  assert.ok((evidence.countAgeHours ?? -1) >= 0 && (evidence.countAgeHours ?? 1) < 0.01);
});

test("future count evidence from another tenant changes nothing for this tenant", () => {
  const asOf = evaluatedAt;
  const events = [
    countEvent("2026-08-17T08:00:00.000Z", 20, { id: "count-a-valid" }),
    countEvent(futureIso(7), 999, { id: "count-b-future", restaurantId: restaurantB, sequence: 9 }),
    countEvent("2026-08-17T17:00:00.000Z", 999, { id: "count-b-valid", restaurantId: restaurantB, sequence: 8 })
  ];

  // Restaurant A stays verified: another tenant's future row is not its contamination.
  const evidence = evidenceFor(events, { generatedAt: asOf });
  assert.equal(evidence.restaurantId, restaurantA);
  assert.equal(evidence.status, "verified");
  assert.equal(evidence.countedAt, "2026-08-17T08:00:00.000Z");
  assert.equal(projectionContaminated(restaurantA, itemId, events, { asOf }), false);

  // Restaurant B carries its own contamination: its future row was applied last.
  const foreign = evidenceFor(events, {
    restaurantId: restaurantB,
    generatedAt: asOf,
    item: item({ restaurant_id: restaurantB })
  });
  assert.equal(foreign.status, "contaminated");
  assert.equal(projectionContaminated(restaurantB, itemId, events, { asOf }), true);
});

test("the planning snapshot and ledger trigger both exclude future-dated counts", () => {
  const snapshotMigration = readFileSync(
    "supabase/migrations/20260817120000_authoritative_inventory_count_evidence.sql",
    "utf8"
  );
  const triggerMigration = readFileSync(
    "supabase/migrations/20260818120000_reject_future_dated_inventory_counts.sql",
    "utf8"
  );

  // The per-item newest-wins choice happens after future rows are filtered out, so a
  // future count cannot be selected over — or hide — the latest valid count.
  assert.match(
    snapshotMigration,
    /event_type\s*=\s*'count'\s*\n\s*and event\.effective_at\s*<=\s*now\(\)\s*\+\s*interval\s*'2 minutes'\s*\n\s*order\s+by\s+event\.inventory_item_id/i
  );

  assert.match(
    triggerMigration,
    /create\s+or\s+replace\s+function\s+private\.reject_future_dated_inventory_count/i
  );
  assert.match(triggerMigration, /security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    triggerMigration,
    /new\.event_type\s*=\s*'count'[\s\S]*new\.effective_at\s*>\s*clock_timestamp\(\)\s*\+\s*interval\s*'2 minutes'/i
  );
  assert.match(triggerMigration, /before\s+insert\s+on\s+public\.inventory_events/i);
  // Rejection only. No privilege, policy, RLS, or append-only relaxation rides along.
  assert.doesNotMatch(triggerMigration, /^\s*(grant|revoke)\s/im);
  assert.doesNotMatch(triggerMigration, /^\s*(create|drop)\s+policy\s/im);
  assert.doesNotMatch(triggerMigration, /^\s*alter\s+table\s/im);
  // The pre-existing append-only guard is left in place.
  assert.doesNotMatch(triggerMigration, /reject_inventory_event_mutation/i);
});

test("the broadened ledger trigger rejects future-dated events of every type", () => {
  const broadenedMigration = readFileSync(
    "supabase/migrations/20260903120000_reject_future_dated_inventory_events.sql",
    "utf8"
  );

  assert.match(
    broadenedMigration,
    /create\s+or\s+replace\s+function\s+private\.reject_future_dated_inventory_event/i
  );
  assert.match(broadenedMigration, /security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i);
  // No event_type filter — every inventory_events row is guarded.
  assert.match(
    broadenedMigration,
    /if\s+new\.effective_at\s*>\s*clock_timestamp\(\)\s*\+\s*interval\s*'2 minutes'/i
  );
  assert.doesNotMatch(
    broadenedMigration,
    /if\s+new\.event_type\s*=\s*'count'\s*\n\s*and\s+new\.effective_at/i
  );
  assert.match(
    broadenedMigration,
    /create\s+trigger\s+reject_future_dated_inventory_event[\s\S]*before\s+insert\s+on\s+public\.inventory_events/i
  );
  assert.match(
    broadenedMigration,
    /Inventory ledger events cannot be effective in the future/i
  );
  assert.doesNotMatch(broadenedMigration, /^\s*(grant|revoke)\s/im);
  assert.doesNotMatch(broadenedMigration, /^\s*(create|drop)\s+policy\s/im);
  assert.doesNotMatch(broadenedMigration, /^\s*alter\s+table\s/im);
});

test("a future ledger movement cannot inflate projected inventory", () => {
  const evidence = evidenceFor([countEvent("2026-08-17T08:00:00.000Z", 20)]);
  const projection = project({
    evidence,
    movements: [
      // Delivery scheduled for next week is not stock on the shelf today.
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: futureIso(7), quantityDelta: 500 },
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-17T10:00:00.000Z", quantityDelta: 6 }
    ],
    consumption: [
      consumption("2026-08-17T11:00:00.000Z", 4),
      // Nor is a sale dated next week today's depletion.
      consumption(futureIso(7), 99)
    ]
  });

  assert.equal(projection.appliedAdditions, 6);
  assert.equal(projection.appliedConsumption, 4);
  assert.equal(projection.projectedQuantity, 22);
});

// ---------------------------------------------------------------------------
// Legacy contamination: a future count inserted BEFORE the rejection trigger
// existed may already have overwritten inventory_items.current_quantity, because
// apply_inventory_event_projection sets current_quantity = count quantity in
// ledger sequence order. Ignoring the row as evidence is not sufficient.
// ---------------------------------------------------------------------------

/** The ledger history of the contaminated scenario: valid 20, then an invalid 100. */
function legacyContaminatedLedger(): InventoryEvent[] {
  return [
    ledgerEvent({ sequence: 1, eventType: "count", quantity: 20, effectiveAt: "2026-08-17T08:00:00.000Z" }),
    ledgerEvent({ sequence: 2, eventType: "count", quantity: 100, effectiveAt: futureIso(7) })
  ];
}

test("a legacy future count that already moved current_quantity cannot drive planning", () => {
  const ledger = legacyContaminatedLedger();

  // The materialized projection really is 100: the trigger replaces on each count,
  // in insertion order, so the invalid row won.
  assert.equal(projectInventoryEvents(restaurantA, itemId, ledger).quantity / CANONICAL_PER_UNIT, 100);

  const contaminatedItem = item({ current_quantity: 100, reorder_threshold: 12, par_level: 40 });
  const evidence = evidenceFor(ledger, { item: contaminatedItem });
  assert.equal(evidence.status, "contaminated");
  assert.equal(evidence.countedAt, null);
  assert.equal(evidence.freshness, "unverified");

  // The screen-facing projection must not present 100 as a confident position.
  const prediction = buildInventoryPrediction(
    contaminatedItem,
    [],
    [],
    operatingDate,
    undefined,
    undefined,
    evidence
  );
  assert.equal(prediction.countEvidence, "contaminated_projection");
  assert.equal(prediction.isTemporallyAuthoritative, false);
  assert.equal(prediction.projectedStatus, "Watch");
  assert.equal(prediction.urgency, "low");

  // And the server-shared planner emits no quantity-based output for the item.
  const signals = calculateOperationalSignals({
    restaurantId: restaurantA,
    operatingDate,
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: restaurantA,
        item_name: "Chicken breast",
        supplier_id: freshFoodsSupplierId,
        supplier_name: "Fresh Foods",
        unit: "lb",
        current_quantity: 100,
        par_level: 40,
        reorder_threshold: 12,
        last_updated: "2026-08-17T23:59:00.000Z"
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [],
    timeZone: "UTC",
    inventoryLedgerEvents: ledger
  });
  assert.equal(signals.recommendations.length, 0);
  assert.equal(lowStockProjectedQuantity(signals.insights), null);
  assert.equal(
    signals.insights.some((insight) => insight.id === `insight_overstock_${itemId}`),
    false
  );

  // A contaminated item also cannot be manually pushed onto an order: the outlook
  // carries the label the application layer refuses on.
  assert.equal(prediction.countEvidence, "contaminated_projection");
});

test("the invalid future count stays in append-only history", () => {
  const ledger = legacyContaminatedLedger();
  const before = ledger.map((event) => event.id);

  // Nothing in the correction removes, rewrites, or reorders ledger rows.
  evidenceFor(ledger);
  projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt });
  projectInventoryEvents(restaurantA, itemId, ledger);

  assert.deepEqual(ledger.map((event) => event.id), before);
  assert.equal(ledger.filter((event) => event.eventType === "count").length, 2);
  assert.ok(ledger.some((event) => Date.parse(event.effectiveAt) > Date.parse(evaluatedAt)));
});

test("a later legitimate recount restores a trustworthy baseline", () => {
  const recountedAt = "2026-08-17T20:00:00.000Z";
  const ledger = [
    ...legacyContaminatedLedger(),
    // The recount is applied after the invalid row, so the trigger re-anchors
    // current_quantity to 25 and the item becomes trustworthy again.
    ledgerEvent({ sequence: 3, eventType: "count", quantity: 5, effectiveAt: recountedAt })
  ];

  assert.equal(projectInventoryEvents(restaurantA, itemId, ledger).quantity / CANONICAL_PER_UNIT, 5);
  assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), false);

  const recountedItem = item({ current_quantity: 5, reorder_threshold: 12, par_level: 40 });
  const evidence = evidenceFor(ledger, { item: recountedItem });
  assert.equal(evidence.status, "verified");
  assert.equal(evidence.countedAt, recountedAt);
  assert.equal(evidence.freshness, "fresh");

  const prediction = buildInventoryPrediction(
    recountedItem,
    [],
    [],
    operatingDate,
    undefined,
    undefined,
    evidence
  );
  assert.equal(prediction.countEvidence, "verified_count");
  assert.equal(prediction.isTemporallyAuthoritative, true);
  // Readiness is restored rather than permanently forced to the contaminated
  // "needs a look" state: 5 is below reorder, so the real risk shows through.
  assert.equal(prediction.projectedStatus, "Critical");
  assert.equal(prediction.urgency, "high");

  // The recount also becomes the depletion anchor for the invariant engine.
  const projection = project({
    evidence,
    consumption: [
      consumption("2026-08-17T19:00:00.000Z", 5),
      consumption("2026-08-17T21:00:00.000Z", 3)
    ]
  });
  assert.equal(projection.baselineQuantity, 5);
  assert.equal(projection.appliedConsumption, 3);
  assert.equal(projection.projectedQuantity, 2);
});

test("receipts and waste after the restoring recount still project correctly", () => {
  const recountedAt = "2026-08-17T20:00:00.000Z";
  const ledger = [
    ...legacyContaminatedLedger(),
    ledgerEvent({ sequence: 3, eventType: "count", quantity: 25, effectiveAt: recountedAt }),
    ledgerEvent({ sequence: 4, eventType: "receipt", quantity: 10, effectiveAt: "2026-08-17T21:00:00.000Z" }),
    ledgerEvent({ sequence: 5, eventType: "waste", quantity: 4, effectiveAt: "2026-08-17T22:00:00.000Z" })
  ];

  // Existing ledger semantics are unchanged: 25 counted, +10 received, -4 wasted.
  assert.equal(projectInventoryEvents(restaurantA, itemId, ledger).quantity / CANONICAL_PER_UNIT, 31);
  assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), false);

  const evidence = evidenceFor(ledger, { item: item({ current_quantity: 31 }) });
  const projection = project({
    evidence,
    movements: [
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-17T21:00:00.000Z", quantityDelta: 10 },
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-17T22:00:00.000Z", quantityDelta: -4 },
      // A movement recorded before the recount is already inside the counted quantity.
      { restaurantId: restaurantA, inventoryItemId: itemId, effectiveAt: "2026-08-17T10:00:00.000Z", quantityDelta: 50 }
    ]
  });
  assert.equal(projection.baselineQuantity, 25);
  assert.equal(projection.appliedAdditions, 10);
  assert.equal(projection.appliedLedgerReductions, 4);
  assert.equal(projection.projectedQuantity, 31);
});

test("stockouts, adjustments, transfers and corrections keep their ledger meaning", () => {
  const recountedAt = "2026-08-17T20:00:00.000Z";
  const base = [
    ...legacyContaminatedLedger(),
    ledgerEvent({ sequence: 3, eventType: "count", quantity: 25, effectiveAt: recountedAt })
  ];

  const stockout = projectInventoryEvents(restaurantA, itemId, [
    ...base,
    ledgerEvent({ sequence: 4, eventType: "stockout", quantity: 0, effectiveAt: "2026-08-17T21:00:00.000Z" })
  ]);
  assert.equal(stockout.quantity / CANONICAL_PER_UNIT, 0);

  const adjusted = projectInventoryEvents(restaurantA, itemId, [
    ...base,
    ledgerEvent({ sequence: 4, eventType: "adjustment", quantity: -5, effectiveAt: "2026-08-17T21:00:00.000Z" }),
    ledgerEvent({ sequence: 5, eventType: "transfer", quantity: 2, effectiveAt: "2026-08-17T22:00:00.000Z" }),
    ledgerEvent({
      sequence: 6,
      eventType: "correction",
      quantity: 3,
      effectiveAt: "2026-08-17T23:00:00.000Z",
      supersedesEventId: "event-4"
    })
  ]);
  assert.equal(adjusted.quantity / CANONICAL_PER_UNIT, 25);

  // Non-count events never change the contamination verdict in either direction.
  assert.equal(projectionContaminated(restaurantA, itemId, base, { asOf: evaluatedAt }), false);
  assert.equal(
    projectionContaminated(restaurantA, itemId, legacyContaminatedLedger(), {
      asOf: evaluatedAt
    }),
    true
  );
});

test("contamination is tenant-scoped and does not leak between restaurants", () => {
  const ledger = [
    ...legacyContaminatedLedger(),
    {
      ...ledgerEvent({ sequence: 3, eventType: "count", quantity: 25, effectiveAt: "2026-08-17T20:00:00.000Z" }),
      id: "event-b-1",
      restaurantId: restaurantB
    }
  ];

  assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), true);
  // Restaurant B's own history is clean and its higher sequence must not clear A.
  assert.equal(projectionContaminated(restaurantB, itemId, ledger, { asOf: evaluatedAt }), false);
  assert.equal(evidenceFor(ledger, { generatedAt: evaluatedAt }).status, "contaminated");
  assert.equal(
    evidenceFor(ledger, {
      restaurantId: restaurantB,
      generatedAt: evaluatedAt,
      item: item({ restaurant_id: restaurantB })
    }).status,
    "verified"
  );
});

test("a contaminated projection cannot release suppression or order readiness", () => {
  const ledger = legacyContaminatedLedger();
  const contaminatedItem = item({ current_quantity: 100 });
  const evidenceMap = buildInventoryCountEvidence({
    restaurantId: restaurantA,
    items: [contaminatedItem],
    ledgerEvents: ledger,
    generatedAt: evaluatedAt
  });

  const handled: PurchaseRecommendation = {
    id: "rec-handled-contaminated",
    restaurant_id: restaurantA,
    inventory_item_id: itemId,
    item_name: "Chicken breast",
    supplier_id: freshFoodsSupplierId,
    supplier_name: "Fresh Foods",
    recommended_quantity: 20,
    unit: "lb",
    reason: "Operator dismissed during service.",
    urgency: "high",
    status: "dismissed",
    supplier_order_id: null,
    created_at: "2026-08-17T09:00:00.000Z"
  };
  assert.equal(
    shouldSuppressRecommendationForItem(restaurantA, contaminatedItem, [handled], evidenceMap),
    true
  );

  // Order automation stays on manual review with an explicit stale-count blocker.
  const assessment = assessOrderAutomation({
    restaurantId: restaurantA,
    supplierId: freshFoodsSupplierId,
    supplierName: "Fresh Foods",
    candidates: [
      {
        id: "rec-candidate",
        restaurant_id: restaurantA,
        inventory_item_id: itemId,
        item_name: "Chicken breast",
        supplier_id: freshFoodsSupplierId,
        supplier_name: "Fresh Foods",
        recommended_quantity: 12,
        unit: "lb",
        reason: "Projected below par.",
        urgency: "high",
        status: "pending",
        supplier_order_id: null,
        created_at: "2026-08-17T22:30:00.000Z"
      }
    ],
    inventoryItems: [contaminatedItem],
    recommendationHistory: [11, 12, 12].map((quantity, index) => ({
      id: `rec-history-${index}`,
      restaurant_id: restaurantA,
      inventory_item_id: itemId,
      item_name: "Chicken breast",
      supplier_id: freshFoodsSupplierId,
      supplier_name: "Fresh Foods",
      recommended_quantity: quantity,
      unit: "lb",
      reason: "Previously ordered.",
      urgency: "medium" as const,
      status: "ordered" as const,
      supplier_order_id: null,
      created_at: `2026-08-1${index + 1}T12:00:00.000Z`
    })),
    inventoryLedgerEvents: ledger,
    delivery: { emailConnected: true, supplierRecipientConfigured: true },
    now: new Date(evaluatedAt)
  });
  assert.equal(assessment.decision, "manual_review");
  assert.ok(assessment.blockers.includes("stale_inventory_count"));

  // And the application layer refuses a manual add on the contaminated label.
  const prediction = buildInventoryPrediction(
    contaminatedItem,
    [],
    [],
    operatingDate,
    undefined,
    undefined,
    evidenceMap.get(itemId)
  );
  assert.equal(prediction.countEvidence, "contaminated_projection");
  const inventoryWorkflow = readFileSync("services/application/inventory.ts", "utf8");
  assert.match(
    inventoryWorkflow,
    /prediction\.countEvidence === "contaminated_projection"[\s\S]*Record a new physical count/
  );
});

test("the planning snapshot returns the rows needed to detect contamination", () => {
  const migration = readFileSync(
    "supabase/migrations/20260818130000_project_inventory_events_against_count_boundary.sql",
    "utf8"
  );

  // The newest count by insertion sequence is what the projection trigger last
  // applied, so the snapshot must expose it even when it is future-dated.
  assert.match(
    migration,
    /order\s+by\s+event\.inventory_item_id,\s*event\.sequence\s+desc/i
  );
  // The newest valid count is still returned as the authoritative baseline.
  assert.match(
    migration,
    /effective_at\s*<=\s*now\(\)\s*\+\s*interval\s*'2 minutes'[\s\S]*order\s+by\s+event\.inventory_item_id,\s*event\.effective_at\s+desc/i
  );
  assert.match(migration, /union/i);
});

// ---------------------------------------------------------------------------
// Out-of-order ledger events. apply_inventory_event_projection applied rows in
// insertion order, so a delayed offline event could move the on-hand quantity even
// when its effective_at was already inside a later-inserted count's baseline.
// ---------------------------------------------------------------------------

const countedAtBoundary = "2026-08-17T13:00:00.000Z";

/** A count at 13:00 inserted before a delayed row that was effective earlier. */
function delayedLedger(
  delayed: {
    eventType: InventoryEvent["eventType"];
    quantity: number;
    effectiveAt: string;
    projectionApplied?: boolean;
  }
): InventoryEvent[] {
  return [
    ledgerEvent({ sequence: 1, eventType: "count", quantity: 10, effectiveAt: countedAtBoundary }),
    {
      ...ledgerEvent({
        sequence: 2,
        eventType: delayed.eventType,
        quantity: delayed.quantity,
        effectiveAt: delayed.effectiveAt
      }),
      projectionApplied: delayed.projectionApplied ?? false
    }
  ];
}

// A: delayed receipt
test("a receipt effective before the count is retained but does not re-inflate it", () => {
  const ledger = delayedLedger({ eventType: "receipt", quantity: 5, effectiveAt: "2026-08-17T12:00:00.000Z" });

  // Retained in append-only history.
  assert.equal(ledger.length, 2);
  assert.equal(ledger[1]?.eventType, "receipt");
  assert.equal(ledger[1]?.effectiveAt, "2026-08-17T12:00:00.000Z");

  // The boundary fix did not apply it, so the item stays trustworthy at 10.
  assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), false);
  const evidence = evidenceFor(ledger, { item: item({ current_quantity: 10 }) });
  assert.equal(evidence.status, "verified");
  assert.equal(evidence.countedAt, countedAtBoundary);

  const projection = project({
    evidence,
    movements: [
      {
        restaurantId: restaurantA,
        inventoryItemId: itemId,
        effectiveAt: "2026-08-17T12:00:00.000Z",
        quantityDelta: 5
      }
    ]
  });
  assert.equal(projection.baselineQuantity, 10);
  assert.equal(projection.appliedAdditions, 0);
  assert.equal(projection.projectedQuantity, 10);
});

// B: delayed waste / usage
test("waste or usage effective before the count does not reduce the counted baseline", () => {
  for (const eventType of ["waste", "usage"] as const) {
    const ledger = delayedLedger({ eventType, quantity: 4, effectiveAt: "2026-08-17T11:00:00.000Z" });
    assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), false);

    const projection = project({
      evidence: evidenceFor(ledger, { item: item({ current_quantity: 10 }) }),
      movements: [
        {
          restaurantId: restaurantA,
          inventoryItemId: itemId,
          effectiveAt: "2026-08-17T11:00:00.000Z",
          quantityDelta: -4
        }
      ]
    });
    assert.equal(projection.appliedLedgerReductions, 0, eventType);
    assert.equal(projection.projectedQuantity, 10, eventType);
  }
});

// C: exact boundary
test("an event effective exactly at the count instant is inside the baseline", () => {
  const ledger = delayedLedger({ eventType: "receipt", quantity: 7, effectiveAt: countedAtBoundary });
  assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), false);

  const projection = project({
    evidence: evidenceFor(ledger, { item: item({ current_quantity: 10 }) }),
    movements: [
      {
        restaurantId: restaurantA,
        inventoryItemId: itemId,
        effectiveAt: countedAtBoundary,
        quantityDelta: 7
      }
    ]
  });
  assert.equal(projection.appliedAdditions, 0);
  assert.equal(projection.projectedQuantity, 10);
});

// D: true post-count event
test("an event effective after the count applies exactly once", () => {
  const ledger = [
    ledgerEvent({ sequence: 1, eventType: "count", quantity: 10, effectiveAt: countedAtBoundary }),
    {
      ...ledgerEvent({
        sequence: 2,
        eventType: "receipt",
        quantity: 5,
        effectiveAt: "2026-08-17T14:00:00.000Z"
      }),
      projectionApplied: true
    }
  ];
  assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), false);
  assert.equal(projectInventoryEvents(restaurantA, itemId, ledger).quantity / CANONICAL_PER_UNIT, 15);

  const projection = project({
    evidence: evidenceFor(ledger, { item: item({ current_quantity: 15 }) }),
    movements: [
      {
        restaurantId: restaurantA,
        inventoryItemId: itemId,
        effectiveAt: "2026-08-17T14:00:00.000Z",
        quantityDelta: 5
      }
    ]
  });
  assert.equal(projection.baselineQuantity, 10);
  assert.equal(projection.appliedAdditions, 5);
  assert.equal(projection.projectedQuantity, 15);
});

// E: legacy out-of-order contamination
test("a legacy out-of-order row that already moved the projection fails closed", () => {
  // projectionApplied defaults to true for every row written before the boundary fix.
  const legacy = delayedLedger({
    eventType: "receipt",
    quantity: 5,
    effectiveAt: "2026-08-17T12:00:00.000Z",
    projectionApplied: true
  });

  assert.equal(projectionContaminated(restaurantA, itemId, legacy, { asOf: evaluatedAt }), true);
  const contaminatedItem = item({ current_quantity: 15, reorder_threshold: 12, par_level: 40 });
  const evidence = evidenceFor(legacy, { item: contaminatedItem });
  assert.equal(evidence.status, "contaminated");
  assert.equal(evidence.countedAt, null);

  const prediction = buildInventoryPrediction(
    contaminatedItem,
    [],
    [],
    operatingDate,
    undefined,
    undefined,
    evidence
  );
  assert.equal(prediction.countEvidence, "contaminated_projection");
  assert.equal(prediction.projectedStatus, "Watch");
  assert.equal(prediction.isTemporallyAuthoritative, false);

  // The same verdict applies to the server-shared planner: no quantity-based output.
  const signals = calculateOperationalSignals({
    restaurantId: restaurantA,
    operatingDate,
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: restaurantA,
        item_name: "Chicken breast",
        supplier_id: freshFoodsSupplierId,
        supplier_name: "Fresh Foods",
        unit: "lb",
        current_quantity: 15,
        par_level: 40,
        reorder_threshold: 20,
        last_updated: "2026-08-17T23:59:00.000Z"
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [],
    timeZone: "UTC",
    inventoryLedgerEvents: legacy,
    ledgerComplete: true
  });
  assert.equal(signals.recommendations.length, 0);
  assert.equal(lowStockProjectedQuantity(signals.insights), null);
});

test("a truncated ledger read cannot prove ordering integrity", () => {
  const ledger = [
    ledgerEvent({ sequence: 1, eventType: "count", quantity: 10, effectiveAt: countedAtBoundary })
  ];
  assert.equal(
    projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt, ledgerComplete: true }),
    false
  );
  // A partial ledger might be hiding an out-of-order row, so the item fails closed.
  assert.equal(
    projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt, ledgerComplete: false }),
    true
  );
  // An item with no count anchor has nothing to double-apply across, so it is only
  // "missing" evidence rather than contaminated.
  assert.equal(
    projectionContaminated(restaurantA, itemId, [], { asOf: evaluatedAt, ledgerComplete: false }),
    false
  );
});

// F: recovery
test("a recount after a legacy out-of-order row restores readiness", () => {
  const recountedAt = "2026-08-17T20:00:00.000Z";
  const ledger = [
    ...delayedLedger({
      eventType: "receipt",
      quantity: 5,
      effectiveAt: "2026-08-17T12:00:00.000Z",
      projectionApplied: true
    }),
    ledgerEvent({ sequence: 3, eventType: "count", quantity: 6, effectiveAt: recountedAt })
  ];

  // The recount re-anchors current_quantity, so nothing before it matters any more.
  assert.equal(projectInventoryEvents(restaurantA, itemId, ledger).quantity / CANONICAL_PER_UNIT, 6);
  assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), false);

  const recountedItem = item({ current_quantity: 6, reorder_threshold: 12, par_level: 40 });
  const evidence = evidenceFor(ledger, { item: recountedItem });
  assert.equal(evidence.status, "verified");
  assert.equal(evidence.countedAt, recountedAt);

  const prediction = buildInventoryPrediction(
    recountedItem,
    [],
    [],
    operatingDate,
    undefined,
    undefined,
    evidence
  );
  assert.equal(prediction.countEvidence, "verified_count");
  assert.equal(prediction.projectedStatus, "Critical");
});

// G: tenant isolation
test("another restaurant's delayed events cannot influence this restaurant", () => {
  const ledger = [
    ledgerEvent({ sequence: 1, eventType: "count", quantity: 10, effectiveAt: countedAtBoundary }),
    {
      ...ledgerEvent({
        sequence: 2,
        eventType: "receipt",
        quantity: 5,
        effectiveAt: "2026-08-17T12:00:00.000Z"
      }),
      id: "event-b-delayed",
      restaurantId: restaurantB,
      projectionApplied: true
    }
  ];

  // Restaurant B's out-of-order row does not contaminate Restaurant A.
  assert.equal(projectionContaminated(restaurantA, itemId, ledger, { asOf: evaluatedAt }), false);
  assert.equal(evidenceFor(ledger, { generatedAt: evaluatedAt }).status, "verified");

  // Nor can it be applied to Restaurant A's projection.
  const projection = project({
    evidence: evidenceFor(ledger, { item: item({ current_quantity: 10 }) }),
    movements: [
      {
        restaurantId: restaurantB,
        inventoryItemId: itemId,
        effectiveAt: "2026-08-17T14:00:00.000Z",
        quantityDelta: 500
      }
    ]
  });
  assert.equal(projection.appliedAdditions, 0);
  assert.equal(projection.projectedQuantity, 10);
});

test("the ledger boundary migration retains history and only narrows the projection", () => {
  const migration = readFileSync(
    "supabase/migrations/20260818130000_project_inventory_events_against_count_boundary.sql",
    "utf8"
  );

  // Decision is stamped BEFORE insert, so no UPDATE is needed and append-only holds.
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+private\.stamp_inventory_event_projection_applied/i
  );
  assert.match(migration, /before\s+insert\s+on\s+public\.inventory_events/i);
  assert.match(migration, /add\s+column\s+if\s+not\s+exists\s+projection_applied\s+boolean\s+not\s+null\s+default\s+true/i);
  assert.match(
    migration,
    /from\s+public\.inventory_items\s+item[\s\S]*for\s+update[\s\S]*select\s+max\(prior_count\.effective_at\)/i
  );
  // The event is still inserted; only the projection update is skipped.
  assert.match(migration, /if\s+not\s+new\.projection_applied\s+then\s*\n\s*return\s+new;/i);
  assert.match(
    migration,
    /new\.event_type\s*=\s*'count'[\s\S]*new\.effective_at\s*<\s*count_boundary[\s\S]*new\.effective_at\s*<=\s*count_boundary/i
  );
  // Correction stays a signed delta handled by the unchanged `else` branch, so the
  // existing correction contract is untouched: only the boundary check is new.
  assert.match(
    migration,
    /when new\.event_type in \('waste', 'usage'\) then prior_quantity - native_event_quantity\s*\n\s*else prior_quantity \+ native_event_quantity/
  );
  assert.doesNotMatch(migration, /^\s*(alter|update|delete)\s+.*supersedes_event_id/im);
  // No privilege, policy, RLS, or append-only relaxation rides along.
  assert.doesNotMatch(migration, /^\s*grant\s/im);
  assert.doesNotMatch(migration, /^\s*(create|drop)\s+policy\s/im);
  assert.doesNotMatch(migration, /disable\s+row\s+level\s+security/i);
  assert.doesNotMatch(migration, /drop\s+trigger\s+if\s+exists\s+reject_inventory_event_mutation/i);

  // Demo mode mirrors the same boundary so both paths agree.
  const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
  assert.match(demoRepository, /function inventoryEventMovesProjection/);
  assert.match(demoRepository, /if \(projectionApplied\) \{\n\s*item\.current_quantity = projectedQuantity;/);
});

// ---------------------------------------------------------------------------
// Core invariant, proven through the REAL planning entry points rather than the
// pure helper: buildInventoryOutlooks (screen-facing) and
// calculateOperationalSignals (server-shared, also used by the Edge workflow).
// ---------------------------------------------------------------------------

test("real planning paths cannot double-apply across a verified count", () => {
  const countedAt = "2026-08-17T13:00:00.000Z";
  const sales: PosSale[] = [
    {
      id: "sale-morning",
      restaurant_id: restaurantA,
      source_record_id: "pos-1",
      sale_date: operatingDate,
      item_name: "Chicken bowl",
      category: "Entree",
      quantity_sold: 8,
      gross_sales: 120,
      net_sales: 110,
      source_pos: "Test POS",
      created_at: "2026-08-17T10:00:00.000Z"
    }
  ];
  const mappings: MenuItemIngredient[] = [
    {
      id: "mapping-1",
      restaurant_id: restaurantA,
      menu_item_name: "Chicken bowl",
      inventory_item_id: itemId,
      quantity_used_per_sale: 0.5,
      unit: "lb"
    }
  ];
  const countedItem = item({ current_quantity: 10, reorder_threshold: 12, par_level: 40 });
  const signalItem = {
    id: itemId,
    restaurant_id: restaurantA,
    item_name: "Chicken breast",
    supplier_id: freshFoodsSupplierId,
    supplier_name: "Fresh Foods",
    unit: "lb",
    current_quantity: 10,
    par_level: 40,
    reorder_threshold: 12,
    last_updated: "2026-08-17T23:59:00.000Z"
  };
  const signalSales = [
    { restaurant_id: restaurantA, sale_date: operatingDate, item_name: "Chicken bowl", quantity_sold: 8 }
  ];
  const signalMappings = [
    {
      restaurant_id: restaurantA,
      menu_item_name: "Chicken bowl",
      inventory_item_id: itemId,
      quantity_used_per_sale: 0.5,
      unit: "lb"
    }
  ];

  const outlookFor = (ledger: readonly InventoryEvent[]) =>
    buildInventoryOutlooks(
      restaurantA,
      [countedItem],
      sales,
      mappings,
      operatingDate,
      undefined,
      buildInventoryCountEvidence({
        restaurantId: restaurantA,
        items: [countedItem],
        ledgerEvents: ledger,
        ledgerComplete: true,
        generatedAt: evaluatedAt
      })
    )[0]?.prediction;
  const signalsFor = (ledger: readonly InventoryEvent[]) =>
    calculateOperationalSignals({
      restaurantId: restaurantA,
      operatingDate,
      inventoryItems: [signalItem],
      sales: signalSales,
      menuItemIngredients: signalMappings,
      recommendationHistory: [],
      timeZone: "UTC",
      inventoryLedgerEvents: ledger,
      ledgerComplete: true
    });

  const countOnly = [
    ledgerEvent({ sequence: 1, eventType: "count", quantity: 10, effectiveAt: countedAt })
  ];

  // 1. POS consumption before the count is not subtracted from the counted baseline.
  const posOnly = outlookFor(countOnly);
  assert.equal(posOnly?.todayDepletion, 0);
  assert.equal(posOnly?.unattributedTodayDepletion, 4);
  assert.equal(posOnly?.projectedQuantity, 10);
  assert.equal(lowStockProjectedQuantity(signalsFor(countOnly).insights), 10);

  // 2. A ledger receipt effective before the count is retained but not applied, so the
  //    projection stays at the counted quantity and the item stays authoritative.
  const delayedReceipt = [
    ...countOnly,
    {
      ...ledgerEvent({ sequence: 2, eventType: "receipt", quantity: 5, effectiveAt: "2026-08-17T12:00:00.000Z" }),
      projectionApplied: false
    }
  ];
  assert.equal(outlookFor(delayedReceipt)?.countEvidence, "verified_count");
  assert.equal(outlookFor(delayedReceipt)?.projectedQuantity, 10);
  assert.equal(lowStockProjectedQuantity(signalsFor(delayedReceipt).insights), 10);

  // 3. Same for a ledger reduction effective before the count.
  const delayedWaste = [
    ...countOnly,
    {
      ...ledgerEvent({ sequence: 2, eventType: "waste", quantity: 4, effectiveAt: "2026-08-17T11:00:00.000Z" }),
      projectionApplied: false
    }
  ];
  assert.equal(outlookFor(delayedWaste)?.countEvidence, "verified_count");
  assert.equal(outlookFor(delayedWaste)?.projectedQuantity, 10);

  // 4. An event effective exactly at the count instant is inside the baseline.
  const atBoundary = [
    ...countOnly,
    {
      ...ledgerEvent({ sequence: 2, eventType: "receipt", quantity: 6, effectiveAt: countedAt }),
      projectionApplied: false
    }
  ];
  assert.equal(outlookFor(atBoundary)?.countEvidence, "verified_count");
  assert.equal(outlookFor(atBoundary)?.projectedQuantity, 10);

  // 5. Legacy invalid ordering already reflected in current_quantity fails closed in
  //    both paths: no confident status, no recommendation, no quantity-based insight.
  const legacyApplied = [
    ...countOnly,
    {
      ...ledgerEvent({ sequence: 2, eventType: "receipt", quantity: 5, effectiveAt: "2026-08-17T12:00:00.000Z" }),
      projectionApplied: true
    }
  ];
  const legacyOutlook = outlookFor(legacyApplied);
  assert.equal(legacyOutlook?.countEvidence, "contaminated_projection");
  assert.equal(legacyOutlook?.projectedStatus, "Watch");
  assert.equal(legacyOutlook?.isTemporallyAuthoritative, false);
  const legacySignals = signalsFor(legacyApplied);
  assert.equal(legacySignals.recommendations.length, 0);
  assert.equal(lowStockProjectedQuantity(legacySignals.insights), null);

  // And a future-dated count anchor still fails closed in the same paths.
  const futureAnchor = [
    ...countOnly,
    ledgerEvent({ sequence: 2, eventType: "count", quantity: 99, effectiveAt: futureIso(7) })
  ];
  assert.equal(outlookFor(futureAnchor)?.countEvidence, "contaminated_projection");
  assert.equal(signalsFor(futureAnchor).recommendations.length, 0);
});
