import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog.ts";
import {
  presentRestaurantMemoryStatusLabel,
  presentRestaurantMemoryTypeLabel,
  restaurantMemoryStatusLabelKey,
  restaurantMemoryTypeLabelKey
} from "../services/presentation/restaurantMemoryLabels.ts";

test("restaurant memory type labels localize without inventing keys", () => {
  assert.equal(restaurantMemoryTypeLabelKey("demand_pattern"), "memory.type.demand_pattern");
  assert.equal(restaurantMemoryTypeLabelKey("action_outcome"), "memory.type.action_outcome");
  assert.equal(translate("en", restaurantMemoryTypeLabelKey("waste_pattern")), "Waste pattern");
  assert.equal(
    presentRestaurantMemoryTypeLabel("supplier_reliability", (key) => translate("es", key)),
    "Fiabilidad del proveedor"
  );
  assert.equal(
    presentRestaurantMemoryTypeLabel("menu_dependency", (key) => translate("zh-Hans", key)),
    "菜单依赖"
  );
  assert.equal(
    presentRestaurantMemoryTypeLabel("legacy_custom_type", (key) => translate("en", key)),
    "legacy custom type"
  );
  assert.equal(presentRestaurantMemoryTypeLabel("   ", (key) => translate("en", key)), "—");
});

test("restaurant memory status labels localize without inventing keys", () => {
  assert.equal(restaurantMemoryStatusLabelKey("active"), "memory.status.active");
  assert.equal(restaurantMemoryStatusLabelKey("forgotten"), "memory.status.forgotten");
  assert.equal(translate("en", restaurantMemoryStatusLabelKey("confirmed")), "Confirmed");
  assert.equal(
    presentRestaurantMemoryStatusLabel("corrected", (key) => translate("es", key)),
    "Corregida"
  );
  assert.equal(
    presentRestaurantMemoryStatusLabel("disabled", (key) => translate("zh-Hans", key)),
    "已停用"
  );
  assert.equal(
    presentRestaurantMemoryStatusLabel("legacy_custom_status", (key) => translate("en", key)),
    "legacy custom status"
  );
  assert.equal(presentRestaurantMemoryStatusLabel("   ", (key) => translate("en", key)), "—");
});

test("restaurant memory hub no longer dumps raw underscore enums in source", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/more/restaurant-memory.tsx", import.meta.url), "utf8");
  assert.match(source, /presentRestaurantMemoryTypeLabel/);
  assert.match(source, /presentRestaurantMemoryStatusLabel/);
  assert.doesNotMatch(source, /memoryType\.replace\(\/_\/g/);
  assert.doesNotMatch(source, /\{\s*memory\.status\s*\}/);
});
