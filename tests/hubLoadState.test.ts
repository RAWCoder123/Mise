import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../services/presentation/hubLoadState";

const HUB_CONSUMER_FILES = [
  "app/(tabs)/today.tsx",
  "app/(tabs)/inventory.tsx",
  "app/(tabs)/orders.tsx",
  "app/(tabs)/insights.tsx",
  "app/(tabs)/settings.tsx",
  "app/settings/recipes.tsx",
  "app/settings/team.tsx",
  "app/settings/suppliers.tsx",
  "app/settings/gmail.tsx",
  "app/settings/autonomy.tsx",
  "app/settings/pos.tsx",
  "app/inventory/[id].tsx",
  "app/orders/[id].tsx",
  "app/more/restaurant-memory.tsx",
  "app/more/log-delivery.tsx",
  "app/more/create-task.tsx"
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

test("restaurant-scoped hub consumers use the shared fail-closed helper", () => {
  for (const path of HUB_CONSUMER_FILES) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /resolveRestaurantScopedHubLoadState/,
      `${path} must use the shared hub load-state helper`
    );
    assert.match(
      source,
      /hubReady/,
      `${path} must derive hub readiness before rendering restaurant-scoped data`
    );
    assert.doesNotMatch(
      source,
      /if \(input\.loadedRestaurantId === input\.restaurantId\) return "ready";\s*if \(input\.loadError\) return "error";/,
      `${path} must not prefer prior loaded data over loadError`
    );
  }

  const helper = readFileSync("services/presentation/hubLoadState.ts", "utf8");
  assert.match(
    helper,
    /if \(input\.loadError\) return "error";\s*if \(input\.loadedRestaurantId === input\.restaurantId\) return "ready";/
  );
});

test("restaurant-scoped hub actions stay non-editable until the hub is ready", () => {
  assert.equal(
    presentRestaurantScopedHubActionsEditable({
      allowed: true,
      hubReady: true,
      busy: false
    }),
    true
  );
  assert.equal(
    presentRestaurantScopedHubActionsEditable({
      allowed: true,
      hubReady: false,
      busy: false
    }),
    false
  );
  assert.equal(
    presentRestaurantScopedHubActionsEditable({
      allowed: false,
      hubReady: true,
      busy: false
    }),
    false
  );
  assert.equal(
    presentRestaurantScopedHubActionsEditable({
      allowed: true,
      hubReady: true,
      busy: true
    }),
    false
  );
  assert.equal(
    presentRestaurantScopedHubActionsEditable({
      allowed: true,
      hubReady: true
    }),
    true
  );
});

test("recipes preserve ingredient quantity drafts on soft-refresh fail-closed", () => {
  const source = readFileSync("app/settings/recipes.tsx", "utf8");
  assert.match(source, /hasLoadedRef/);
  assert.match(
    source,
    /const soft = hasLoadedRef\.current && activeRestaurantIdRef\.current === restaurantId/
  );
  assert.match(
    source,
    /\/\/ Invalidate readiness during soft refresh so mutations stay closed until proof returns\.\s*setLoadedRestaurantId\(null\);/
  );
  assert.match(
    source,
    /\/\/ Soft refresh must preserve operator-entered ingredient quantity and builder drafts\.\s*if \(soft\) \{/
  );
  assert.match(
    source,
    /ingredient\.mappingId in current\s*\?\s*current\[ingredient\.mappingId\]!\s*:\s*formatNumber\(ingredient\.quantityUsedPerSale\)/
  );
  assert.match(
    source,
    /\/\/ Fail closed for display\/actions, but keep local drafts and prior baselines for retry\.\s*setHubLoadError\(true\);/
  );
  assert.match(source, /if \(!soft\) \{\s*setSummary\(null\);\s*setInventoryItems\(\[\]\);\s*\}/);
  assert.match(source, /hasLoadedRef\.current = false/);
  assert.match(source, /setDraftQuantities\(\{\}\)/);
  assert.match(source, /setNewMenuItemName\(""\)/);
  assert.match(source, /setNewInventoryItemName\(""\)/);
  assert.match(source, /setNewQuantity\("1"\)/);
  assert.doesNotMatch(
    source,
    /setDrafts\(\s*Object\.fromEntries\(item\.ingredients\.map/,
    "RecipeRow must not reseed local drafts from item on every summary refresh"
  );
});
