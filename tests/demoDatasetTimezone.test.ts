import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDefaultDemoDataset,
  createInitialDemoState,
  DEMO_DATASET,
  DEMO_RESTAURANT_ID,
  DEMO_RESTAURANT_TIME_ZONE
} from "../services/demoData";
import { toDateKeyInTimeZone } from "../utils/format";

test("demo dataset rebuild fails closed on omitted, Unicode-padded, or invalid restaurant timezones", () => {
  // At 2026-10-31T22:30:00.000Z a valid Asia/Tokyo operating date is 2026-11-01.
  // Missing / empty / invalid / em-space-padded zones previously invented a
  // UTC or America/New_York calendar day via
  // `state.restaurants[0]?.timezone ?? DEMO_RESTAURANT_TIME_ZONE` and
  // toDateKeyInTimeZone's catch fallback — so current-day demo POS sales and
  // delivery history could land on 2026-10-31 while a valid Tokyo restaurant
  // would date them 2026-11-01.
  const when = new Date("2026-10-31T22:30:00.000Z");
  const createdAt = when.toISOString();

  function seedWithTimezone(timezone: string | undefined) {
    const state = createInitialDemoState("Toast", undefined, when);
    if (timezone === undefined) {
      state.restaurants = [];
    } else {
      const restaurant = state.restaurants.find((entry) => entry.id === DEMO_RESTAURANT_ID);
      assert.ok(restaurant);
      restaurant.timezone = timezone;
    }
    return applyDefaultDemoDataset(state, "Toast", createdAt, when);
  }

  function currentDaySaleDates(state: ReturnType<typeof seedWithTimezone>) {
    const dates = [
      ...new Set(
        state.posSales
          .filter((sale) => sale.id === "00000000-0000-4000-8000-000000000301")
          .map((sale) => sale.sale_date)
      )
    ];
    assert.ok(dates.length > 0, "demo dataset must seed a current-day General Tso sale");
    return dates;
  }

  const tokyo = seedWithTimezone("Asia/Tokyo");
  assert.deepEqual(currentDaySaleDates(tokyo), ["2026-11-01"]);
  assert.equal(toDateKeyInTimeZone(when, "UTC"), "2026-10-31");
  assert.equal(toDateKeyInTimeZone(when, DEMO_RESTAURANT_TIME_ZONE), "2026-10-31");
  assert.equal(DEMO_DATASET.restaurant.timezone, DEMO_RESTAURANT_TIME_ZONE);

  const padded = "\u2003Asia/Tokyo\u2003";
  assert.equal(padded.trim(), "Asia/Tokyo");
  assert.throws(
    () => seedWithTimezone(padded),
    /Demo dataset rebuild requires a valid restaurant timezone/
  );
  assert.throws(
    () => seedWithTimezone("\u2003"),
    /Demo dataset rebuild requires a restaurant timezone/
  );
  assert.throws(
    () => seedWithTimezone(""),
    /Demo dataset rebuild requires a restaurant timezone/
  );
  assert.throws(
    () => seedWithTimezone(undefined),
    /Demo dataset rebuild requires a restaurant timezone/
  );
  assert.throws(
    () => seedWithTimezone("Not/A_Real_Zone"),
    /Demo dataset rebuild requires a valid restaurant timezone/
  );

  // Happy path through createInitialDemoState still seeds with the dataset zone.
  const seeded = createInitialDemoState("Toast", { preset: DEMO_DATASET.id }, when);
  assert.equal(seeded.restaurants[0]?.timezone, DEMO_RESTAURANT_TIME_ZONE);
  assert.deepEqual(currentDaySaleDates(seeded), ["2026-10-31"]);
});
