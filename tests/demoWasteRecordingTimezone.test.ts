import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";
import { mutateDemoState } from "../services/localStore";
import { toDateKeyInTimeZone } from "../utils/format";

async function demoRepository() {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };
  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  return repository;
}

test("demo waste recording fails closed on omitted, Unicode-padded, or invalid restaurant timezones", async () => {
  // Two waste events at 2026-10-31T10:00Z and 2026-10-31T22:30Z fall on
  // Asia/Tokyo calendar days 2026-10-31 and 2026-11-01 (distinct → repeated
  // waste attention). Missing / empty / invalid / em-space-padded zones
  // previously invented UTC 2026-10-31 for both via `?? "UTC"` and
  // toDateKeyInTimeZone's catch fallback, collapsing the window and suppressing
  // the "Waste pattern needs review" attention signal.
  const firstEffectiveAt = "2026-10-31T10:00:00.000Z";
  const secondEffectiveAt = "2026-10-31T22:30:00.000Z";
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

  const repository = await demoRepository();

  async function seedWithTimezone(timezone: string | null) {
    await repository.resetDemoData(null);
    await mutateDemoState((state) => {
      const restaurant = state.restaurants.find((entry) => entry.id === DEMO_RESTAURANT_ID);
      assert.ok(restaurant);
      // Null survives repairDemoState's seed spread and still hits `?? "UTC"`.
      // Deleting the key is rewritten back to the seeded IANA identity on read.
      restaurant.timezone = timezone as string;
    });
  }

  async function verifiedItem() {
    const data = await repository.fetchRestaurantData(DEMO_RESTAURANT_ID);
    const item = data.inventoryItems.find(
      (entry) =>
        entry.canonical_unit_verification_status === "verified" &&
        entry.canonical_unit &&
        Number(entry.canonical_quantity_per_unit) > 0
    );
    assert.ok(item);
    return item;
  }

  async function recordWaste(
    item: Awaited<ReturnType<typeof verifiedItem>>,
    clientEventId: string,
    effectiveAt: string
  ) {
    return repository.recordInventoryEvent({
      restaurantId: DEMO_RESTAURANT_ID,
      inventoryItemId: item.id,
      eventType: "waste",
      quantity: 100,
      canonicalUnit: item.canonical_unit!,
      effectiveAt,
      source: "manual_adjustment",
      sourceReference: null,
      reasonCode: null,
      clientEventId,
      idempotencyKey: clientEventId,
      supersedesEventId: null,
      metadata: {}
    });
  }

  async function latestWasteActivity(itemId: string) {
    const state = await mutateDemoState((current) => current);
    const events = (state.activityEvents ?? []).filter(
      (event) =>
        event.relatedEntityId === itemId && event.activityType === "waste_analysis_completed"
    );
    return events[events.length - 1] ?? null;
  }

  await seedWithTimezone("Asia/Tokyo");
  const tokyoItem = await verifiedItem();
  assert.equal((await recordWaste(tokyoItem, "waste-tokyo-1", firstEffectiveAt)).status, "accepted");
  assert.equal((await recordWaste(tokyoItem, "waste-tokyo-2", secondEffectiveAt)).status, "accepted");
  const tokyoActivity = await latestWasteActivity(tokyoItem.id);
  assert.ok(tokyoActivity);
  assert.equal(tokyoActivity.title, "Waste pattern needs review");
  assert.equal(tokyoActivity.requiresAttention, true);
  assert.equal(tokyoActivity.metadata?.repeatedRecently, true);

  const padded = "\u2003Asia/Tokyo\u2003";
  assert.equal(padded.trim(), "Asia/Tokyo");
  await seedWithTimezone(padded);
  const paddedItem = await verifiedItem();
  await assert.rejects(
    () => recordWaste(paddedItem, "waste-padded-1", secondEffectiveAt),
    /valid restaurant timezone/i
  );

  await seedWithTimezone("\u2003");
  const whitespaceItem = await verifiedItem();
  await assert.rejects(
    () => recordWaste(whitespaceItem, "waste-whitespace-1", secondEffectiveAt),
    /timezone/i
  );

  await seedWithTimezone("");
  const emptyItem = await verifiedItem();
  await assert.rejects(
    () => recordWaste(emptyItem, "waste-empty-1", secondEffectiveAt),
    /timezone/i
  );

  await seedWithTimezone(null);
  const omittedItem = await verifiedItem();
  await assert.rejects(
    () => recordWaste(omittedItem, "waste-omitted-1", secondEffectiveAt),
    /timezone/i
  );

  await seedWithTimezone("Not/A_Real_Zone");
  const invalidItem = await verifiedItem();
  await assert.rejects(
    () => recordWaste(invalidItem, "waste-invalid-1", secondEffectiveAt),
    /valid restaurant timezone/i
  );
});
