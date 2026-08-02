import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentInventoryHubHealthCopy,
  presentInventoryHubListEmptyCopy,
  resolveInventoryHubLoadState
} from "../services/presentation/inventoryHubPresentation";

const inventoryHub = readFileSync("app/(tabs)/inventory.tsx", "utf8");
const inventoryDetail = readFileSync("app/inventory/[id].tsx", "utf8");

test("inventory hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveInventoryHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveInventoryHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveInventoryHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveInventoryHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
});

test("inventory health and list copy never claim empty stock while loading or failed", () => {
  const loadingHealth = presentInventoryHubHealthCopy("loading", {
    loading: "Loading inventory health…",
    unavailable: "Inventory health unavailable"
  });
  assert.equal(loadingHealth.ready, false);
  assert.equal(loadingHealth.message, "Loading inventory health…");

  const errorHealth = presentInventoryHubHealthCopy("error", {
    loading: "Loading inventory health…",
    unavailable: "Inventory health unavailable"
  });
  assert.equal(errorHealth.ready, false);
  assert.equal(errorHealth.message, "Inventory health unavailable");
  assert.doesNotMatch(errorHealth.message ?? "", /no items|well stocked/i);

  const readyHealth = presentInventoryHubHealthCopy("ready", {
    loading: "Loading inventory health…",
    unavailable: "Inventory health unavailable"
  });
  assert.equal(readyHealth.ready, true);
  assert.equal(readyHealth.message, null);

  const loadingList = presentInventoryHubListEmptyCopy(
    "loading",
    { hasStationFilter: false },
    {
      loadingTitle: "Loading stock list…",
      loadingBody: "Refreshing coverage",
      unavailableTitle: "Stock list unavailable",
      unavailableBody: "Retry to refresh",
      emptyTitle: "No inventory matches",
      emptyBody: "Try a different search",
      stationEmptyBody: "No stocked items at this station"
    }
  );
  assert.equal(loadingList.title, "Loading stock list…");
  assert.doesNotMatch(loadingList.title, /no inventory matches/i);

  const errorList = presentInventoryHubListEmptyCopy(
    "error",
    { hasStationFilter: true },
    {
      loadingTitle: "Loading stock list…",
      loadingBody: "Refreshing coverage",
      unavailableTitle: "Stock list unavailable",
      unavailableBody: "Retry to refresh",
      emptyTitle: "No inventory matches",
      emptyBody: "Try a different search",
      stationEmptyBody: "No stocked items at this station"
    }
  );
  assert.equal(errorList.title, "Stock list unavailable");
  assert.equal(errorList.body, "Retry to refresh");

  const readyStationEmpty = presentInventoryHubListEmptyCopy(
    "ready",
    { hasStationFilter: true },
    {
      loadingTitle: "Loading stock list…",
      loadingBody: "Refreshing coverage",
      unavailableTitle: "Stock list unavailable",
      unavailableBody: "Retry to refresh",
      emptyTitle: "No inventory matches",
      emptyBody: "Try a different search",
      stationEmptyBody: "No stocked items at this station"
    }
  );
  assert.equal(readyStationEmpty.title, "No inventory matches");
  assert.equal(readyStationEmpty.body, "No stocked items at this station");
});

test("inventory hub wires soft-refresh and RetryNotice instead of false empty health", () => {
  assert.match(inventoryHub, /resolveInventoryHubLoadState/);
  assert.match(inventoryHub, /presentInventoryHubHealthCopy/);
  assert.match(inventoryHub, /presentInventoryHubListEmptyCopy/);
  assert.match(inventoryHub, /RetryNotice/);
  assert.match(inventoryHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(inventoryHub, /loadedRestaurantRef/);
  assert.match(inventoryHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(inventoryHub, /hubReady\s*\?\s*outlooks\s*:\s*\[\]/);
  assert.match(inventoryHub, /healthPresentation\.ready/);
  assert.match(inventoryHub, /inventory\.health\.unavailable/);
  assert.match(inventoryHub, /inventory\.emptyMatches\.unavailableTitle/);
});

test("inventory detail load failures expose RetryNotice", () => {
  assert.match(inventoryDetail, /RetryNotice/);
  assert.match(inventoryDetail, /inventory\.detail\.retry\.title/);
  assert.match(inventoryDetail, /inventory\.detail\.retry\.accessibility/);
  assert.match(inventoryDetail, /onRetry=\{\(\) => void load\(\)\}/);
  assert.match(inventoryDetail, /messageIsError && message/);
});
