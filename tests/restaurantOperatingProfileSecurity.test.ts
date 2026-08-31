import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");
const operatingProfileScreen = readFileSync("app/settings/operating-profile.tsx", "utf8");
const rootLayout = readFileSync("app/_layout.tsx", "utf8");
const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
const application = readFileSync("services/application/restaurant.ts", "utf8");
const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const tenantAccess = readFileSync("services/tenantAccess.ts", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("operating profile settings gate edits to owner/admin and save through server-owned profile updates", () => {
  assert.match(tenantAccess, /export function canUpdateRestaurantProfile/);
  assert.match(settingsHub, /\/settings\/operating-profile/);
  assert.match(settingsHub, /settings\.operatingProfile\.entryTitle/);
  assert.match(operatingProfileScreen, /canUpdateRestaurantProfile/);
  assert.match(operatingProfileScreen, /updateRestaurantProfile/);
  assert.match(operatingProfileScreen, /buildRestaurantOperatingProfilePatch/);
  assert.match(application, /requireRestaurantProfilePatch/);
  const hostedSave =
    repository.match(/async updateRestaurantProfile\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedSave, /\.rpc\(\s*["']update_restaurant_profile["']/);
  assert.doesNotMatch(hostedSave, /service_role|SUPABASE_SERVICE|sk_live|openai/i);
  assert.doesNotMatch(operatingProfileScreen, /service_role|SUPABASE_SERVICE|sk_live|openai/i);
});

test("session applies operating profile updates locally after a successful save", () => {
  assert.match(session, /applyRestaurantProfile/);
  assert.match(operatingProfileScreen, /applyRestaurantProfile/);
  assert.match(rootLayout, /settings\/operating-profile/);
  assert.match(routeSmoke, /\/settings\/operating-profile/);
});

test("operating profile copy exists in English, Spanish, and Simplified Chinese catalogs", () => {
  const titleMatches = catalog.match(/"settings\.operatingProfile\.title":/g) ?? [];
  assert.equal(titleMatches.length, 3);
  assert.match(catalog, /"settings\.operatingProfile\.entryTitle": "Operating rhythm"/);
  assert.match(catalog, /"settings\.operatingProfile\.entryTitle": "Ritmo operativo"/);
  assert.match(catalog, /"settings\.operatingProfile\.entryTitle": "运营节奏"/);
});

test("operating profile editor does not invent primary-supplier authority writes", () => {
  assert.match(operatingProfileScreen, /primarySuppliersHint/);
  assert.doesNotMatch(operatingProfileScreen, /updateDraft\("primarySuppliers"/);
  assert.match(
    readFileSync("services/domain/restaurantOperatingProfile.ts", "utf8"),
    /primarySuppliers: \[\.\.\.restaurant\.operational_profile\.primarySuppliers\]/
  );
});
