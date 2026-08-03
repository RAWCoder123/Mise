import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentTodayInventoryHealthCopy,
  presentTodaySalesEmptyCopy,
  presentTodayServicePulseCopy,
  presentTodayTasksEmptyCopy,
  resolveTodayHubLoadState
} from "../services/presentation/todayHubPresentation";

const todayHub = readFileSync("app/(tabs)/today.tsx", "utf8");

test("today hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveTodayHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveTodayHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveTodayHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveTodayHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveTodayHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: true
    }),
    "ready"
  );
});

test("today service pulse and section copy never claim clear service while loading or failed", () => {
  const loadingPulse = presentTodayServicePulseCopy(
    "loading",
    {
      title: "Service looks ready",
      message: "No stock, order, or open-task pressure right now",
      tone: "success"
    },
    {
      loadingTitle: "Refreshing today’s command center…",
      loadingBody: "Mise is loading stock, orders, and tasks for this restaurant.",
      unavailableTitle: "Today’s command center unavailable",
      unavailableBody: "Retry to refresh today’s operational summary.",
      loadingTone: "neutral",
      unavailableTone: "warning"
    }
  );
  assert.equal(loadingPulse.ready, false);
  assert.equal(loadingPulse.title, "Refreshing today’s command center…");
  assert.equal(loadingPulse.tone, "neutral");
  assert.doesNotMatch(loadingPulse.title, /service looks ready/i);
  assert.doesNotMatch(loadingPulse.message, /no stock|open-task pressure/i);

  const errorPulse = presentTodayServicePulseCopy(
    "error",
    {
      title: "Service looks ready",
      message: "No stock, order, or open-task pressure right now",
      tone: "success"
    },
    {
      loadingTitle: "Refreshing today’s command center…",
      loadingBody: "Mise is loading stock, orders, and tasks for this restaurant.",
      unavailableTitle: "Today’s command center unavailable",
      unavailableBody: "Retry to refresh today’s operational summary.",
      loadingTone: "neutral",
      unavailableTone: "warning"
    }
  );
  assert.equal(errorPulse.ready, false);
  assert.equal(errorPulse.title, "Today’s command center unavailable");
  assert.equal(errorPulse.tone, "warning");

  const readyPulse = presentTodayServicePulseCopy(
    "ready",
    {
      title: "Needs attention",
      message: "3 stock items need attention",
      tone: "warning"
    },
    {
      loadingTitle: "Refreshing today’s command center…",
      loadingBody: "Mise is loading stock, orders, and tasks for this restaurant.",
      unavailableTitle: "Today’s command center unavailable",
      unavailableBody: "Retry to refresh today’s operational summary.",
      loadingTone: "neutral",
      unavailableTone: "warning"
    }
  );
  assert.equal(readyPulse.ready, true);
  assert.equal(readyPulse.title, "Needs attention");
  assert.equal(readyPulse.message, "3 stock items need attention");
  assert.equal(readyPulse.tone, "warning");

  const loadingHealth = presentTodayInventoryHealthCopy("loading", {
    loading: "Loading inventory health…",
    unavailable: "Inventory health unavailable"
  });
  assert.equal(loadingHealth.ready, false);
  assert.equal(loadingHealth.message, "Loading inventory health…");

  const errorHealth = presentTodayInventoryHealthCopy("error", {
    loading: "Loading inventory health…",
    unavailable: "Inventory health unavailable"
  });
  assert.equal(errorHealth.ready, false);
  assert.equal(errorHealth.message, "Inventory health unavailable");

  const readyHealth = presentTodayInventoryHealthCopy("ready", {
    loading: "Loading inventory health…",
    unavailable: "Inventory health unavailable"
  });
  assert.equal(readyHealth.ready, true);
  assert.equal(readyHealth.message, null);

  const loadingTasks = presentTodayTasksEmptyCopy(
    "loading",
    { muted: false, hiddenCount: 0 },
    {
      loadingTitle: "Loading today’s tasks…",
      loadingBody: "Refreshing operational work for this restaurant",
      unavailableTitle: "Today’s tasks unavailable",
      unavailableBody: "Retry to refresh today’s tasks",
      clearTitle: "No operational work is waiting",
      clearDetail: "Mise will surface inventory work here",
      mutedTitle: "Open work is hidden by your alert preferences",
      mutedDetail: (count) => `${count} items are muted`
    }
  );
  assert.equal(loadingTasks.title, "Loading today’s tasks…");
  assert.doesNotMatch(loadingTasks.title, /no operational work/i);
  assert.doesNotMatch(loadingTasks.detail, /surface inventory/i);

  const errorTasks = presentTodayTasksEmptyCopy(
    "error",
    { muted: true, hiddenCount: 2 },
    {
      loadingTitle: "Loading today’s tasks…",
      loadingBody: "Refreshing operational work for this restaurant",
      unavailableTitle: "Today’s tasks unavailable",
      unavailableBody: "Retry to refresh today’s tasks",
      clearTitle: "No operational work is waiting",
      clearDetail: "Mise will surface inventory work here",
      mutedTitle: "Open work is hidden by your alert preferences",
      mutedDetail: (count) => `${count} items are muted`
    }
  );
  assert.equal(errorTasks.title, "Today’s tasks unavailable");
  assert.doesNotMatch(errorTasks.title, /hidden by your alert preferences|no operational work/i);

  const mutedTasks = presentTodayTasksEmptyCopy(
    "ready",
    { muted: true, hiddenCount: 2 },
    {
      loadingTitle: "Loading today’s tasks…",
      loadingBody: "Refreshing operational work for this restaurant",
      unavailableTitle: "Today’s tasks unavailable",
      unavailableBody: "Retry to refresh today’s tasks",
      clearTitle: "No operational work is waiting",
      clearDetail: "Mise will surface inventory work here",
      mutedTitle: "Open work is hidden by your alert preferences",
      mutedDetail: (count) => `${count} items are muted`
    }
  );
  assert.equal(mutedTasks.title, "Open work is hidden by your alert preferences");
  assert.equal(mutedTasks.detail, "2 items are muted");

  const clearTasks = presentTodayTasksEmptyCopy(
    "ready",
    { muted: false, hiddenCount: 0 },
    {
      loadingTitle: "Loading today’s tasks…",
      loadingBody: "Refreshing operational work for this restaurant",
      unavailableTitle: "Today’s tasks unavailable",
      unavailableBody: "Retry to refresh today’s tasks",
      clearTitle: "No operational work is waiting",
      clearDetail: "Mise will surface inventory work here",
      mutedTitle: "Open work is hidden by your alert preferences",
      mutedDetail: (count) => `${count} items are muted`
    }
  );
  assert.equal(clearTasks.title, "No operational work is waiting");

  const loadingSales = presentTodaySalesEmptyCopy(
    "loading",
    { empty: "No recorded sales are available yet." },
    {
      loading: "Loading sales movement…",
      unavailable: "Sales movement unavailable"
    }
  );
  assert.equal(loadingSales, "Loading sales movement…");
  assert.doesNotMatch(loadingSales, /no recorded sales/i);

  const errorSales = presentTodaySalesEmptyCopy(
    "error",
    { empty: "No recorded sales are available yet." },
    {
      loading: "Loading sales movement…",
      unavailable: "Sales movement unavailable"
    }
  );
  assert.equal(errorSales, "Sales movement unavailable");

  const readySales = presentTodaySalesEmptyCopy(
    "ready",
    { empty: "No recorded sales are available yet." },
    {
      loading: "Loading sales movement…",
      unavailable: "Sales movement unavailable"
    }
  );
  assert.equal(readySales, "No recorded sales are available yet.");
});

test("today hub wires soft-refresh and RetryNotice instead of false-clear command center", () => {
  assert.match(todayHub, /resolveTodayHubLoadState/);
  assert.match(todayHub, /presentTodayServicePulseCopy/);
  assert.match(todayHub, /presentTodayInventoryHealthCopy/);
  assert.match(todayHub, /presentTodayTasksEmptyCopy/);
  assert.match(todayHub, /presentTodaySalesEmptyCopy/);
  assert.match(todayHub, /RetryNotice/);
  assert.match(todayHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(todayHub, /retryLabel=\{t\("common\.retry"\)\}/);
  assert.match(todayHub, /loadedRestaurantIdRef/);
  assert.match(todayHub, /setLoadedRestaurantId/);
  assert.match(todayHub, /if \(showLoading \|\| loadedRestaurantIdRef\.current !== restaurantId\)/);
  assert.match(todayHub, /hubReady\s*\?\s*summary\s*:\s*null/);
  assert.match(todayHub, /today\.service\.loading\.title/);
  assert.match(todayHub, /today\.tasks\.unavailableTitle/);
  assert.match(todayHub, /today\.salesMovement\.unavailable/);
  assert.match(todayHub, /today\.inventoryHealth\.unavailable/);
});
