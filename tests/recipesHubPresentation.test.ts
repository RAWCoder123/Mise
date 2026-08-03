import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentRecipesHubEmptyCopy,
  presentRecipesHubSectionAction,
  resolveRecipesHubLoadState
} from "../services/presentation/recipesHubPresentation";

const recipesHub = readFileSync("app/settings/recipes.tsx", "utf8");

test("recipes hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveRecipesHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveRecipesHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveRecipesHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveRecipesHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
});

test("recipes empty copy never claims unmapped dishes while loading or failed", () => {
  const loading = presentRecipesHubEmptyCopy(
    "loading",
    { searchNoMatches: false },
    {
      loadingTitle: "Loading recipe baselines…",
      loadingBody: "Refreshing coverage",
      unavailableTitle: "Recipe baselines unavailable",
      unavailableBody: "Retry to refresh",
      emptyTitle: "No recipes mapped yet",
      emptyBody: "Add dish baselines",
      searchEmptyTitle: "No matching dishes",
      searchEmptyBody: "Try a shorter name"
    }
  );
  assert.equal(loading.title, "Loading recipe baselines…");
  assert.doesNotMatch(loading.title, /no recipes mapped/i);

  const error = presentRecipesHubEmptyCopy(
    "error",
    { searchNoMatches: true },
    {
      loadingTitle: "Loading recipe baselines…",
      loadingBody: "Refreshing coverage",
      unavailableTitle: "Recipe baselines unavailable",
      unavailableBody: "Retry to refresh",
      emptyTitle: "No recipes mapped yet",
      emptyBody: "Add dish baselines",
      searchEmptyTitle: "No matching dishes",
      searchEmptyBody: "Try a shorter name"
    }
  );
  assert.equal(error.title, "Recipe baselines unavailable");

  const readySearch = presentRecipesHubEmptyCopy(
    "ready",
    { searchNoMatches: true },
    {
      loadingTitle: "Loading recipe baselines…",
      loadingBody: "Refreshing coverage",
      unavailableTitle: "Recipe baselines unavailable",
      unavailableBody: "Retry to refresh",
      emptyTitle: "No recipes mapped yet",
      emptyBody: "Add dish baselines",
      searchEmptyTitle: "No matching dishes",
      searchEmptyBody: "Try a shorter name"
    }
  );
  assert.equal(readySearch.title, "No matching dishes");
  assert.equal(readySearch.compact, true);

  assert.equal(
    presentRecipesHubSectionAction("loading", "3 shown", {
      loading: "Loading…",
      unavailable: "Unavailable"
    }),
    "Loading…"
  );
  assert.equal(
    presentRecipesHubSectionAction("ready", "3 shown", {
      loading: "Loading…",
      unavailable: "Unavailable"
    }),
    "3 shown"
  );
});

test("recipes hub wires soft-refresh and RetryNotice instead of false empty mappings", () => {
  assert.match(recipesHub, /resolveRecipesHubLoadState/);
  assert.match(recipesHub, /presentRecipesHubEmptyCopy/);
  assert.match(recipesHub, /RetryNotice/);
  assert.match(recipesHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(recipesHub, /loadedRestaurantRef/);
  assert.match(recipesHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(recipesHub, /hubReady\s*\?\s*summary\s*:\s*null/);
  assert.match(recipesHub, /recipes\.empty\.unavailableTitle/);
  assert.match(recipesHub, /recipes\.retry\.accessibility/);
});
