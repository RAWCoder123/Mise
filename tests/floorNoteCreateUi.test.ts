import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Today surfaces device floor-note create for any active restaurant member", () => {
  const today = readFileSync("app/(tabs)/today.tsx", "utf8");
  const createScreen = readFileSync("app/more/create-floor-note.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");

  assert.match(layout, /more\/create-floor-note/);
  assert.match(today, /router\.push\("\/more\/create-floor-note"\)/);
  assert.match(today, /today\.floorNotes\.add/);
  assert.match(
    today,
    /const floorNotesEditable = presentRestaurantScopedHubActionsEditable\(\{[\s\S]{0,200}allowed: Boolean\(restaurant\),[\s\S]{0,200}busy: Boolean\(busyFloorNoteId\)/
  );
  assert.match(today, /if \(!restaurant \|\| !floorNotesEditable\) return;/);
  assert.match(today, /disabled=\{!floorNotesEditable\}/);
  assert.match(today, /hubReady \? \(/);
  assert.match(today, /today\.floorNotes\.empty/);

  assert.match(createScreen, /createFloorNote\(/);
  assert.match(createScreen, /activeRestaurantIdRef/);
  assert.match(createScreen, /activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(createScreen, /floorNotes\.create\.save/);
  assert.match(createScreen, /\[restaurant\?\.id\]/);
  assert.doesNotMatch(createScreen, /canManageRestaurantData/);
});

test("floor-note create copy stays localized in EN, ES, and zh-Hans", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "today.floorNotes.add",
    "today.floorNotes.addHint",
    "today.floorNotes.empty",
    "floorNotes.create.title",
    "floorNotes.create.save",
    "floorNotes.error.titleRequired"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} must exist in EN/ES/zh-Hans`);
  }
});
