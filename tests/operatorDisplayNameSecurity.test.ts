import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260802180000_operator_display_name_read.sql",
  "utf8"
);
const session = readFileSync("contexts/MiseSessionContext.tsx", "utf8");
const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
const application = readFileSync("services/application/restaurant.ts", "utf8");
const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");
const profileScreen = readFileSync("app/settings/profile.tsx", "utf8");
const rootLayout = readFileSync("app/_layout.tsx", "utf8");
const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");

test("operator display-name reads are identity-free and do not grant profile mutation", () => {
  assert.match(migration, /function public\.get_my_display_name\(\)/i);
  assert.match(migration, /Identity-free profile reads prevent callers from probing another user ID/i);
  assert.match(migration, /never use for restaurant authorization/i);
  assert.match(migration, /grant execute on function public\.get_my_display_name\(\)[\s\S]*authenticated/i);
  assert.doesNotMatch(migration, /grant update[^;]*on table public\.users[^;]*authenticated/i);
  assert.doesNotMatch(migration, /create policy[\s\S]*on public\.users[\s\S]*for update/i);
  assert.match(
    migration,
    /revoke all on function public\.get_my_display_name\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
});

test("Expo loads display names without caller-selected user ids and saves through Edge update_my_profile", () => {
  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const hostedLoad =
    hostedRepository.match(/async fetchMyDisplayName\([\s\S]*?\n    \},/)?.[0] ?? "";
  const hostedSave =
    hostedRepository.match(/async updateMyProfile\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedLoad, /\.rpc\(\s*["']get_my_display_name["']/);
  assert.doesNotMatch(hostedLoad, /p_user_id|userId/);
  assert.match(hostedSave, /action:\s*"update_my_profile"/);
  assert.doesNotMatch(hostedSave, /\.rpc\(\s*["']update_my_profile["']/);
  assert.match(application, /normalizeOperatorDisplayName/);
  assert.match(session, /fetchMyDisplayName/);
  assert.match(session, /resolveOperatorDisplayName/);
  assert.match(session, /applyOperatorDisplayName/);
});

test("settings exposes an operator profile display-name screen without push secrets", () => {
  assert.match(settingsHub, /settings\.preference\.profile/);
  assert.match(settingsHub, /\/settings\/profile/);
  assert.match(profileScreen, /updateMyProfile/);
  assert.match(profileScreen, /normalizeOperatorDisplayName|updateMyProfile/);
  assert.match(rootLayout, /settings\/profile/);
  assert.match(routeSmoke, /\/settings\/profile/);
  assert.doesNotMatch(profileScreen, /expo-notifications|FCM|APNs|push.?token/i);
});
