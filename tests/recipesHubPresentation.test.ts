import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentRecipesHubEmptyCopy,
  presentRecipesHubSectionAction,
  presentRecipesMutationFormBusy,
  presentRecipesMutationFormEditable,
  presentRecipesMutationNoticeCopy,
  resolveRecipesHubLoadState
} from "../services/presentation/recipesHubPresentation";

const recipesHub = readFileSync("app/settings/recipes.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

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

test("recipes mutation form busy and editable helpers gate edits while saving or hub not ready", () => {
  assert.equal(presentRecipesMutationFormBusy(null, false), false);
  assert.equal(presentRecipesMutationFormBusy("map_1", false), true);
  assert.equal(presentRecipesMutationFormBusy(null, true), true);
  assert.equal(presentRecipesMutationFormEditable(true, false, true), true);
  assert.equal(presentRecipesMutationFormEditable(true, true, true), false);
  assert.equal(presentRecipesMutationFormEditable(false, false, true), false);
  assert.equal(presentRecipesMutationFormEditable(true, false, false), false);
});

test("recipes mutation notice copy uses success for saves and danger for failures", () => {
  const copy = {
    readOnly: { title: "View only", message: "Managers map dishes" },
    quantity: { title: "Check quantity", message: "Enter a valid quantity" },
    menuItem: { title: "Choose dish", message: "Enter the POS name" },
    inventoryItem: { title: "Choose item", message: "Pick inventory" },
    wrongRestaurant: { title: "Wrong kitchen", message: "Reload workspace" },
    saveFailed: { title: "Save failed", message: "Could not save" },
    addFailed: { title: "Link failed", message: "Could not add" },
    unlinkFailed: { title: "Unlink failed", message: "Could not unlink" },
    saved: { title: "Baseline saved", message: "Stock refreshed" },
    linked: { title: "Ingredient linked", message: "Tomato depletes on sale" },
    unlinked: { title: "Ingredient unlinked", message: "Tomato no longer depletes" }
  };
  const saved = presentRecipesMutationNoticeCopy("saved", copy);
  assert.equal(saved.tone, "success");
  assert.equal(saved.title, "Baseline saved");
  const failed = presentRecipesMutationNoticeCopy("saveFailed", copy);
  assert.equal(failed.tone, "danger");
  assert.equal(failed.title, "Save failed");
  const readOnly = presentRecipesMutationNoticeCopy("readOnly", copy);
  assert.equal(readOnly.tone, "caution");
});

test("recipes hub uses localized StatusNotice for mutation outcomes and never plain error text", () => {
  assert.match(recipesHub, /presentRecipesMutationNoticeCopy/);
  assert.match(recipesHub, /presentRecipesMutationFormBusy/);
  assert.match(recipesHub, /presentRecipesMutationFormEditable/);
  assert.match(
    recipesHub,
    /presentRecipesMutationFormEditable\(\s*canManage,\s*mutationBusy,\s*hubReady\s*\)/
  );
  assert.match(recipesHub, /formEditable=\{formEditable\}/);
  assert.match(recipesHub, /!hubReady\) return/);
  assert.match(recipesHub, /StatusNotice/);
  assert.match(recipesHub, /tone=\{notice\.tone\}/);
  assert.match(recipesHub, /captureMiseError/);
  assert.doesNotMatch(recipesHub, /setError\(/);
  assert.doesNotMatch(recipesHub, /styles\.error/);
  assert.doesNotMatch(recipesHub, /styles\.notice/);
  assert.match(catalog, /recipes\.notice\.savedTitle/);
  assert.match(catalog, /recipes\.notice\.saveFailedTitle/);
  assert.match(catalog, /recipes\.notice\.linkedTitle/);
  assert.match(catalog, /"recipes\.notice\.savedTitle":\s*"Receta base guardada"/);
  assert.match(catalog, /"recipes\.notice\.saveFailedTitle":\s*"无法保存配方"/);
});
