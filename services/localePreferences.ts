import AsyncStorage from "@react-native-async-storage/async-storage";

import { isAppLocale, type AppLocale } from "../i18n/catalog";
import { supabase } from "../lib/supabase";

export type LocalePersistenceMode = "demo" | "hosted" | "session";

export interface LocalePreferenceAdapter {
  load(): Promise<AppLocale | null>;
  save(locale: AppLocale): Promise<void>;
}

/**
 * Contract for hosted preference persistence. Implementations must derive the
 * profile identity from the authenticated backend session (for example,
 * auth.uid()) and must never accept a user or restaurant ID from the Expo
 * client. The backend write path must allowlist AppLocale values.
 */
export interface HostedLocalePreferenceAdapter extends LocalePreferenceAdapter {
  readonly kind: "hosted";
}

const DEMO_LOCALE_STORAGE_KEY = "mise:operator-locale:v1:demo";
let demoWriteQueue: Promise<void> = Promise.resolve();

export const demoLocalePreferenceAdapter: LocalePreferenceAdapter = {
  async load() {
    const stored = await AsyncStorage.getItem(DEMO_LOCALE_STORAGE_KEY);
    return isAppLocale(stored) ? stored : null;
  },

  async save(locale) {
    const write = demoWriteQueue
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(DEMO_LOCALE_STORAGE_KEY, locale));
    demoWriteQueue = write;
    await write;
  }
};

/**
 * Builds a validating adapter around repository/RPC hooks. Keeping the hooks
 * identity-free makes it impossible for screen code to select another user's
 * preference record.
 */
export function createHostedLocalePreferenceAdapter(hooks: {
  loadCurrentOperatorLocale: () => Promise<unknown>;
  saveCurrentOperatorLocale: (locale: AppLocale) => Promise<void>;
}): HostedLocalePreferenceAdapter {
  return {
    kind: "hosted",
    async load() {
      const value = await hooks.loadCurrentOperatorLocale();
      return isAppLocale(value) ? value : null;
    },
    save(locale) {
      return hooks.saveCurrentOperatorLocale(locale);
    }
  };
}

/**
 * Stable production adapter. Both RPCs derive their target exclusively from
 * the active Supabase auth session; the client never sends an identity or
 * restaurant identifier.
 */
const configuredSupabase = supabase;

export const hostedLocalePreferenceAdapter: HostedLocalePreferenceAdapter | null = configuredSupabase
  ? createHostedLocalePreferenceAdapter({
      async loadCurrentOperatorLocale() {
        const { data, error } = await configuredSupabase.rpc("get_my_preferred_locale");
        if (error) throw error;
        return data;
      },
      async saveCurrentOperatorLocale(locale) {
        const { data, error } = await configuredSupabase.rpc("update_my_preferred_locale", {
          p_locale: locale
        });
        if (error) throw error;
        if (data !== locale) throw new Error("Locale preference update was not confirmed.");
      }
    })
  : null;
