import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RESTAURANT_BRAND_COLOR_PRESETS,
  buildRestaurantIdentityPatch,
  draftFromRestaurant,
  isValidRestaurantHexColor,
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
    currency: "CAD",
    brand_color: "#f5222d",
    accent_color: "#357B45",
    logo_url: " https://cdn.example.com/harbor.png "
  });

  assert.deepEqual(patch, {
    name: "Harbor Kitchen",
    address: null,
    cuisine_type: "Seafood",
    service_style: "full_service",
    timezone: "America/Los_Angeles",
    currency: "CAD",
    brand_color: "#F5222D",
    accent_color: "#357B45",
    logo_url: "https://cdn.example.com/harbor.png"
  });
  assert.equal(restaurantIdentityChanged(patch), true);
});

test("buildRestaurantIdentityPatch clears logo and ignores case-only hex changes", () => {
  const restaurant = sampleRestaurant({
    brand_color: "#ef3f27",
    logo_url: "https://cdn.example.com/old.png"
  });
  const draft = draftFromRestaurant(restaurant);
  assert.equal(
    restaurantIdentityChanged(
      buildRestaurantIdentityPatch(restaurant, {
        ...draft,
        brand_color: "#EF3F27"
      })
    ),
    false
  );

  const cleared = buildRestaurantIdentityPatch(restaurant, {
    ...draft,
    logo_url: "   "
  });
  assert.deepEqual(cleared, { logo_url: null });
});

test("restaurantIdentityOptions keeps uncommon current values and brand presets selectable", () => {
  const restaurant = sampleRestaurant({
    timezone: "Pacific/Honolulu",
    currency: "NZD",
    brand_color: "#ABCDEF",
    accent_color: "#123456"
  });
  const options = restaurantIdentityOptions(restaurant);
  assert.equal(options.timezones[0], "Pacific/Honolulu");
  assert.equal(options.currencies[0], "NZD");
  assert.equal(options.brandColors[0], "#ABCDEF");
  assert.ok(options.brandColors.includes("#123456"));
  assert.ok(options.brandColors.includes(RESTAURANT_BRAND_COLOR_PRESETS[0]));
  assert.ok(options.timezones.includes("America/New_York"));
  assert.ok(options.currencies.includes("USD"));
  assert.ok(options.serviceStyles.includes("ghost_kitchen"));
});

test("isValidRestaurantHexColor accepts only six-digit hex colors", () => {
  assert.equal(isValidRestaurantHexColor("#EF3F27"), true);
  assert.equal(isValidRestaurantHexColor(" #1f7a4d "), true);
  assert.equal(isValidRestaurantHexColor("#FFF"), false);
  assert.equal(isValidRestaurantHexColor("EF3F27"), false);
  assert.equal(isValidRestaurantHexColor("red"), false);
});
