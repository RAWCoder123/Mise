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

test("inventory detail preserves par/reorder drafts on soft-refresh fail-closed", () => {
  const source = readFileSync("app/inventory/[id].tsx", "utf8");
  assert.match(source, /const \[hubLoadError, setHubLoadError\]/);
  assert.match(source, /loadError:\s*hubLoadError/);
  assert.match(source, /hasLoadedRef/);
  assert.match(source, /loadedItemIdRef/);
  assert.match(source, /const soft = hasLoadedRef\.current && loadedItemIdRef\.current === itemId/);
  assert.match(
    source,
    /\/\/ Soft refresh must preserve operator-entered par\/reorder and ops drafts\.\s*if \(nextOutlook && !soft\)/
  );
  assert.match(
    source,
    /\/\/ Fail closed for display\/actions, but keep local drafts and prior outlook for retry\.\s*setHubLoadError\(true\);/
  );
  assert.match(source, /if \(!soft\) \{\s*setOutlook\(null\);\s*setQueueEntries\(\[\]\);\s*\}/);
  assert.match(source, /hasLoadedRef\.current = false/);
  assert.match(source, /setParLevel\(""\)/);
  assert.match(source, /setReorderThreshold\(""\)/);
  assert.match(source, /RetryNotice/);
  assert.doesNotMatch(
    source,
    /setHubLoadError\(false\);\s*if \(nextOutlook\) \{\s*setParLevel/,
    "hard-path seeding must not run unconditionally after every successful load"
  );
});
