import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");
const restaurantScreen = readFileSync("app/settings/restaurant.tsx", "utf8");
const rootLayout = readFileSync("app/_layout.tsx", "utf8");
const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
const application = readFileSync("services/application/restaurant.ts", "utf8");
const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const tenantAccess = readFileSync("services/tenantAccess.ts", "utf8");

test("restaurant identity settings gate edits to owner/admin and save through server-owned profile updates", () => {
  assert.match(tenantAccess, /export function canUpdateRestaurantProfile/);
  assert.match(settingsHub, /canUpdateRestaurantProfile/);
  assert.match(settingsHub, /\/settings\/restaurant/);
  assert.match(restaurantScreen, /canUpdateRestaurantProfile/);
  assert.match(restaurantScreen, /updateRestaurantProfile/);
  assert.match(restaurantScreen, /buildRestaurantIdentityPatch/);
  assert.match(restaurantScreen, /brand_color|brandColor/);
  assert.match(restaurantScreen, /accent_color|accentColor/);
  assert.match(restaurantScreen, /logo_url|logoUrl/);
  assert.match(application, /requireRestaurantProfilePatch/);
  const hostedSave =
    repository.match(/async updateRestaurantProfile\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedSave, /\.rpc\(\s*["']update_restaurant_profile["']/);
  assert.doesNotMatch(hostedSave, /service_role|SUPABASE_SERVICE|sk_live|openai/i);
  assert.doesNotMatch(restaurantScreen, /service_role|SUPABASE_SERVICE|sk_live|openai/i);
});

test("session applies restaurant identity updates locally after a successful save", () => {
  assert.match(session, /applyRestaurantProfile/);
  assert.match(restaurantScreen, /applyRestaurantProfile/);
  assert.match(rootLayout, /settings\/restaurant/);
  assert.match(routeSmoke, /\/settings\/restaurant/);
});
