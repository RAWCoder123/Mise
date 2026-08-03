import assert from "node:assert/strict";
import test from "node:test";

import {
  presentInventoryCountStartCopy,
  resolveInventoryCountLoadState
} from "../services/presentation/inventoryCountPresentation";
import {
  presentInventoryDetailMissingCopy,
  resolveInventoryDetailLoadState
} from "../services/presentation/inventoryDetailPresentation";

test("inventory count load state stays ready after soft-refresh failure with prior restaurant data", () => {
  assert.equal(
    resolveInventoryCountLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: "rest_a",
      loadError: true
    }),
    "ready"
  );
  assert.equal(
    resolveInventoryCountLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveInventoryCountLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
});

test("inventory count start copy never offers a new session while loading or unavailable", () => {
  const copy = {
    loadingTitle: "Loading",
    loadingBody: "Checking",
    unavailableTitle: "Unavailable",
    unavailableBody: "Retry",
    startTitle: "Start",
    startBody: "Begin"
  };

  assert.deepEqual(presentInventoryCountStartCopy("loading", copy), {
    title: "Loading",
    body: "Checking",
    canStart: false
  });
  assert.deepEqual(presentInventoryCountStartCopy("error", copy), {
    title: "Unavailable",
    body: "Retry",
    canStart: false
  });
  assert.deepEqual(presentInventoryCountStartCopy("ready", copy), {
    title: "Start",
    body: "Begin",
    canStart: true
  });
});

test("inventory detail load state and missing copy distinguish loading, error, and not found", () => {
  assert.equal(
    resolveInventoryDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: "rest_a",
      loadError: true
    }),
    "ready"
  );
  assert.equal(
    resolveInventoryDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );

  const copy = {
    loading: "Loading item",
    unavailable: "Unavailable item",
    notFound: "Missing item"
  };
  assert.equal(presentInventoryDetailMissingCopy("loading", copy), "Loading item");
  assert.equal(presentInventoryDetailMissingCopy("error", copy), "Unavailable item");
  assert.equal(presentInventoryDetailMissingCopy("ready", copy), "Missing item");
});
