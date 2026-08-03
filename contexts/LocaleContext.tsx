import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { getLocales } from "expo-localization";
import { Platform } from "react-native";

import {
  detectDeviceLocale,
  matchSupportedLocale,
  translate,
  type AppLocale,
  type MessageKey,
  type MessageValues
} from "../i18n/catalog";
import {
  formatLocalizedCurrency,
  formatLocalizedCompactCurrency,
  formatLocalizedDate,
  formatLocalizedDueTime,
  formatLocalizedList,
  formatLocalizedNumber,
  formatLocalizedRelativeTime,
  parseLocalizedNumber,
  type DateFormatOptions,
  type DueTimeOptions,
  type LocalizedDateInput,
  type RelativeTimeOptions
} from "../i18n/formatters";
import { syncDocumentLanguage } from "../i18n/documentLanguage";
import {
  createHostedLocalePreferenceAdapter,
  demoLocalePreferenceAdapter,
  type HostedLocalePreferenceAdapter,
  type LocalePersistenceMode,
  type LocalePreferenceAdapter
} from "../services/localePreferences";
import { fetchMyPreferredLocale, updateMyPreferredLocale } from "../services/miseService";
import { useMiseSession } from "./MiseSessionContext";

type CurrencyFormatOptions = Omit<Intl.NumberFormatOptions, "style" | "currency"> & {
  currency?: string;
};

interface LocaleContextValue {
  locale: AppLocale;
  ready: boolean;
  saving: boolean;
  loadError: boolean;
  persistenceMode: LocalePersistenceMode;
  error: Error | null;
  setLocale: (locale: AppLocale) => Promise<void>;
  reload: (showLoading?: boolean) => void;
  clearError: () => void;
  t: (key: MessageKey, values?: MessageValues) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatList: (values: readonly string[], options?: Intl.ListFormatOptions) => string;
  parseNumber: (value: string) => number | null;
  formatCurrency: (value: number, options?: CurrencyFormatOptions) => string;
  formatCompactCurrency: (value: number, currency?: string) => string;
  formatDate: (value: LocalizedDateInput, options?: DateFormatOptions) => string;
  formatRelativeTime: (target: LocalizedDateInput, options?: RelativeTimeOptions) => string;
  formatDueTime: (target: LocalizedDateInput, options?: DueTimeOptions) => string;
}

