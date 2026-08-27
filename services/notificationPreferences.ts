import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  normalizeNotificationPreferences,
  type OperatorNotificationPreferences
} from "./domain/notificationPreferences";
import { supabase } from "../lib/supabase";

export type NotificationPreferencePersistenceMode = "demo" | "hosted" | "session";

export interface NotificationPreferenceAdapter {
  load(): Promise<OperatorNotificationPreferences | null>;
  save(preferences: OperatorNotificationPreferences): Promise<void>;
}

/**
 * Contract for hosted preference persistence. Implementations must derive the
 * preference row exclusively from the authenticated backend session
 * (auth.uid()) and must never accept a user or restaurant ID from the Expo
 * client. Writes must allowlist category booleans.
 */
export interface HostedNotificationPreferenceAdapter extends NotificationPreferenceAdapter {
  readonly kind: "hosted";
}

const DEMO_NOTIFICATION_PREFERENCE_STORAGE_KEY = "mise:operator-notification-prefs:v1:demo";
let demoWriteQueue: Promise<void> = Promise.resolve();

export const demoNotificationPreferenceAdapter: NotificationPreferenceAdapter = {
  async load() {
    const stored = await AsyncStorage.getItem(DEMO_NOTIFICATION_PREFERENCE_STORAGE_KEY);
    if (!stored) return null;
    try {
      return normalizeNotificationPreferences(JSON.parse(stored));
    } catch {
      return null;
    }
  },

  async save(preferences) {
    const normalized = normalizeNotificationPreferences(preferences);
    const write = demoWriteQueue
      .catch(() => undefined)
      .then(() =>
        AsyncStorage.setItem(DEMO_NOTIFICATION_PREFERENCE_STORAGE_KEY, JSON.stringify(normalized))
      );
    demoWriteQueue = write;
    await write;
  }
};

/**
 * Builds a validating adapter around repository/RPC hooks. Preference identity
 * stays out of screen code so callers cannot select another user's row.
 */
export function createHostedNotificationPreferenceAdapter(hooks: {
  loadCurrentOperatorNotificationPreferences: () => Promise<unknown>;
  saveCurrentOperatorNotificationPreferences: (
    preferences: OperatorNotificationPreferences
  ) => Promise<void>;
}): HostedNotificationPreferenceAdapter {
  return {
    kind: "hosted",
    async load() {
      const value = await hooks.loadCurrentOperatorNotificationPreferences();
      return value == null ? null : normalizeNotificationPreferences(value);
    },
    async save(preferences) {
      await hooks.saveCurrentOperatorNotificationPreferences(
        normalizeNotificationPreferences(preferences)
      );
    }
  };
}

/**
 * Stable production adapter. Both RPCs derive their target exclusively from
 * the active Supabase auth session; the client never sends an identity or
 * restaurant identifier.
 */
const configuredSupabase = supabase;

export const hostedNotificationPreferenceAdapter: HostedNotificationPreferenceAdapter | null =
  configuredSupabase
    ? createHostedNotificationPreferenceAdapter({
        async loadCurrentOperatorNotificationPreferences() {
          const { data, error } = await configuredSupabase.rpc("get_my_notification_preferences");
          if (error) throw error;
          return data;
        },
        async saveCurrentOperatorNotificationPreferences(preferences) {
          const { data, error } = await configuredSupabase.rpc("update_my_notification_preferences", {
            p_preferences: preferences
          });
          if (error) throw error;
          const confirmed = normalizeNotificationPreferences(data);
          for (const category of Object.keys(preferences) as (keyof OperatorNotificationPreferences)[]) {
            if (confirmed[category] !== preferences[category]) {
              throw new Error("Notification preference update was not confirmed.");
            }
          }
        }
      })
    : null;
