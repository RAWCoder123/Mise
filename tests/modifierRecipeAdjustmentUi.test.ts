import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync("app/settings/modifiers.tsx", "utf8");
const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
const layout = readFileSync("app/_layout.tsx", "utf8");

test("settings hub exposes the POS modifiers route", () => {
  assert.match(settings, /settings\.operations\.modifiers\.title/);
  assert.match(settings, /\/settings\/modifiers/);
  assert.match(layout, /settings\/modifiers/);
});

test("modifiers screen verifies drafts and fails closed on load errors", () => {
  assert.match(screen, /listModifierRecipeAdjustments/);
  assert.match(screen, /verifyModifierRecipeAdjustment/);
  assert.match(screen, /expireModifierRecipeAdjustment/);
  assert.match(screen, /hubLoadState === "error"/);
  assert.match(screen, /modifiers\.loadError\.title/);
  assert.match(screen, /presentRestaurantScopedHubActionsEditable/);
  assert.match(screen, /setLoadError\(true\)/);
});
