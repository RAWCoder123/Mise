import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID, isRollingDemoCurrentDaySale } from "../services/demo/replaceableDemoData";
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

test("demo sales date refresh fails closed on omitted, Unicode-padded, or invalid restaurant timezones", async () => {
  // At 2026-10-31T22:30:00.000Z a valid Asia/Tokyo operating date is 2026-11-01.
  // Missing / empty / invalid / em-space-padded zones previously invented UTC
  // 2026-10-31 via `?? "UTC"` and toDateKeyInTimeZone's catch fallback.
  const when = new Date("2026-10-31T22:30:00.000Z");
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super(when.getTime());
        return;
      }
      super(value as string | number | Date);
    }
    static now() {
      return when.getTime();
    }
  }

  const repository = await demoRepository();

  async function seedWithTimezone(timezone: string | null) {
    await repository.resetDemoData(null);
    await mutateDemoState((state) => {
      if (timezone === null) {
        state.restaurants = state.restaurants.filter(
          (restaurant) => restaurant.id !== DEMO_RESTAURANT_ID
        );
        return;
      }
      const restaurant = state.restaurants.find((entry) => entry.id === DEMO_RESTAURANT_ID);
      assert.ok(restaurant);
      restaurant.timezone = timezone;
    });
  }

  async function rollingSaleDates() {
    const data = await repository.fetchRestaurantData(DEMO_RESTAURANT_ID);
    const dates = [
      ...new Set(
        data.sales
          .filter((sale) => isRollingDemoCurrentDaySale(sale.id))
          .map((sale) => sale.sale_date)
      )
    ];
    assert.ok(dates.length > 0, "demo fixtures must include rolling current-day sales");
    return dates;
  }

  (globalThis as { Date: DateConstructor }).Date = FakeDate as DateConstructor;
  try {
    await seedWithTimezone("Asia/Tokyo");
    assert.deepEqual(await rollingSaleDates(), ["2026-11-01"]);
    assert.equal(toDateKeyInTimeZone(when, "UTC"), "2026-10-31");
    assert.equal(toDateKeyInTimeZone(when, "America/New_York"), "2026-10-31");

    const padded = "\u2003Asia/Tokyo\u2003";
    assert.equal(padded.trim(), "Asia/Tokyo");
    await seedWithTimezone(padded);
    await assert.rejects(
      () => repository.fetchRestaurantData(DEMO_RESTAURANT_ID),
      /valid restaurant timezone/i
    );

    await seedWithTimezone("\u2003");
    await assert.rejects(
      () => repository.fetchRestaurantData(DEMO_RESTAURANT_ID),
      /timezone/i
    );

    await seedWithTimezone("");
    await assert.rejects(
      () => repository.fetchRestaurantData(DEMO_RESTAURANT_ID),
      /timezone/i
    );

    await seedWithTimezone(null);
    await assert.rejects(
      () => repository.fetchRestaurantData(DEMO_RESTAURANT_ID),
      /timezone/i
    );

    await seedWithTimezone("Not/A_Real_Zone");
    await assert.rejects(
      () => repository.fetchRestaurantData(DEMO_RESTAURANT_ID),
      /valid restaurant timezone/i
    );
  } finally {
    (globalThis as { Date: DateConstructor }).Date = RealDate;
  }
});
