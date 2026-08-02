import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260802170000_operator_notification_preferences.sql",
  "utf8"
);
const adapter = readFileSync("services/notificationPreferences.ts", "utf8");
const preferenceContext = readFileSync("contexts/NotificationPreferencesContext.tsx", "utf8");
const rootLayout = readFileSync("app/_layout.tsx", "utf8");
const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");
const notificationsScreen = readFileSync("app/settings/notifications.tsx", "utf8");
const todayScreen = readFileSync("app/(tabs)/today.tsx", "utf8");
const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");

test("operator notification preference schema is allowlisted metadata with no direct mutation grant", () => {
  assert.match(migration, /add column if not exists notification_preferences jsonb/i);
  assert.match(migration, /never use for restaurant authorization/i);
  assert.match(
    migration,
    /revoke update \(notification_preferences\) on table public\.users from authenticated/i
  );
  assert.doesNotMatch(migration, /grant update[^;]*notification_preferences[^;]*authenticated/i);
  assert.match(migration, /key not in \([\s\S]*'recipes_pos'[\s\S]*\)/);
});

test("notification preference reads stay identity-free while writes are service-owned Edge mutations", () => {
  assert.match(migration, /function public\.get_my_notification_preferences\(\)/i);
  assert.match(migration, /function public\.update_my_notification_preferences\(p_preferences jsonb\)/i);
  assert.match(migration, /private\.service_update_my_notification_preferences/i);
  assert.match(
    migration,
    /grant execute on function public\.service_update_my_notification_preferences[\s\S]*service_role/i
  );
  assert.match(migration, /revoke all on function public\.update_my_notification_preferences\(jsonb\)/i);
  assert.match(
    migration,
    /Preference row is always the Edge-authenticated actor|the preference row is always the Edge-authenticated actor/i
  );
});

test("Expo notification preference persistence loads identity-free and saves through Edge with session restaurant scope", () => {
  assert.match(adapter, /export function createHostedNotificationPreferenceAdapter/);
  assert.doesNotMatch(adapter, /p_user_id/);
  assert.doesNotMatch(adapter, /hostedNotificationPreferenceAdapter\s*=/);
  assert.match(preferenceContext, /createHostedNotificationPreferenceAdapter/);
  assert.match(preferenceContext, /fetchMyNotificationPreferences/);
  assert.match(
    preferenceContext,
    /updateMyNotificationPreferences\(restaurantId, nextPreferences\)/
  );
  assert.match(rootLayout, /<NotificationPreferencesProvider>/);
  assert.match(rootLayout, /settings\/notifications/);
  assert.doesNotMatch(rootLayout, /hostedPreferenceAdapter=\{/);

  const hostedRepository = repository.match(/function createSupabaseRepository\([\s\S]*$/)?.[0] ?? "";
  const hostedSave =
    hostedRepository.match(/async updateMyNotificationPreferences\([\s\S]*?\n    \},/)?.[0] ?? "";
  const hostedLoad =
    hostedRepository.match(/async fetchMyNotificationPreferences\([\s\S]*?\n    \},/)?.[0] ?? "";
  assert.match(hostedLoad, /\.rpc\(\s*["']get_my_notification_preferences["']/);
  assert.match(hostedSave, /action:\s*"update_my_notification_preferences"/);
  assert.doesNotMatch(hostedSave, /\.rpc\(\s*["']update_my_notification_preferences["']/);
  assert.match(edge, /"update_my_notification_preferences"/);
  assert.match(edge, /service_update_my_notification_preferences/);
  assert.match(securityBackend, /public\.update_my_notification_preferences/);
  assert.match(securityBackend, /public\.service_update_my_notification_preferences/);
});

test("settings and today wire notification categories without push provider secrets", () => {
  assert.match(settingsHub, /settings\.preference\.notifications/);
  assert.match(settingsHub, /\/settings\/notifications/);
  assert.match(notificationsScreen, /NOTIFICATION_CATEGORIES/);
  assert.match(todayScreen, /filterOperationalTodayTasksByNotificationPreferences/);
  assert.match(todayScreen, /countHiddenOperationalTodayTasksByNotificationPreferences/);
  assert.match(todayScreen, /classifyTodayServicePulse/);
  assert.match(todayScreen, /\/settings\/notifications/);
  assert.match(todayScreen, /today\.tasks\.mutedTitle/);
  assert.doesNotMatch(notificationsScreen, /expo-notifications|FCM|APNs|push.?token/i);
  assert.doesNotMatch(adapter, /expo-notifications|FCM|APNs|push.?token/i);
});
