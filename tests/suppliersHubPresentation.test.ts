import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentSuppliersHubConfiguredCount,
  presentSuppliersHubEmptyCopy,
  resolveSuppliersHubLoadState
} from "../services/presentation/suppliersHubPresentation";

const suppliersHub = readFileSync("app/settings/suppliers.tsx", "utf8");

test("suppliers hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveSuppliersHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveSuppliersHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveSuppliersHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveSuppliersHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveSuppliersHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: true
    }),
    "ready"
  );
});

test("suppliers configured-count and empty copy never claim an empty directory while loading or failed", () => {
  assert.equal(
    presentSuppliersHubConfiguredCount(
      "loading",
      0,
      0,
      {
        loading: "Loading suppliers…",
        unavailable: "Directory unavailable",
        configuredCount: (configured, total) => `${configured} of ${total} ready`
      },
      String
    ),
    "Loading suppliers…"
  );
  assert.equal(
    presentSuppliersHubConfiguredCount(
      "error",
      0,
      0,
      {
        loading: "Loading suppliers…",
        unavailable: "Directory unavailable",
        configuredCount: (configured, total) => `${configured} of ${total} ready`
      },
      String
    ),
    "Directory unavailable"
  );
  assert.equal(
    presentSuppliersHubConfiguredCount(
      "ready",
      2,
      5,
      {
        loading: "Loading suppliers…",
        unavailable: "Directory unavailable",
        configuredCount: (configured, total) => `${configured} of ${total} ready`
      },
      String
    ),
    "2 of 5 ready"
  );

  const loadingEmpty = presentSuppliersHubEmptyCopy("loading", {
    loadingTitle: "Loading suppliers…",
    loadingBody: "Refreshing recipient directory",
    unavailableTitle: "Supplier directory unavailable",
    unavailableBody: "Retry to refresh",
    emptyTitle: "No suppliers yet",
    emptyBody: "Add inventory suppliers during setup"
  });
  assert.equal(loadingEmpty.title, "Loading suppliers…");
  assert.doesNotMatch(loadingEmpty.title, /no suppliers/i);

  const errorEmpty = presentSuppliersHubEmptyCopy("error", {
    loadingTitle: "Loading suppliers…",
    loadingBody: "Refreshing recipient directory",
    unavailableTitle: "Supplier directory unavailable",
    unavailableBody: "Retry to refresh",
    emptyTitle: "No suppliers yet",
    emptyBody: "Add inventory suppliers during setup"
  });
  assert.equal(errorEmpty.title, "Supplier directory unavailable");
  assert.doesNotMatch(errorEmpty.title, /no suppliers/i);
});

test("suppliers hub wires soft-refresh and RetryNotice instead of false empty directory", () => {
  assert.match(suppliersHub, /resolveSuppliersHubLoadState/);
  assert.match(suppliersHub, /presentSuppliersHubEmptyCopy/);
  assert.match(suppliersHub, /presentSuppliersHubConfiguredCount/);
  assert.match(suppliersHub, /RetryNotice/);
  assert.match(suppliersHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(suppliersHub, /loadedRestaurantRef/);
  assert.match(suppliersHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(suppliersHub, /hubReady\s*\?\s*entries\s*:\s*\[\]/);
  assert.match(suppliersHub, /emptyLoadingTitle/);
  assert.match(suppliersHub, /retryAccessibility/);
});
