import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const screen = readFileSync("app/more/operating-routines.tsx", "utf8");
const more = readFileSync("app/(tabs)/more.tsx", "utf8");
const layout = readFileSync("app/_layout.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("operating routines screen materializes via manager-gated service API", () => {
  assert.match(screen, /materializeOperatingRoutine/);
  assert.match(screen, /canManageRestaurantData/);
  assert.match(screen, /fetchOperatingRoutineDefinitions/);
  assert.match(screen, /routines\.action\.addToday/);
});

test("More hub and stack register the operating routines route", () => {
  assert.match(more, /more\.row\.routines\.title/);
  assert.match(more, /\/more\/operating-routines/);
  assert.match(layout, /more\/operating-routines/);
});

test("operating routines copy exists in EN, ES, and zh-Hans catalogs", () => {
  for (const key of [
    "more.row.routines.title",
    "routines.title",
    "routines.opening.title",
    "routines.closing.title",
    "routines.foodSafety.title",
    "routines.action.addToday"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} should appear once per locale`);
  }
});
