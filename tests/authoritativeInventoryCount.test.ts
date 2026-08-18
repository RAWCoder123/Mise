import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COUNT_BOUNDARY_RULE,
  buildInventoryCountEvidence,
  dayResolutionConsumptionIsAfterCount,
  isStrictlyAfterCount,
  missingInventoryCountEvidence,
  projectAuthoritativeOnHand,
  resolveVerifiedInventoryCount,
  verifiedCountSupersedes,
  withPendingCountEvidence,
  type AuthoritativeConsumptionEntry,
  type InventoryCountEvidence,
  type VerifiedCountCandidate
} from "../services/domain/inventoryCountAuthority";
import { projectInventoryEvents, type InventoryEvent } from "../services/domain/inventoryLedger";
import { buildInventoryPrediction, shouldSuppressRecommendationForItem } from "../services/domain/miseDomain";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import type { InventoryItem, MenuItemIngredient, PosSale, PurchaseRecommendation } from "../types/mise";

const restaurantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const restaurantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "item-chicken";
const operatingDate = "2026-08-17";

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
    countEvents: events,
    generatedAt: options.generatedAt ?? "2026-08-17T18:00:00.000Z"
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
}) {
  return projectAuthoritativeOnHand({
    restaurantId: input.restaurantId ?? restaurantA,
    inventoryItemId: itemId,
    evidence: input.evidence,
    movements: input.movements,
    consumption: input.consumption
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
      source_pos: "Square",
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
    inventoryCountEvents: [countEvent("2026-08-17T13:00:00.000Z", 12)]
  });
  // 12 counted at 13:00 stays 12; the morning's 4 lb is not subtracted again.
  assert.equal(lowStockProjectedQuantity(middayCounted.insights), 12);

  const countedYesterday = calculateOperationalSignals({
    ...snapshotBase,
    inventoryCountEvents: [countEvent("2026-08-16T13:00:00.000Z", 12)]
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
    inventoryCountEvents: [countEvent("2026-08-17T08:00:00.000Z", 12)]
  });
  assert.equal(stillSuppressed.recommendations.length, 0);

  const recounted = calculateOperationalSignals({
    ...snapshotBase,
    recommendationHistory: [handled],
    inventoryCountEvents: [countEvent("2026-08-17T13:00:00.000Z", 12)]
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
    countEvents: [countEvent("2026-08-17T08:00:00.000Z", 20)]
  });
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, edited, [handled], beforeEvidence), true);
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, edited, [handled]), true);

  const afterEvidence = buildInventoryCountEvidence({
    restaurantId: restaurantA,
    items: [edited],
    countEvents: [countEvent("2026-08-17T14:00:00.000Z", 20)]
  });
  assert.equal(shouldSuppressRecommendationForItem(restaurantA, edited, [handled], afterEvidence), false);

  // Evidence from another tenant is ignored rather than trusted.
  const foreignEvidence = buildInventoryCountEvidence({
    restaurantId: restaurantB,
    items: [item({ restaurant_id: restaurantB })],
    countEvents: [countEvent("2026-08-17T14:00:00.000Z", 20, { restaurantId: restaurantB })]
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
  assert.match(migration, /'inventoryCountEvents'/);
  assert.match(migration, /'timeZone'/);
  assert.match(
    migration,
    /distinct\s+on\s*\(event\.inventory_item_id\)[\s\S]*event_type\s*=\s*'count'[\s\S]*order\s+by\s+event\.inventory_item_id,\s*event\.effective_at\s+desc,\s*event\.sequence\s+desc/i
  );
  assert.match(migration, /where\s+event\.restaurant_id\s*=\s*p_restaurant_id/i);
  // No privilege, policy, or RLS relaxation rides along with this read-only change.
  assert.doesNotMatch(migration, /\bgrant\b/i);
  assert.doesNotMatch(migration, /create\s+policy|drop\s+policy|disable\s+row\s+level\s+security/i);

  assert.match(edgeWorkflow, /withPendingCountEvidence\(snapshot\.inventoryCountEvents/);
  assert.match(signals, /inventoryCountEvents\?:\s*readonly\s+VerifiedCountCandidate\[\]/);
  // Planning depletion no longer reads the generic row mutation timestamp.
  assert.doesNotMatch(signals, /Date\.parse\(item\.last_updated\)/);
});
