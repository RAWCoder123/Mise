import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentSuppliersHubConfiguredCount,
  presentSuppliersHubEmptyCopy,
  presentSuppliersMutationActionsEditable,
  presentSuppliersMutationBusy,
  presentSuppliersMutationNoticeCopy,
  resolveSuppliersHubLoadState
} from "../services/presentation/suppliersHubPresentation";
import { catalogs, SUPPORTED_LOCALES, translate } from "../i18n/catalog";

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
    "error"
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

test("suppliers mutation helpers gate edits and map notice tones", () => {
  assert.equal(presentSuppliersMutationBusy(0), false);
  assert.equal(presentSuppliersMutationBusy(1), true);
  assert.equal(presentSuppliersMutationActionsEditable(true, false, true), true);
  assert.equal(presentSuppliersMutationActionsEditable(true, true, true), false);
  assert.equal(presentSuppliersMutationActionsEditable(true, false, false), false);
  assert.equal(presentSuppliersMutationActionsEditable(false, false, true), false);

  const copy = {
    invalidEmail: { title: "Invalid", message: "Bad email" },
    saved: { title: "Saved", message: "Ready" },
    saveError: { title: "Failed", message: "Retry" }
  };
  assert.equal(presentSuppliersMutationNoticeCopy("invalidEmail", copy).tone, "caution");
  assert.equal(presentSuppliersMutationNoticeCopy("saved", copy).tone, "success");
  assert.equal(presentSuppliersMutationNoticeCopy("saveError", copy).tone, "danger");
});

test("suppliers hub wires soft-refresh, catalog copy, and mutation StatusNotice helpers", () => {
  assert.match(suppliersHub, /function buildSupplierCopy\(/);
  assert.doesNotMatch(suppliersHub, /const supplierCopy:\s*Record<AppLocale/);
  assert.match(suppliersHub, /resolveSuppliersHubLoadState/);
  assert.match(suppliersHub, /presentSuppliersHubEmptyCopy/);
  assert.match(suppliersHub, /presentSuppliersHubConfiguredCount/);
  assert.match(suppliersHub, /presentSuppliersMutationNoticeCopy/);
  assert.match(suppliersHub, /presentSuppliersMutationActionsEditable/);
  assert.match(suppliersHub, /RetryNotice/);
  assert.match(suppliersHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(suppliersHub, /loadedRestaurantRef/);
  assert.match(suppliersHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(suppliersHub, /hubReady\s*\?\s*entries\s*:\s*\[\]/);
  assert.match(suppliersHub, /t\("settings\.suppliers\.title"\)/);
  assert.match(suppliersHub, /captureMiseError\(error,\s*\{\s*flow:\s*"settings_suppliers",\s*operation:\s*"save"/);
  assert.match(suppliersHub, /retryAccessibility/);
});

test("supplier email screen copy lives in the shared catalog with locale parity", () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(catalogs[locale]["settings.suppliers.title"].length > 0);
    assert.ok(catalogs[locale]["settings.suppliers.notice.savedTitle"].length > 0);
    assert.equal(
      translate(locale, "settings.suppliers.notice.invalidBody", { supplier: "Fresh Foods" }).includes("Fresh Foods"),
      true
    );
    assert.equal(
      translate(locale, "settings.suppliers.configuredCount", { configured: "2", total: "5" }).includes("2"),
      true
    );
  }
});
