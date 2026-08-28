import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260827140000_operator_notification_preferences.sql",
  "utf8"
);
const deliveriesMigration = readFileSync(
  "supabase/migrations/20260828123000_operator_notification_deliveries_category.sql",
  "utf8"
);
const adapter = readFileSync("services/notificationPreferences.ts", "utf8");
const preferenceContext = readFileSync("contexts/NotificationPreferencesContext.tsx", "utf8");
const rootLayout = readFileSync("app/_layout.tsx", "utf8");
const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");
const notificationsScreen = readFileSync("app/settings/notifications.tsx", "utf8");
const todayScreen = readFileSync("app/(tabs)/today.tsx", "utf8");
const homeScreen = readFileSync("app/(tabs)/home.tsx", "utf8");
const localeSecurity = readFileSync("tests/localePersistenceSecurity.test.ts", "utf8");

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

test("notification preference reads and writes stay identity-free like locale preferences", () => {
  assert.match(migration, /function public\.get_my_notification_preferences\(\)/i);
  assert.match(migration, /function public\.update_my_notification_preferences\(p_preferences jsonb\)/i);
  assert.match(
    migration,
    /grant execute on function public\.get_my_notification_preferences\(\) to authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.update_my_notification_preferences\(jsonb\) to authenticated/i
  );
  assert.match(
    migration,
    /revoke all on function public\.get_my_notification_preferences\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /revoke all on function public\.update_my_notification_preferences\(jsonb\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.doesNotMatch(migration, /notification_preferences\([^)]*(user|restaurant).*uuid/i);
  assert.match(localeSecurity, /get_my_preferred_locale/);
});

test("Expo notification preference persistence loads and saves through identity-free RPCs", () => {
  assert.match(adapter, /export function createHostedNotificationPreferenceAdapter/);
  assert.match(adapter, /hostedNotificationPreferenceAdapter/);
  assert.match(adapter, /configuredSupabase\.rpc\("get_my_notification_preferences"\)/);
  assert.match(
    adapter,
    /configuredSupabase\.rpc\("update_my_notification_preferences", \{\s*p_preferences: preferences\s*\}\)/
  );
  assert.doesNotMatch(adapter, /p_user_id|restaurantId|p_restaurant_id/);
  assert.match(
    preferenceContext,
    /hostedPreferenceAdapter/
  );
  assert.match(rootLayout, /<NotificationPreferencesProvider/);
  assert.match(rootLayout, /hostedPreferenceAdapter=\{hostedNotificationPreferenceAdapter\}/);
  assert.match(rootLayout, /settings\/notifications/);
});

test("settings, today, and home wire notification categories without push provider secrets", () => {
  assert.match(settingsHub, /settings\.preference\.notifications/);
  assert.match(settingsHub, /\/settings\/notifications/);
  assert.match(notificationsScreen, /NOTIFICATION_CATEGORIES/);
  assert.match(notificationsScreen, /deliveries/);
  assert.match(todayScreen, /filterOperatingPlanByNotificationPreferences/);
  assert.match(homeScreen, /filterOperatingBriefByNotificationPreferences/);
  assert.match(homeScreen, /filterOperationalTodayTasksByNotificationPreferences/);
  assert.doesNotMatch(notificationsScreen, /expo-notifications|FCM|APNs|push.?token/i);
  assert.doesNotMatch(adapter, /expo-notifications|FCM|APNs|push.?token/i);
});

test("deliveries category remains allowlisted RPC metadata and never an authorization input", () => {
  assert.match(deliveriesMigration, /'deliveries'/);
  assert.match(deliveriesMigration, /never use for restaurant authorization/i);
  assert.match(
    deliveriesMigration,
    /revoke update \(notification_preferences\) on table public\.users from authenticated/i
  );
  assert.match(
    deliveriesMigration,
    /key not in \([\s\S]*'deliveries'[\s\S]*\)/
  );
  assert.doesNotMatch(deliveriesMigration, /grant update[^;]*notification_preferences[^;]*authenticated/i);
});
