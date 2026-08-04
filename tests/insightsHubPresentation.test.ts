import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentInsightsHubActionsEditable,
  presentInsightsHubBriefAction,
  presentInsightsHubBriefEmptyCopy,
  presentInsightsHubSummaryCopy,
  presentInsightsHubTrendEmptyCopy,
  resolveInsightsHubLoadState
} from "../services/presentation/insightsHubPresentation";

const insightsHub = readFileSync("app/(tabs)/insights.tsx", "utf8");

test("insights hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveInsightsHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveInsightsHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveInsightsHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveInsightsHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
});

test("insights summary, brief, and trend copy never claim empty learning while loading or failed", () => {
  const loadingSummary = presentInsightsHubSummaryCopy(
    "loading",
    { title: "Mise is waiting for signals", body: "Add sales and inventory counts" },
    {
      loadingTitle: "Loading manager brief…",
      loadingBody: "Refreshing signals",
      unavailableTitle: "Manager brief unavailable",
      unavailableBody: "Retry to refresh"
    }
  );
  assert.equal(loadingSummary.ready, false);
  assert.equal(loadingSummary.title, "Loading manager brief…");
  assert.doesNotMatch(loadingSummary.title, /waiting for signals|still learning/i);
  assert.doesNotMatch(loadingSummary.body, /add sales|still learning/i);

  const errorSummary = presentInsightsHubSummaryCopy(
    "error",
    { title: "Mise is waiting for signals", body: "Add sales and inventory counts" },
    {
      loadingTitle: "Loading manager brief…",
      loadingBody: "Refreshing signals",
      unavailableTitle: "Manager brief unavailable",
      unavailableBody: "Retry to refresh"
    }
  );
  assert.equal(errorSummary.ready, false);
  assert.equal(errorSummary.title, "Manager brief unavailable");

  const readySummary = presentInsightsHubSummaryCopy(
    "ready",
    { title: "Mise is waiting for signals", body: "Add sales and inventory counts" },
    {
      loadingTitle: "Loading manager brief…",
      loadingBody: "Refreshing signals",
      unavailableTitle: "Manager brief unavailable",
      unavailableBody: "Retry to refresh"
    }
  );
  assert.equal(readySummary.ready, true);
  assert.equal(readySummary.title, "Mise is waiting for signals");

  const loadingBrief = presentInsightsHubBriefEmptyCopy(
    "loading",
    { hasInsights: false, filterLabel: "urgent" },
    {
      loadingTitle: "Loading manager brief…",
      loadingBody: "Refreshing prioritized signals",
      unavailableTitle: "Manager brief unavailable",
      unavailableBody: "Retry to refresh signals",
      emptyLearningTitle: "Mise is still learning",
      emptyLearningBody: "Signals will appear",
      emptyFilterTitle: (filter) => `No ${filter} signals`,
      emptyFilterBody: "Choose another severity"
    }
  );
  assert.equal(loadingBrief.title, "Loading manager brief…");
  assert.doesNotMatch(loadingBrief.title, /still learning/i);

  const errorBrief = presentInsightsHubBriefEmptyCopy(
    "error",
    { hasInsights: false, filterLabel: "urgent" },
    {
      loadingTitle: "Loading manager brief…",
      loadingBody: "Refreshing prioritized signals",
      unavailableTitle: "Manager brief unavailable",
      unavailableBody: "Retry to refresh signals",
      emptyLearningTitle: "Mise is still learning",
      emptyLearningBody: "Signals will appear",
      emptyFilterTitle: (filter) => `No ${filter} signals`,
      emptyFilterBody: "Choose another severity"
    }
  );
  assert.equal(errorBrief.title, "Manager brief unavailable");

  const readyEmptyLearning = presentInsightsHubBriefEmptyCopy(
    "ready",
    { hasInsights: false, filterLabel: "urgent" },
    {
      loadingTitle: "Loading manager brief…",
      loadingBody: "Refreshing prioritized signals",
      unavailableTitle: "Manager brief unavailable",
      unavailableBody: "Retry to refresh signals",
      emptyLearningTitle: "Mise is still learning",
      emptyLearningBody: "Signals will appear",
      emptyFilterTitle: (filter) => `No ${filter} signals`,
      emptyFilterBody: "Choose another severity"
    }
  );
  assert.equal(readyEmptyLearning.title, "Mise is still learning");

  const readyFilterEmpty = presentInsightsHubBriefEmptyCopy(
    "ready",
    { hasInsights: true, filterLabel: "urgent" },
    {
      loadingTitle: "Loading manager brief…",
      loadingBody: "Refreshing prioritized signals",
      unavailableTitle: "Manager brief unavailable",
      unavailableBody: "Retry to refresh signals",
      emptyLearningTitle: "Mise is still learning",
      emptyLearningBody: "Signals will appear",
      emptyFilterTitle: (filter) => `No ${filter} signals`,
      emptyFilterBody: "Choose another severity"
    }
  );
  assert.equal(readyFilterEmpty.title, "No urgent signals");

  const loadingTrend = presentInsightsHubTrendEmptyCopy("loading", {
    loadingTitle: "Loading sales trend…",
    loadingBody: "Refreshing POS sales",
    unavailableTitle: "Sales trend unavailable",
    unavailableBody: "Retry to refresh sales",
    emptyTitle: "No recorded sales yet",
    emptyBody: "Connect a POS"
  });
  assert.equal(loadingTrend.title, "Loading sales trend…");
  assert.doesNotMatch(loadingTrend.title, /no recorded sales/i);

  const errorTrend = presentInsightsHubTrendEmptyCopy("error", {
    loadingTitle: "Loading sales trend…",
    loadingBody: "Refreshing POS sales",
    unavailableTitle: "Sales trend unavailable",
    unavailableBody: "Retry to refresh sales",
    emptyTitle: "No recorded sales yet",
    emptyBody: "Connect a POS"
  });
  assert.equal(errorTrend.title, "Sales trend unavailable");

  assert.equal(
    presentInsightsHubBriefAction("loading", "3 signals", {
      loading: "Loading…",
      unavailable: "Unavailable"
    }),
    "Loading…"
  );
  assert.equal(
    presentInsightsHubBriefAction("error", "3 signals", {
      loading: "Loading…",
      unavailable: "Unavailable"
    }),
    "Unavailable"
  );
  assert.equal(
    presentInsightsHubBriefAction("ready", "3 signals", {
      loading: "Loading…",
      unavailable: "Unavailable"
    }),
    "3 signals"
  );
});