interface LocaleProviderProps {
  children: ReactNode;
  /**
   * Optional test override. Production builds derive the hosted adapter from
   * the active session restaurant so locale writes can reserve
   * operational-workflows without letting screens pick a preference identity.
   */
  hostedPreferenceAdapter?: HostedLocalePreferenceAdapter | null;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children, hostedPreferenceAdapter = null }: LocaleProviderProps) {
  const { authUser, isDemoMode, ready: sessionReady, restaurant } = useMiseSession();
  const deviceLocale = useMemo(detectStartupLocale, []);
  const [locale, setLocaleState] = useState<AppLocale>(deviceLocale);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const requestIdRef = useRef(0);
  const activeScopeRef = useRef("boot");
  const loadedScopeRef = useRef<string | null>(null);
  const forceHardReloadRef = useRef(false);
  const restaurantId = restaurant?.id ?? null;

  const sessionHostedAdapter = useMemo<HostedLocalePreferenceAdapter | null>(() => {
    if (!authUser || !restaurantId) return null;
    return createHostedLocalePreferenceAdapter({
      loadCurrentOperatorLocale: () => fetchMyPreferredLocale(),
      async saveCurrentOperatorLocale(nextLocale) {
        await updateMyPreferredLocale(restaurantId, nextLocale);
      }
    });
  }, [authUser, restaurantId]);
  const resolvedHostedAdapter = hostedPreferenceAdapter ?? sessionHostedAdapter;

  const persistenceMode: LocalePersistenceMode = isDemoMode
    ? "demo"
    : authUser && resolvedHostedAdapter
      ? "hosted"
      : "session";
  const preferenceAdapter: LocalePreferenceAdapter | null =
    persistenceMode === "demo"
      ? demoLocalePreferenceAdapter
      : persistenceMode === "hosted"
        ? resolvedHostedAdapter
        : null;
  const scopeKey = isDemoMode
    ? "demo"
    : authUser
      ? `hosted:${authUser.id}:${restaurantId ?? "none"}`
      : "session";
  activeScopeRef.current = scopeKey;

  useEffect(() => {
    syncDocumentLanguage(locale, Platform.OS);
  }, [locale]);

  useEffect(() => {
    if (!sessionReady) return;

    const requestId = ++requestIdRef.current;
    const expectedScope = scopeKey;
    const soft = !forceHardReloadRef.current && loadedScopeRef.current === expectedScope;
    forceHardReloadRef.current = false;

    setError(null);
    setLoadError(false);
    setSaving(false);

    if (!preferenceAdapter) {
      loadedScopeRef.current = expectedScope;
      setReady(true);
      return;
    }

    if (!soft) {
      setLocaleState(deviceLocale);
      setReady(false);
    }

    preferenceAdapter
      .load()
      .then((storedLocale) => {
        if (requestId !== requestIdRef.current || activeScopeRef.current !== expectedScope) return;
        setLocaleState(storedLocale ?? deviceLocale);
        loadedScopeRef.current = expectedScope;
        setLoadError(false);
        setError(null);
      })
      .catch((loadFailure: unknown) => {
        if (requestId !== requestIdRef.current || activeScopeRef.current !== expectedScope) return;
        setLoadError(true);
        setError(normalizeError(loadFailure));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current || activeScopeRef.current !== expectedScope) return;
        setReady(true);
      });
  }, [deviceLocale, preferenceAdapter, reloadNonce, scopeKey, sessionReady]);

  const reload = useCallback((showLoading = false) => {
    if (showLoading) {
      loadedScopeRef.current = null;
      forceHardReloadRef.current = true;
      setReady(false);
    }
    setReloadNonce((value) => value + 1);
  }, []);

  const setLocale = useCallback(
    async (nextLocale: AppLocale) => {
      if (nextLocale === locale) return;

      const previousLocale = locale;
      const requestId = ++requestIdRef.current;
      const expectedScope = scopeKey;
      setLocaleState(nextLocale);
      setSaving(true);
      setError(null);
      setLoadError(false);

      try {
        await preferenceAdapter?.save(nextLocale);
        if (requestId === requestIdRef.current && activeScopeRef.current === expectedScope) {
          loadedScopeRef.current = expectedScope;
        }
      } catch (saveError) {
        if (requestId === requestIdRef.current && activeScopeRef.current === expectedScope) {
          setLocaleState(previousLocale);
          setError(normalizeError(saveError));
        }
        throw saveError;
      } finally {
        if (requestId === requestIdRef.current && activeScopeRef.current === expectedScope) {
          setSaving(false);
          setReady(true);
        }
      }
    },
    [locale, preferenceAdapter, scopeKey]
  );

  const clearError = useCallback(() => {
    setError(null);
    setLoadError(false);
  }, []);
  const t = useCallback((key: MessageKey, values?: MessageValues) => translate(locale, key, values), [locale]);
  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => formatLocalizedNumber(locale, value, options),
    [locale]
  );
  const formatList = useCallback(
    (values: readonly string[], options?: Intl.ListFormatOptions) => formatLocalizedList(locale, values, options),
    [locale]
  );
  const parseNumber = useCallback((value: string) => parseLocalizedNumber(locale, value), [locale]);
  const formatCurrency = useCallback(
    (value: number, options: CurrencyFormatOptions = {}) => {
      const { currency = restaurant?.currency ?? "USD", ...numberOptions } = options;
      return formatLocalizedCurrency(locale, value, currency, numberOptions);
    },
    [locale, restaurant?.currency]
  );
  const formatCompactCurrency = useCallback(
    (value: number, currency = restaurant?.currency ?? "USD") =>
      formatLocalizedCompactCurrency(locale, value, currency),
    [locale, restaurant?.currency]
  );
  const formatDate = useCallback(
    (value: LocalizedDateInput, options: DateFormatOptions = {}) =>
      formatLocalizedDate(locale, value, {
        ...options,
        timeZone: options.timeZone ?? restaurant?.timezone
      }),
    [locale, restaurant?.timezone]
  );
  const formatRelativeTime = useCallback(
    (target: LocalizedDateInput, options?: RelativeTimeOptions) =>
      formatLocalizedRelativeTime(locale, target, options),
    [locale]
  );
  const formatDueTime = useCallback(
    (target: LocalizedDateInput, options: DueTimeOptions = {}) =>
      formatLocalizedDueTime(locale, target, {
        ...options,
        timeZone: options.timeZone ?? restaurant?.timezone
      }),
    [locale, restaurant?.timezone]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      ready,
      saving,
      loadError,
      persistenceMode,
      error,
      setLocale,
      reload,
      clearError,
      t,
      formatNumber,
      formatList,
      parseNumber,
      formatCurrency,
      formatCompactCurrency,
      formatDate,
      formatRelativeTime,
      formatDueTime
    }),
    [
      clearError,
      error,
      formatCurrency,
      formatCompactCurrency,
      formatDate,
      formatDueTime,
      formatNumber,
      formatList,
      parseNumber,
      formatRelativeTime,
      loadError,
      locale,
      persistenceMode,
      ready,
      reload,
      saving,
      setLocale,
      t
    ]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Could not persist locale preference.");
}

function detectStartupLocale(): AppLocale {
  try {
    for (const locale of getLocales()) {
      const supported = matchSupportedLocale(locale.languageTag)
        ?? matchSupportedLocale(
          locale.languageCode && locale.languageScriptCode
            ? `${locale.languageCode}-${locale.languageScriptCode}`
            : locale.languageCode
        );
      if (supported) return supported;
    }
  } catch {
    // Node tests and older web runtimes may not provide the native module.
  }
  return detectDeviceLocale();
}
