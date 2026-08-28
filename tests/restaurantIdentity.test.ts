import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRestaurantIdentityPatch,
  draftFromRestaurant,
  restaurantIdentityChanged,
  restaurantIdentityOptions
} from "../services/domain/restaurantIdentity";
import type { Restaurant } from "../types/mise";

function sampleRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "restaurant_1",
    name: "Harbor Table",
    address: "12 Market Street",
    cuisine_type: "Coastal American",
    brand_color: "#EF3F27",
    accent_color: "#1F7A4D",
    logo_url: null,
    service_style: "fast_casual",
    timezone: "America/New_York",
    currency: "USD",
    operational_profile: {
      serviceStyle: "fast_casual",
      orderCadence: ["Tue", "Fri"],
      prepWindows: ["Lunch"],
      primarySuppliers: ["North Market"],
      inventoryReviewDays: ["Mon"],
      notes: null
    },
    created_at: "2026-08-02T00:00:00.000Z",
    ...overrides
  };
}

test("buildRestaurantIdentityPatch emits only changed identity fields", () => {
  const restaurant = sampleRestaurant();
  const draft = draftFromRestaurant(restaurant);
  assert.equal(restaurantIdentityChanged(buildRestaurantIdentityPatch(restaurant, draft)), false);

  const patch = buildRestaurantIdentityPatch(restaurant, {
    ...draft,
    name: " Harbor Kitchen ",
    address: "",
    cuisine_type: " Seafood ",
    service_style: "full_service",
    timezone: "America/Los_Angeles",
    currency: "CAD"
  });

  assert.deepEqual(patch, {
    name: "Harbor Kitchen",
    address: null,
    cuisine_type: "Seafood",
    service_style: "full_service",
    timezone: "America/Los_Angeles",
    currency: "CAD"
  });
  assert.equal(restaurantIdentityChanged(patch), true);
});

test("restaurantIdentityOptions keeps uncommon current timezone and currency selectable", () => {
  const restaurant = sampleRestaurant({
    timezone: "Pacific/Honolulu",
    currency: "NZD"
  });
  const options = restaurantIdentityOptions(restaurant);
  assert.equal(options.timezones[0], "Pacific/Honolulu");
  assert.equal(options.currencies[0], "NZD");
  assert.ok(options.timezones.includes("America/New_York"));
  assert.ok(options.currencies.includes("USD"));
  assert.ok(options.serviceStyles.includes("ghost_kitchen"));
});
