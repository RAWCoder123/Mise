import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveRestaurantScopedHubLoadState } from "../services/presentation/hubLoadState";

const HUB_RESOLVER_FILES = [
  "services/presentation/todayHubPresentation.ts",
  "services/presentation/inventoryHubPresentation.ts",
  "services/presentation/ordersHubPresentation.ts",
  "services/presentation/insightsHubPresentation.ts",
  "services/presentation/recipesHubPresentation.ts",
  "services/presentation/settingsHubPresentation.ts",
  "services/presentation/posHubPresentation.ts",
  "services/presentation/suppliersHubPresentation.ts",
  "services/presentation/teamHubPresentation.ts",
  "services/presentation/gmailHubPresentation.ts",
  "services/presentation/inventoryCountPresentation.ts",
  "services/presentation/orderDetailPresentation.ts",
  "services/presentation/inventoryDetailPresentation.ts"
];

test("restaurant-scoped hub load state fails closed on soft-refresh errors", () => {
  assert.equal(
    resolveRestaurantScopedHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveRestaurantScopedHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveRestaurantScopedHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveRestaurantScopedHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveRestaurantScopedHubLoadState({
      restaurantId: null,
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
});

test("restaurant-scoped hub resolvers delegate to shared fail-closed helper", () => {
  for (const path of HUB_RESOLVER_FILES) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /resolveRestaurantScopedHubLoadState/,
      `${path} must use the shared hub load-state helper`
    );
    assert.doesNotMatch(
      source,
      /if \(input\.loadedRestaurantId === input\.restaurantId\) return "ready";\s*if \(input\.loadError\) return "error";/,
      `${path} must not prefer prior loaded data over loadError`
    );
  }
});
