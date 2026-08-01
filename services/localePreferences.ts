import AsyncStorage from "@react-native-async-storage/async-storage";

import { isAppLocale, type AppLocale } from "../i18n/catalog";

export type LocalePersistenceMode = "demo" | "hosted" | "session";

export interface LocalePreferenceAdapter {
  load(): Promise<AppLocale | null>;
  save(locale: AppLocale): Promise<void>;
}

/**
 * Contract for hosted preference persistence. Implementations must derive the
 * preference row exclusively from the authenticated backend session (for
 * example, auth.uid() / Edge actor). Restaurant IDs may be used only for Edge
 * firewall reservation and must never select another operator's preference.
 * The backend write path must allowlist AppLocale values.
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
 * Builds a validating adapter around repository/RPC hooks. Keeping preference
 * identity out of screen code makes it impossible for callers to select
 * another user's preference record. Restaurant scope is supplied by session
 * wiring only for Edge reservation.
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
