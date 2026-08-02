import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  normalizeNotificationPreferences,
  type OperatorNotificationPreferences
} from "./domain/notificationPreferences";

export type NotificationPreferencePersistenceMode = "demo" | "hosted" | "session";

export interface NotificationPreferenceAdapter {
  load(): Promise<OperatorNotificationPreferences | null>;
  save(preferences: OperatorNotificationPreferences): Promise<void>;
}

/**
 * Contract for hosted preference persistence. Implementations must derive the
 * preference row exclusively from the authenticated backend session. Restaurant
 * IDs may be used only for Edge firewall reservation and must never select
 * another operator's preference. Writes must allowlist category booleans.
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
