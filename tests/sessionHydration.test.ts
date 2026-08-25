import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Restaurant, RestaurantMembership } from "../types/mise";
import {
  EmptyWorkspaceHydrationError,
  PreferredWorkspaceHydrationError,
  resolveMultiMembershipHydration,
  settleMembershipRestaurantFetches
} from "../services/domain/sessionHydration";

function membership(
  restaurantId: string,
  overrides?: Partial<RestaurantMembership>
): RestaurantMembership {
  return {
    id: `membership_${restaurantId}`,
    restaurant_id: restaurantId,
    user_id: "user_1",
    role: "owner",
    status: "active",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

function restaurant(id: string, name = id): Restaurant {
  return {
    id,
    name,
    address: null,
    cuisine_type: "American",
    brand_color: "#111111",
    accent_color: "#E4572E",
    logo_url: null,
    service_style: "fast_casual",
    timezone: "America/New_York",
    currency: "USD",
    operational_profile: {
      serviceStyle: "fast_casual",
      orderCadence: ["monday", "thursday"],
      prepWindows: ["am"],
      primarySuppliers: ["Sysco"],
      inventoryReviewDays: ["sunday"],
      notes: null
    },
    created_at: "2026-08-01T00:00:00.000Z"
  };
}

test("settleMembershipRestaurantFetches preserves membership order and rejection reasons", () => {
  const memberships = [membership("r1"), membership("r2")];
  const results: PromiseSettledResult<Restaurant>[] = [
    { status: "fulfilled", value: restaurant("r1", "Alpha") },
    { status: "rejected", reason: new Error("denied") }
  ];

  const settlements = settleMembershipRestaurantFetches(memberships, results);
  assert.equal(settlements.length, 2);
  assert.equal(settlements[0]?.status, "fulfilled");
  assert.equal(settlements[1]?.status, "rejected");
  if (settlements[1]?.status === "rejected") {
    assert.match(String(settlements[1].error), /denied/);
  }
});

test("resolveMultiMembershipHydration drops failed non-preferred workspaces", () => {
  const memberships = [membership("r1"), membership("r2"), membership("r3")];
  const settlements = settleMembershipRestaurantFetches(memberships, [
    { status: "rejected", reason: new Error("orphan") },
    { status: "fulfilled", value: restaurant("r2", "Beta") },
    { status: "fulfilled", value: restaurant("r3", "Gamma") }
  ]);

  const resolved = resolveMultiMembershipHydration({
    memberships,
    settlements,
    preferredRestaurantId: null
  });

  assert.deepEqual(
    resolved.availableRestaurants.map((item) => item.id),
    ["r2", "r3"]
  );
  assert.deepEqual(resolved.droppedRestaurantIds, ["r1"]);
  assert.equal(resolved.activeRestaurant.id, "r2");
  assert.equal(resolved.activeMembership.restaurant_id, "r2");
});

test("resolveMultiMembershipHydration keeps preferred workspace when siblings fail", () => {
  const memberships = [membership("r1"), membership("r2")];
  const settlements = settleMembershipRestaurantFetches(memberships, [
    { status: "fulfilled", value: restaurant("r1", "Alpha") },
    { status: "rejected", reason: new Error("timeout") }
  ]);

  const resolved = resolveMultiMembershipHydration({
    memberships,
    settlements,
    preferredRestaurantId: "r1"
  });

  assert.equal(resolved.activeRestaurant.id, "r1");
  assert.deepEqual(resolved.droppedRestaurantIds, ["r2"]);
  assert.deepEqual(
    resolved.availableRestaurants.map((item) => item.id),
    ["r1"]
  );
});

test("resolveMultiMembershipHydration fail-closes when preferred workspace cannot load", () => {
  const memberships = [membership("r1"), membership("r2")];
  const settlements = settleMembershipRestaurantFetches(memberships, [
    { status: "rejected", reason: new Error("rls") },
    { status: "fulfilled", value: restaurant("r2", "Beta") }
  ]);

  assert.throws(
    () =>
      resolveMultiMembershipHydration({
        memberships,
        settlements,
        preferredRestaurantId: "r1"
      }),
    (error: unknown) =>
      error instanceof PreferredWorkspaceHydrationError && error.restaurantId === "r1"
  );
});

test("resolveMultiMembershipHydration fail-closes when every restaurant fetch fails", () => {
  const memberships = [membership("r1"), membership("r2")];
  const settlements = settleMembershipRestaurantFetches(memberships, [
    { status: "rejected", reason: new Error("a") },
    { status: "rejected", reason: new Error("b") }
  ]);

  assert.throws(
    () =>
      resolveMultiMembershipHydration({
        memberships,
        settlements,
        preferredRestaurantId: null
      }),
    (error: unknown) => error instanceof EmptyWorkspaceHydrationError
  );
});

test("stale preferred restaurant without membership falls back to first loadable workspace", () => {
  const memberships = [membership("r1"), membership("r2")];
  const settlements = settleMembershipRestaurantFetches(memberships, [
    { status: "rejected", reason: new Error("gone") },
    { status: "fulfilled", value: restaurant("r2", "Beta") }
  ]);

  const resolved = resolveMultiMembershipHydration({
    memberships,
    settlements,
    preferredRestaurantId: "missing_restaurant"
  });

  assert.equal(resolved.activeRestaurant.id, "r2");
});

test("session hydration uses allSettled and selective workspace resolution", () => {
  const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
  assert.match(session, /Promise\.allSettled/);
  assert.match(session, /settleMembershipRestaurantFetches/);
  assert.match(session, /resolveMultiMembershipHydration/);
  assert.match(session, /operation:\s*"restaurant_fetch"/);
  assert.doesNotMatch(
    session,
    /const restaurants = await Promise\.all\(\s*nextMemberships\.map\(\(membership\) => fetchRestaurant/
  );
});
