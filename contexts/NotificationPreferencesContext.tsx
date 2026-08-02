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
import { useMiseSession } from "./MiseSessionContext";

interface NotificationPreferencesContextValue {
  preferences: OperatorNotificationPreferences;
  ready: boolean;
  saving: boolean;
  persistenceMode: NotificationPreferencePersistenceMode;
  error: Error | null;
  setCategoryEnabled: (category: NotificationCategory, enabled: boolean) => Promise<void>;
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
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);
  const activeScopeRef = useRef("boot");
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
    setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    setError(null);
    setSaving(false);

    if (!preferenceAdapter) {
      setReady(true);
      return;
    }

    setReady(false);
    preferenceAdapter
      .load()
      .then((stored) => {
        if (requestId !== requestIdRef.current || activeScopeRef.current !== expectedScope) return;
        setPreferences(stored ?? DEFAULT_NOTIFICATION_PREFERENCES);
      })
      .catch((loadError: unknown) => {
        if (requestId !== requestIdRef.current || activeScopeRef.current !== expectedScope) return;
        setError(normalizeError(loadError));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current || activeScopeRef.current !== expectedScope) return;
        setReady(true);
      });
  }, [preferenceAdapter, scopeKey, sessionReady]);

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

      try {
        await preferenceAdapter?.save(normalizeNotificationPreferences(next));
      } catch (saveError) {
        if (requestId === requestIdRef.current && activeScopeRef.current === expectedScope) {
          setPreferences(previous);
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
    [preferenceAdapter, preferences, scopeKey]
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<NotificationPreferencesContextValue>(
    () => ({
      preferences,
      ready,
      saving,
      persistenceMode,
      error,
      setCategoryEnabled,
      clearError
    }),
    [clearError, error, persistenceMode, preferences, ready, saving, setCategoryEnabled]
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
