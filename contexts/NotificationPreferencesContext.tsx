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

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  toggleNotificationCategory,
  type NotificationCategory,
  type OperatorNotificationPreferences
} from "../services/domain/notificationPreferences";
import {
  createHostedNotificationPreferenceAdapter,
  demoNotificationPreferenceAdapter,
  type HostedNotificationPreferenceAdapter,
  type NotificationPreferenceAdapter,
  type NotificationPreferencePersistenceMode
} from "../services/notificationPreferences";
import {
  fetchMyNotificationPreferences,
  updateMyNotificationPreferences
} from "../services/miseService";
import { isTenantAuthorizationError } from "../services/tenantAuthorizationEvents";
import { useMiseSession } from "./MiseSessionContext";

interface NotificationPreferencesContextValue {
  preferences: OperatorNotificationPreferences;
  ready: boolean;
  saving: boolean;
  loadError: boolean;
  persistenceMode: NotificationPreferencePersistenceMode;
  error: Error | null;
  setCategoryEnabled: (category: NotificationCategory, enabled: boolean) => Promise<void>;
  reload: (showLoading?: boolean) => void;
  clearError: () => void;
}

interface NotificationPreferencesProviderProps {
  children: ReactNode;
  /**
   * Optional test override. Production builds derive the hosted adapter from
   * the active session restaurant so preference writes can reserve
   * operational-workflows without letting screens pick a preference identity.
   */
  hostedPreferenceAdapter?: HostedNotificationPreferenceAdapter | null;
}

const NotificationPreferencesContext = createContext<NotificationPreferencesContextValue | null>(
  null
);

export function NotificationPreferencesProvider({
  children,
  hostedPreferenceAdapter = null
}: NotificationPreferencesProviderProps) {
  const { authUser, isDemoMode, ready: sessionReady, restaurant } = useMiseSession();
  const [preferences, setPreferences] = useState<OperatorNotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
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

  const sessionHostedAdapter = useMemo<HostedNotificationPreferenceAdapter | null>(() => {
    if (!authUser || !restaurantId) return null;
    return createHostedNotificationPreferenceAdapter({
      loadCurrentOperatorNotificationPreferences: () => fetchMyNotificationPreferences(),
      async saveCurrentOperatorNotificationPreferences(nextPreferences) {
        await updateMyNotificationPreferences(restaurantId, nextPreferences);
      }
    });
  }, [authUser, restaurantId]);
  const resolvedHostedAdapter = hostedPreferenceAdapter ?? sessionHostedAdapter;

  const persistenceMode: NotificationPreferencePersistenceMode = isDemoMode
    ? "demo"
    : authUser && resolvedHostedAdapter
      ? "hosted"
      : "session";
  const preferenceAdapter: NotificationPreferenceAdapter | null =
    persistenceMode === "demo"
      ? demoNotificationPreferenceAdapter
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
    if (!sessionReady) return;

    const requestId = ++requestIdRef.current;
    const expectedScope = scopeKey;
    const soft = !forceHardReloadRef.current && loadedScopeRef.current === expectedScope;
    forceHardReloadRef.current = false;

    setSaving(false);

    if (!preferenceAdapter) {
      loadedScopeRef.current = expectedScope;
      setLoadError(false);
      setError(null);
      setReady(true);
      return;
    }

    if (!soft) {
      setError(null);
      setLoadError(false);
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      setReady(false);
    }
    // Soft-refresh keeps loadError sticky until success so settings cannot
    // become interactive again while a denied/stale hosted scope is reloading.

    preferenceAdapter
      .load()
      .then((stored) => {
        if (requestId !== requestIdRef.current || activeScopeRef.current !== expectedScope) return;
        setPreferences(stored ?? DEFAULT_NOTIFICATION_PREFERENCES);
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
  }, [preferenceAdapter, reloadNonce, scopeKey, sessionReady]);

  const reload = useCallback((showLoading = false) => {
    if (showLoading) {
      loadedScopeRef.current = null;
      forceHardReloadRef.current = true;
      setReady(false);
    }
    setReloadNonce((value) => value + 1);
  }, []);

  const setCategoryEnabled = useCallback(
    async (category: NotificationCategory, enabled: boolean) => {
      const previous = preferences;
      if (previous[category] === enabled) return;

      const next = toggleNotificationCategory(previous, category, enabled);
      const requestId = ++requestIdRef.current;
      const expectedScope = scopeKey;
      setPreferences(next);
      setSaving(true);
      setError(null);
      setLoadError(false);

      try {
        await preferenceAdapter?.save(normalizeNotificationPreferences(next));
        if (requestId === requestIdRef.current && activeScopeRef.current === expectedScope) {
          loadedScopeRef.current = expectedScope;
        }
      } catch (saveError) {
        if (requestId === requestIdRef.current && activeScopeRef.current === expectedScope) {
          setPreferences(previous);
          setError(normalizeError(saveError));
          if (isTenantAuthorizationError(saveError)) {
            setLoadError(true);
          }
        }
        throw saveError;
      } finally {
        if (requestId === requestIdRef.current && activeScopeRef.current === expectedScope) {
          setSaving(false);
          setReady(true);
        }
      }
    },
    [preferenceAdapter, preferences, scopeKey]
  );

  const clearError = useCallback(() => {
    setError(null);
    setLoadError(false);
  }, []);

  const value = useMemo<NotificationPreferencesContextValue>(
    () => ({
      preferences,
      ready,
      saving,
      loadError,
      persistenceMode,
      error,
      setCategoryEnabled,
      reload,
      clearError
    }),
    [clearError, error, loadError, persistenceMode, preferences, ready, reload, saving, setCategoryEnabled]
  );

  return (
    <NotificationPreferencesContext.Provider value={value}>
      {children}
    </NotificationPreferencesContext.Provider>
  );
}

export function useNotificationPreferences(): NotificationPreferencesContextValue {
  const context = useContext(NotificationPreferencesContext);
  if (!context) {
    throw new Error("useNotificationPreferences must be used inside NotificationPreferencesProvider");
  }
  return context;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Notification preference update failed.");
}