test("insights hub actions stay non-editable until the hub is ready", () => {
  assert.equal(presentInsightsHubActionsEditable(true, false, true), true);
  assert.equal(presentInsightsHubActionsEditable(true, true, true), false);
  assert.equal(presentInsightsHubActionsEditable(true, false, false), false);
  assert.equal(presentInsightsHubActionsEditable(false, false, true), false);
});

test("insights hub wires soft-refresh and RetryNotice instead of false empty learning", () => {
  assert.match(insightsHub, /resolveInsightsHubLoadState/);
  assert.match(insightsHub, /presentInsightsHubSummaryCopy/);
  assert.match(insightsHub, /presentInsightsHubBriefEmptyCopy/);
  assert.match(insightsHub, /presentInsightsHubTrendEmptyCopy/);
  assert.match(insightsHub, /presentInsightsHubActionsEditable/);
  assert.match(insightsHub, /RetryNotice/);
  assert.match(insightsHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(insightsHub, /loadedRestaurantRef/);
  assert.match(insightsHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(insightsHub, /hubReady\s*\?\s*insights\s*:\s*\[\]/);
  assert.match(insightsHub, /insights\.summary\.unavailableTitle/);
  assert.match(insightsHub, /insights\.brief\.emptyUnavailable\.title/);
  assert.match(insightsHub, /insights\.trend\.empty\.unavailableTitle/);
  assert.match(insightsHub, /captureMiseError/);
  assert.match(insightsHub, /flow:\s*"insights"/);
  assert.match(insightsHub, /operation:\s*"load"/);
  assert.match(insightsHub, /operation:\s*"refresh"/);
  assert.match(insightsHub, /refreshActionsEditable/);
  assert.match(insightsHub, /if \(!restaurant \|\| refreshing \|\| !canManage \|\| !hubReady\) return/);
});
