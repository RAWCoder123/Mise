import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentInventoryHubActionsEditable,
  presentInventoryHubHealthCopy,
  presentInventoryHubListEmptyCopy,
  presentInventoryHubStationHealthCopy,
  resolveInventoryHubLoadState,
  resolveInventoryHubStationHealthLoadState
} from "../services/presentation/inventoryHubPresentation";

const inventoryHub = readFileSync("app/(tabs)/inventory.tsx", "utf8");
const inventoryDetail = readFileSync("app/inventory/[id].tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

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

test("inventory hub actions stay non-editable until the hub is ready", () => {
  assert.equal(presentInventoryHubActionsEditable(true, true), true);
  assert.equal(presentInventoryHubActionsEditable(true, false), false);
  assert.equal(presentInventoryHubActionsEditable(false, true), false);
});

test("inventory hub wires soft-refresh and RetryNotice instead of false empty health", () => {
  assert.match(inventoryHub, /resolveInventoryHubLoadState/);
  assert.match(inventoryHub, /presentInventoryHubHealthCopy/);
  assert.match(inventoryHub, /presentInventoryHubListEmptyCopy/);
  assert.match(inventoryHub, /presentInventoryHubActionsEditable/);
  assert.match(inventoryHub, /RetryNotice/);
  assert.match(inventoryHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(inventoryHub, /loadedRestaurantRef/);
  assert.match(inventoryHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(inventoryHub, /hubReady\s*\?\s*outlooks\s*:\s*\[\]/);
  assert.match(inventoryHub, /hubReady\s*\?\s*openCountSessionId\s*:\s*null/);
  assert.match(inventoryHub, /healthPresentation\.ready/);
  assert.match(inventoryHub, /inventory\.health\.unavailable/);
  assert.match(inventoryHub, /inventory\.emptyMatches\.unavailableTitle/);
  assert.match(inventoryHub, /captureMiseError/);
  assert.match(inventoryHub, /flow:\s*"inventory"/);
  assert.match(inventoryHub, /operation:\s*"load"/);
  assert.match(inventoryHub, /canShowCreateAction/);
  assert.match(inventoryHub, /canShowCountAction/);
  assert.match(inventoryHub, /canShowWasteAction/);
});

test("inventory detail load failures expose RetryNotice", () => {
  assert.match(inventoryDetail, /resolveInventoryDetailLoadState/);
  assert.match(inventoryDetail, /RetryNotice/);
  assert.match(inventoryDetail, /inventory\.detail\.retry\.title/);
  assert.match(inventoryDetail, /inventory\.detail\.retry\.accessibility/);
  assert.match(inventoryDetail, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(inventoryDetail, /loadedRestaurantRef/);
  assert.match(inventoryDetail, /loadedItemIdRef/);
  assert.match(inventoryDetail, /hubReady\s*\?\s*outlook\s*:\s*null/);
  assert.match(inventoryDetail, /keepPrior/);
});

test("inventory hub station health load state separates failure from empty success", () => {
  assert.equal(
    resolveInventoryHubStationHealthLoadState({ loadError: true, breakdown: null }),
    "unavailable"
  );
  assert.equal(
    resolveInventoryHubStationHealthLoadState({ loadError: false, breakdown: null }),
    "empty"
  );
  assert.equal(
    resolveInventoryHubStationHealthLoadState({
      loadError: false,
      breakdown: { stationCount: 0 }
    }),
    "empty"
  );
  assert.equal(
    resolveInventoryHubStationHealthLoadState({
      loadError: false,
      breakdown: { stationCount: 2 }
    }),
    "ready"
  );
  assert.deepEqual(
    presentInventoryHubStationHealthCopy("unavailable", {
      unavailableTitle: "Stations unavailable",
      unavailableBody: "Retry station health"
    }),
    {
      title: "Stations unavailable",
      message: "Retry station health"
    }
  );
  assert.equal(
    presentInventoryHubStationHealthCopy("ready", {
      unavailableTitle: "Stations unavailable",
      unavailableBody: "Retry station health"
    }),
    null
  );
});

test("inventory hub fails closed when station health cannot load instead of hiding stations", () => {
  assert.doesNotMatch(
    inventoryHub,
    /fetchInventoryLocationHealthBreakdown\([^)]*\)\.catch\(\s*\(\)\s*=>\s*null\s*\)/
  );
  assert.match(inventoryHub, /resolveInventoryHubStationHealthLoadState/);
  assert.match(inventoryHub, /presentInventoryHubStationHealthCopy/);
  assert.match(inventoryHub, /locationHealthLoadError/);
  assert.match(inventoryHub, /operation:\s*"load_station_health"/);
  assert.match(inventoryHub, /inventory\.health\.stationsUnavailable\.title/);
  assert.match(inventoryHub, /inventory\.health\.stationsUnavailable\.retryAccessibility/);
  assert.match(catalog, /inventory\.health\.stationsUnavailable\.title/);
  assert.match(catalog, /inventory\.health\.stationsUnavailable\.body/);
  assert.match(catalog, /inventory\.health\.stationsUnavailable\.retryAccessibility/);
  assert.match(
    catalog,
    /"inventory\.health\.stationsUnavailable\.title":\s*"Estaciones no disponibles"/
  );
  assert.match(
    catalog,
    /"inventory\.health\.stationsUnavailable\.title":\s*"站点库存不可用"/
  );
});
