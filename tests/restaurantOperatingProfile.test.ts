import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addCustomProfileString,
  buildRestaurantOperatingProfilePatch,
  draftFromOperatingProfile,
  normalizeOperatingProfileDay,
  operatingProfileChanged,
  removeProfileString,
  toggleOrderedString
} from "../services/domain/restaurantOperatingProfile";
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
      orderCadence: ["Monday", "Thursday"],
      prepWindows: ["Pre-service count"],
      primarySuppliers: ["North Market", "Farm Co."],
      inventoryReviewDays: ["Mon", "Thu"],
      notes: "Lean ordering"
    },
    created_at: "2026-08-02T00:00:00.000Z",
    ...overrides
  };
}

test("normalizeOperatingProfileDay maps full weekday names to short tokens", () => {
  assert.equal(normalizeOperatingProfileDay("Monday"), "Mon");
  assert.equal(normalizeOperatingProfileDay(" thu "), "Thu");
  assert.equal(normalizeOperatingProfileDay("Custom window"), "Custom window");
});

test("draftFromOperatingProfile normalizes cadence aliases and preserves prep windows", () => {
  const draft = draftFromOperatingProfile(sampleRestaurant());
  assert.deepEqual(draft.orderCadence, ["Mon", "Thu"]);
  assert.deepEqual(draft.inventoryReviewDays, ["Mon", "Thu"]);
  assert.deepEqual(draft.prepWindows, ["Pre-service count"]);
  assert.equal(draft.notes, "Lean ordering");
});

test("buildRestaurantOperatingProfilePatch preserves primary suppliers and mirrors service style", () => {
  const restaurant = sampleRestaurant({ service_style: "full_service" });
  const draft = draftFromOperatingProfile(restaurant);
  const patch = buildRestaurantOperatingProfilePatch(restaurant, {
    ...draft,
    orderCadence: ["Tue", "Fri"],
    prepWindows: ["AM prep", "Close count"],
    inventoryReviewDays: ["Wed"],
    notes: "  Balanced  "
  });

  assert.ok(patch);
  assert.deepEqual(patch?.operational_profile, {
    serviceStyle: "full_service",
    orderCadence: ["Tue", "Fri"],
    prepWindows: ["AM prep", "Close count"],
    primarySuppliers: ["North Market", "Farm Co."],
    inventoryReviewDays: ["Wed"],
    notes: "Balanced"
  });
});

test("buildRestaurantOperatingProfilePatch returns null when nothing changed", () => {
  const restaurant = sampleRestaurant({
    operational_profile: {
      serviceStyle: "fast_casual",
      orderCadence: ["Mon", "Thu"],
      prepWindows: ["Pre-service count"],
      primarySuppliers: ["North Market", "Farm Co."],
      inventoryReviewDays: ["Mon", "Thu"],
      notes: "Lean ordering"
    }
  });
  const draft = draftFromOperatingProfile(restaurant);
  assert.equal(buildRestaurantOperatingProfilePatch(restaurant, draft), null);
  assert.equal(
    operatingProfileChanged(restaurant.operational_profile, restaurant.operational_profile),
    false
  );
});

test("toggleOrderedString and custom prep helpers respect list limits", () => {
  assert.deepEqual(toggleOrderedString(["Mon"], "Thu"), ["Mon", "Thu"]);
  assert.deepEqual(toggleOrderedString(["Mon", "Thu"], "Mon"), ["Thu"]);
  assert.deepEqual(addCustomProfileString(["AM prep"], " Dinner reset "), [
    "AM prep",
    "Dinner reset"
  ]);
  assert.deepEqual(removeProfileString(["AM prep", "Dinner reset"], "AM prep"), [
    "Dinner reset"
  ]);
  assert.throws(
    () => addCustomProfileString(["a"], "x".repeat(161)),
    /160 characters/
  );
});
