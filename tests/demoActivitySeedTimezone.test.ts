import assert from "node:assert/strict";
import test from "node:test";

import { seedDemoActivityFromState } from "../services/demo/demoActivity";
import type { DemoState } from "../services/demo/replaceableDemoData";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import { toDateKeyInTimeZone } from "../utils/format";

const restaurantId = "rest-demo-activity-tz";
const itemId = "item-peppers";

const firstEffectiveAt = "2026-10-31T10:00:00.000Z";
const secondEffectiveAt = "2026-10-31T22:30:00.000Z";

function wasteEvent(id: string, sequence: number, effectiveAt: string): InventoryEvent {
  return {
    id,
    sequence,
    restaurantId,
    inventoryItemId: itemId,
    eventType: "waste",
    quantity: 1,
    canonicalUnit: "each",
    effectiveAt,
    recordedAt: effectiveAt,
    actorUserId: "user-demo",
    source: "manual_adjustment",
    sourceReference: null,
    reasonCode: null,
    clientEventId: `client:${id}`,
    idempotencyKey: `idem:${id}`,
    supersedesEventId: null,
    metadata: {}
  };
}

function stateWithTimezone(timezone: string | null | undefined): DemoState {
  return {
    schema_version: 1,
    currentRestaurantId: restaurantId,
    restaurants: [
      {
        id: restaurantId,
        name: "Timezone Fixture",
        timezone: timezone as string
      }
    ],
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: restaurantId,
        item_name: "Bell peppers",
        unit: "each",
        current_quantity: 10,
        par_level: 5,
        cost_per_unit: 1,
        supplier_id: null,
        supplier_name: null,
        last_updated: secondEffectiveAt
      }
    ],
    inventoryEvents: [
      wasteEvent("waste-1", 1, firstEffectiveAt),
      wasteEvent("waste-2", 2, secondEffectiveAt)
    ],
    purchaseRecommendations: [],
    supplierOrders: [],
    activityEvents: []
  } as unknown as DemoState;
}

function latestWasteActivity(state: DemoState) {
  const events = (state.activityEvents ?? []).filter(
    (event) => event.activityType === "waste_analysis_completed"
  );
  return events[events.length - 1] ?? null;
}

test("demo activity seed fails closed on omitted, Unicode-padded, or invalid restaurant timezones", () => {
  // Two waste events at 2026-10-31T10:00Z and 2026-10-31T22:30Z fall on
  // Asia/Tokyo calendar days 2026-10-31 and 2026-11-01 (distinct → repeated
  // waste attention). Missing / empty / invalid / em-space-padded zones
  // previously invented UTC 2026-10-31 for both via `?? "UTC"` and
  // toDateKeyInTimeZone's catch fallback, collapsing the window and suppressing
  // the "Waste pattern needs review" attention signal during activity seed.
  assert.equal(toDateKeyInTimeZone(new Date(firstEffectiveAt), "Asia/Tokyo"), "2026-10-31");
  assert.equal(toDateKeyInTimeZone(new Date(secondEffectiveAt), "Asia/Tokyo"), "2026-11-01");
  assert.equal(toDateKeyInTimeZone(new Date(secondEffectiveAt), "UTC"), "2026-10-31");
  assert.equal(
    toDateKeyInTimeZone(new Date(secondEffectiveAt), "\u2003Asia/Tokyo\u2003"),
    "2026-10-31"
  );
  assert.equal(
    toDateKeyInTimeZone(new Date(secondEffectiveAt), "Not/A_Real_Zone"),
    "2026-10-31"
  );

  const tokyo = stateWithTimezone("Asia/Tokyo");
  seedDemoActivityFromState(tokyo);
  const tokyoActivity = latestWasteActivity(tokyo);
  assert.ok(tokyoActivity);
  assert.equal(tokyoActivity.title, "Waste pattern needs review");
  assert.equal(tokyoActivity.requiresAttention, true);
  assert.equal(tokyoActivity.metadata?.repeatedRecently, true);

  const inventingUtc = stateWithTimezone(null);
  // Pre-fix baseline: null/missing timezone previously defaulted to UTC and
  // suppressed repeated-waste attention for the same two instants.
  const priorTimeZone =
    inventingUtc.restaurants.map((restaurant) => [restaurant.id, restaurant.timezone] as const)
      .find(([id]) => id === restaurantId)?.[1] ?? "UTC";
  assert.equal(priorTimeZone, "UTC");
  assert.equal(toDateKeyInTimeZone(new Date(firstEffectiveAt), priorTimeZone), "2026-10-31");
  assert.equal(toDateKeyInTimeZone(new Date(secondEffectiveAt), priorTimeZone), "2026-10-31");

  const padded = "\u2003Asia/Tokyo\u2003";
  assert.equal(padded.trim(), "Asia/Tokyo");
  assert.throws(
    () => seedDemoActivityFromState(stateWithTimezone(padded)),
    /valid restaurant timezone/i
  );

  assert.throws(
    () => seedDemoActivityFromState(stateWithTimezone("\u2003")),
    /timezone/i
  );

  assert.throws(
    () => seedDemoActivityFromState(stateWithTimezone("")),
    /timezone/i
  );

  assert.throws(
    () => seedDemoActivityFromState(stateWithTimezone(null)),
    /timezone/i
  );

  assert.throws(
    () => seedDemoActivityFromState(stateWithTimezone(undefined)),
    /timezone/i
  );

  assert.throws(
    () => seedDemoActivityFromState(stateWithTimezone("Not/A_Real_Zone")),
    /valid restaurant timezone/i
  );

  // Restaurant absent from the demo restaurant list previously hit `?? "UTC"`
  // and invented the same collapsed window. Fail closed instead.
  const orphan = stateWithTimezone("Asia/Tokyo");
  orphan.restaurants = [];
  assert.throws(() => seedDemoActivityFromState(orphan), /timezone/i);
});
