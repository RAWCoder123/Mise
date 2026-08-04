import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { AppState } from "react-native";

import { canUseDemoMode as canUseDemoModeForConfig, readPublicAppConfig } from "../lib/appConfig";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  extractAuthCallbackParams,
  isAuthSessionCallback,
  isPasswordRecoveryAuthEvent,
  isRecoveryCallback,
  isValidRecoveryEmail,
  normalizeRecoveryEmail,
  PASSWORD_RESET_PATH,
  validateNewPassword
} from "../services/domain/authRecovery";
import {
  isDuplicateAuthIdentity,
  isValidSignupEmail,
  normalizeSignupEmail,
  type SignUpOutcome,
  validateSignupPassword
} from "../services/domain/authSignup";
import { resolveOperatorDisplayName } from "../services/domain/operatorDisplayName";
import { buildInviteClaimPath } from "../services/domain/teamInvites";
import { readPendingInviteToken } from "../lib/pendingInvite";
import type {
  AppUser,
  PosProvider,
  Restaurant,
  RestaurantMembership,
  RestaurantOperationalProfile,
  RestaurantRole
} from "../types/mise";
import type { DemoSetupProfile } from "../services/demoData";
import {
  DEMO_DATASET,
  DEMO_RESTAURANT_ID,
  DEMO_USER_ID,
  isDemoDatasetRestaurantName
} from "../services/demoData";
import {
  createRestaurantWithOwner,
  fetchMembershipsForAuthUser,
  fetchMyDisplayName,
  fetchPOSStatus,
  fetchRestaurant,
  loadDemoPOSData,
  resetDemoData as resetDemoService,
  updateRestaurantProfile
} from "../services/miseService";
import { activeMembershipForRestaurant, requireRestaurantAccess } from "../services/tenantAccess";
import { captureMiseError } from "../services/telemetry";
import { subscribeToTenantAuthorizationDenials } from "../services/tenantAuthorizationEvents";

interface SessionSnapshot {
  user?: AppUser | null;
  activeRestaurantId: string | null;
  isDemoMode?: boolean;
}

interface MiseSessionContextValue {
  ready: boolean;
  isLoading: boolean;
  user: AppUser | null;
  authUser: SupabaseUser | null;
  restaurant: Restaurant | null;
  activeRestaurantId: string | null;
  activeRestaurant: Restaurant | null;
  availableRestaurants: Restaurant[];
  memberships: RestaurantMembership[];
  role: RestaurantRole | null;
  posProvider: PosProvider | null;
  posStatusLabel: string;
  posStatusRestaurantId: string | null;
  posStatusError: boolean;
  isDemoMode: boolean;
  usingLocalDemo: boolean;
  canUseDemoMode: boolean;
  passwordRecoveryPending: boolean;
  passwordRecoveryLinkError: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpOutcome>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordReset: (password: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  clearPasswordRecoveryLinkError: () => void;
  continueWithDemo: (profile?: { name?: string; cuisine_type?: string; posProvider?: PosProvider } & DemoSetupProfile) => Promise<void>;
  createRestaurant: (profile: {
    name: string;
    cuisine_type?: string | null;
    operational_profile?: RestaurantOperationalProfile;
  }) => Promise<Restaurant>;
  switchRestaurant: (restaurantId: string) => Promise<void>;
  connectDemoPOS: (provider: PosProvider) => Promise<void>;
  refreshPosStatus: () => Promise<void>;
  refreshSession: () => Promise<void>;
  applyOperatorDisplayName: (name: string) => Promise<void>;
  applyRestaurantProfile: (restaurant: Restaurant) => Promise<void>;
  resetDemoData: (profile?: { posProvider?: PosProvider } & DemoSetupProfile) => Promise<void>;
  signOut: () => Promise<void>;
  /** Best-effort remote revoke + always clear local session after Auth account deletion. */
  clearLocalSessionAfterAccountDeletion: () => Promise<void>;
}

const PASSWORD_RECOVERY_STORAGE_KEY = "mise:password-recovery:v1";

const STORAGE_KEY = "mise:session:v2";
const appConfig = readPublicAppConfig();
const demoModeAvailable = canUseDemoModeForConfig(appConfig) && !isSupabaseConfigured;

const MiseSessionContext = createContext<MiseSessionContextValue | null>(null);

function appUserFromAuth(
  authUser: SupabaseUser,
  restaurantId: string | null,
  role: RestaurantRole | null,
  displayName?: string | null
): AppUser {
  const email = authUser.email ?? "";
  return {
    id: authUser.id,
    restaurant_id: restaurantId,
    name: resolveOperatorDisplayName(displayName, email),
    email,
    role: role ?? "staff",
    created_at: authUser.created_at ?? new Date().toISOString()
  };
}

export function MiseSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [availableRestaurants, setAvailableRestaurants] = useState<Restaurant[]>([]);
  const [memberships, setMemberships] = useState<RestaurantMembership[]>([]);
  const [role, setRole] = useState<RestaurantRole | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [posProvider, setPosProvider] = useState<PosProvider | null>(null);
  const [posStatusLabel, setPosStatusLabel] = useState("Not connected");
  const [posStatusRestaurantId, setPosStatusRestaurantId] = useState<string | null>(null);
  const [posStatusError, setPosStatusError] = useState(false);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  const [passwordRecoveryLinkError, setPasswordRecoveryLinkError] = useState(false);
  const activeRestaurantIdRef = useRef<string | null>(null);
  const posRequestIdRef = useRef(0);
  const posStatusRestaurantIdRef = useRef<string | null>(null);
  const switchRequestIdRef = useRef(0);
  const sessionRequestIdRef = useRef(0);
  const storageQueueRef = useRef<Promise<void>>(Promise.resolve());

  const activeRestaurantId = restaurant?.id ?? null;
  activeRestaurantIdRef.current = activeRestaurantId;

  const clearPosStatus = useCallback(() => {
    setPosProvider(null);
    setPosStatusLabel("Not connected");
    setPosStatusRestaurantId(null);
    posStatusRestaurantIdRef.current = null;
    setPosStatusError(false);
  }, []);

  const settlePosStatus = useCallback(
    (
      restaurantId: string | null,
      next: { provider: PosProvider | null; label: string } | null,
      failed = false
    ) => {
      setPosProvider(next?.provider ?? null);
      setPosStatusLabel(next?.label ?? (failed ? "Unavailable" : "Not connected"));
      setPosStatusRestaurantId(restaurantId);
      posStatusRestaurantIdRef.current = restaurantId;
      setPosStatusError(failed);
    },
    []
  );

  const refreshPOS = useCallback(async (restaurantId?: string | null) => {
    const expectedRestaurantId = restaurantId ?? null;
    const requestId = ++posRequestIdRef.current;
    // Never keep another restaurant's POS provider visible while the next status loads.
    if (posStatusRestaurantIdRef.current !== expectedRestaurantId) {
      clearPosStatus();
    }
    try {
      const status = await fetchPOSStatus(expectedRestaurantId);
      if (
        requestId !== posRequestIdRef.current ||
        activeRestaurantIdRef.current !== expectedRestaurantId
      ) {
        return;
      }
      settlePosStatus(expectedRestaurantId, {
        provider: status.provider,
        label: status.label
      });
    } catch (error) {
      if (
        requestId !== posRequestIdRef.current ||
        activeRestaurantIdRef.current !== expectedRestaurantId
      ) {
        return;
      }
      settlePosStatus(expectedRestaurantId, null, true);
      captureMiseError(error, {
        flow: "pos_status",
        operation: "refresh",
        restaurant_id: expectedRestaurantId
      });
    }
  }, [clearPosStatus, settlePosStatus]);

  const saveSnapshot = useCallback(async (snapshot: SessionSnapshot) => {
    const write = storageQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)));
    storageQueueRef.current = write;
    await write;
  }, []);

  const markPasswordRecovery = useCallback(async () => {
    setPasswordRecoveryLinkError(false);
    setPasswordRecoveryPending(true);
    try {
      await AsyncStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "1");
    } catch {
      // Best-effort persistence for cold starts after the recovery deep link.
    }
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecoveryPending(false);
    void AsyncStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY).catch(() => undefined);
  }, []);

  const clearPasswordRecoveryLinkError = useCallback(() => {
    setPasswordRecoveryLinkError(false);
  }, []);

  const clearSessionState = useCallback(async () => {
    sessionRequestIdRef.current += 1;
    switchRequestIdRef.current += 1;
    posRequestIdRef.current += 1;
    activeRestaurantIdRef.current = null;
    clearPosStatus();
    setUser(null);
    setAuthUser(null);
    setRestaurant(null);
    setAvailableRestaurants([]);
    setMemberships([]);
    setRole(null);
    setIsDemoMode(false);
    const removal = storageQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.removeItem(STORAGE_KEY));
    storageQueueRef.current = removal;
    await removal;
  }, [clearPosStatus]);

  const hydrateSupabaseUser = useCallback(
    async (nextAuthUser: SupabaseUser, preferredRestaurantId?: string | null) => {
      const sessionRequestId = ++sessionRequestIdRef.current;
      setIsLoading(true);
      setAuthUser(nextAuthUser);
      setIsDemoMode(false);

      const [nextMemberships, storedDisplayName] = await Promise.all([
        fetchMembershipsForAuthUser(nextAuthUser.id),
        fetchMyDisplayName().catch(() => null)
      ]);
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      setMemberships(nextMemberships);

      if (nextMemberships.length === 0) {
        activeRestaurantIdRef.current = null;
        setRestaurant(null);
        setAvailableRestaurants([]);
        setRole(null);
        setUser(appUserFromAuth(nextAuthUser, null, null, storedDisplayName));
        await refreshPOS(null);
        if (sessionRequestId !== sessionRequestIdRef.current) return;
        await saveSnapshot({ activeRestaurantId: null, isDemoMode: false });
        if (sessionRequestId !== sessionRequestIdRef.current) return;
        setIsLoading(false);
        return;
      }

      const restaurants = await Promise.all(
        nextMemberships.map((membership) => fetchRestaurant(membership.restaurant_id))
      );
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      setAvailableRestaurants(restaurants);

      const preferredMembership = preferredRestaurantId
        ? activeMembershipForRestaurant(nextMemberships, preferredRestaurantId)
        : null;
      const activeMembership = preferredMembership ?? nextMemberships[0]!;
      const activeRestaurant =
        restaurants.find((item) => item.id === activeMembership.restaurant_id) ?? restaurants[0] ?? null;

      activeRestaurantIdRef.current = activeRestaurant?.id ?? null;
      setRestaurant(activeRestaurant);
      setRole(activeMembership.role);
      setUser(
        appUserFromAuth(
          nextAuthUser,
          activeRestaurant?.id ?? null,
          activeMembership.role,
          storedDisplayName
        )
      );
      await refreshPOS(activeRestaurant?.id ?? null);
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      await saveSnapshot({ activeRestaurantId: activeRestaurant?.id ?? null, isDemoMode: false });
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      setIsLoading(false);
    },
    [refreshPOS, saveSnapshot]
  );

  const hydrateLocalDemo = useCallback(
    async (snapshot?: SessionSnapshot | null) => {
      const sessionRequestId = ++sessionRequestIdRef.current;
      if (!demoModeAvailable) {
        await clearSessionState();
        setIsLoading(false);
        return;
      }

      const restaurantId = snapshot?.activeRestaurantId ?? DEMO_RESTAURANT_ID;
      const [nextRestaurant, storedDisplayName] = await Promise.all([
        fetchRestaurant(restaurantId),
        fetchMyDisplayName().catch(() => null)
      ]);
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      const fallbackUser: AppUser = snapshot?.user ?? {
        id: DEMO_USER_ID,
        restaurant_id: DEMO_RESTAURANT_ID,
        name: DEMO_DATASET.user.name,
        email: DEMO_DATASET.user.email,
        role: "owner",
        created_at: new Date().toISOString()
      };
      const demoUser: AppUser = {
        ...fallbackUser,
        restaurant_id: nextRestaurant.id,
        name: resolveOperatorDisplayName(
          storedDisplayName ?? fallbackUser.name,
          fallbackUser.email
        )
      };
      const demoMembership: RestaurantMembership = {
        id: `membership_${DEMO_USER_ID}`,
        restaurant_id: nextRestaurant.id,
        user_id: DEMO_USER_ID,
        role: "owner",
        status: "active",
        created_at: demoUser.created_at,
        updated_at: demoUser.created_at
      };

      activeRestaurantIdRef.current = nextRestaurant.id;
      setAuthUser(null);
      setUser(demoUser);
      setRestaurant(nextRestaurant);
      setAvailableRestaurants([nextRestaurant]);
      setMemberships([demoMembership]);
      setRole("owner");
      setIsDemoMode(true);
      await refreshPOS(nextRestaurant.id);
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      await saveSnapshot({ user: demoUser, activeRestaurantId: nextRestaurant.id, isDemoMode: true });
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      setIsLoading(false);
    },
    [clearSessionState, refreshPOS, saveSnapshot]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoading(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const snapshot = raw ? (JSON.parse(raw) as SessionSnapshot) : null;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted) return;
        if (error || !data.user) {
          await clearSessionState();
          setIsLoading(false);
          setReady(true);
          return;
        }
        await hydrateSupabaseUser(data.user, snapshot?.activeRestaurantId ?? null);
        if (mounted) setReady(true);
        return;
      }

      if (snapshot?.isDemoMode) {
        await hydrateLocalDemo(snapshot);
      } else {
        await clearSessionState();
        setIsLoading(false);
      }
      if (mounted) setReady(true);
    }

    load().catch(async (error) => {
      if (!mounted) return;
      captureMiseError(error, { flow: "session_hydration" });
      await clearSessionState();
      setIsLoading(false);
      setReady(true);
    });

    if (!isSupabaseConfigured || !supabase) {
      return () => {
        mounted = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (isPasswordRecoveryAuthEvent(event)) {
        void markPasswordRecovery();
      }
      if (session?.user) {
        hydrateSupabaseUser(session.user).catch((error) => {
          captureMiseError(error, { flow: "auth_state_change" });
          clearSessionState();
        });
      } else {
        clearSessionState();
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [clearSessionState, hydrateLocalDemo, hydrateSupabaseUser, markPasswordRecovery]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let mounted = true;

    async function consumeAuthCallback(url: string | null) {
      if (!url || !supabase) return;
      const params = extractAuthCallbackParams(url);
      if (!isAuthSessionCallback(params)) return;
      const recoveryCallback = isRecoveryCallback(params, url);

      try {
        if (params.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) throw error;
        } else if (params.accessToken && params.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken
          });
          if (error) throw error;
        }
        if (recoveryCallback && mounted) {
          await markPasswordRecovery();
        }
      } catch (callbackError) {
        if (recoveryCallback) {
          captureMiseError(callbackError, { flow: "password_recovery", operation: "auth_callback" });
          if (mounted) {
            setPasswordRecoveryPending(false);
            setPasswordRecoveryLinkError(true);
          }
          return;
        }
        captureMiseError(callbackError, { flow: "auth", operation: "auth_callback" });
      }
    }

    void AsyncStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY)
      .then((value) => {
        if (mounted && value === "1") setPasswordRecoveryPending(true);
      })
      .catch(() => undefined);

    void Linking.getInitialURL()
      .then((url) => consumeAuthCallback(url))
      .catch((error) => captureMiseError(error, { flow: "password_recovery", operation: "initial_url" }));

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void consumeAuthCallback(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [markPasswordRecovery]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUser) return;

    let mounted = true;
    let refreshing = false;

    const membershipSignature = (items: RestaurantMembership[]) =>
      items
        .map((membership) => `${membership.restaurant_id}:${membership.user_id}:${membership.role}:${membership.status}`)
        .sort()
        .join("|");

    const revalidateLiveMemberships = async () => {
      if (!mounted || refreshing) return;
      refreshing = true;
      try {
        const nextMemberships = await fetchMembershipsForAuthUser(authUser.id);
        if (!mounted || membershipSignature(nextMemberships) === membershipSignature(memberships)) return;

        const activeId = activeRestaurantIdRef.current;
        const activeMembership = activeMembershipForRestaurant(nextMemberships, activeId);
        if (activeId && !activeMembership) {
          sessionRequestIdRef.current += 1;
          switchRequestIdRef.current += 1;
          posRequestIdRef.current += 1;
          activeRestaurantIdRef.current = null;
          setRestaurant(null);
          setAvailableRestaurants([]);
          setMemberships([]);
          setRole(null);
          setUser(appUserFromAuth(authUser, null, null));
          clearPosStatus();
          await saveSnapshot({ activeRestaurantId: null, isDemoMode: false });
          if (!mounted) return;
        }

        await hydrateSupabaseUser(authUser, activeMembership?.restaurant_id ?? null);
      } catch (error) {
        captureMiseError(error, { flow: "membership_revalidation" });
      } finally {
        refreshing = false;
      }
    };

    const unsubscribeDenials = subscribeToTenantAuthorizationDenials(() => {
      void revalidateLiveMemberships();
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void revalidateLiveMemberships();
    });
    const interval = setInterval(() => {
      void revalidateLiveMemberships();
    }, 10_000);

    return () => {
      mounted = false;
      clearInterval(interval);
      appStateSubscription.remove();
      unsubscribeDenials();
    };
  }, [authUser, clearPosStatus, hydrateSupabaseUser, memberships, saveSnapshot]);

  const continueWithDemo = useCallback(
    async (profile?: { name?: string; cuisine_type?: string; posProvider?: PosProvider } & DemoSetupProfile) => {
      if (!demoModeAvailable) {
        throw new Error("Demo mode is not enabled for this build.");
      }
      const sessionRequestId = ++sessionRequestIdRef.current;
      setIsLoading(true);
      const nextRestaurant = await loadDemoPOSData(
        profile?.posProvider ?? posProvider ?? DEMO_DATASET.defaultPosProvider,
        profile
      );
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      const finalRestaurant =
        profile?.name || profile?.cuisine_type
          ? await updateRestaurantProfile(nextRestaurant.id, {
              name: profile.name?.trim() || nextRestaurant.name,
              cuisine_type: profile.cuisine_type?.trim() || nextRestaurant.cuisine_type
            })
          : nextRestaurant;
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      const demoUser: AppUser = {
        id: DEMO_USER_ID,
        restaurant_id: finalRestaurant.id,
        name: DEMO_DATASET.user.name,
        email: DEMO_DATASET.user.email,
        role: "owner",
        created_at: new Date().toISOString()
      };
      const demoMembership: RestaurantMembership = {
        id: `membership_${DEMO_USER_ID}`,
        restaurant_id: finalRestaurant.id,
        user_id: DEMO_USER_ID,
        role: "owner",
        status: "active",
        created_at: demoUser.created_at,
        updated_at: demoUser.created_at
      };
      activeRestaurantIdRef.current = finalRestaurant.id;
      setAuthUser(null);
      setUser(demoUser);
      setRestaurant(finalRestaurant);
      setAvailableRestaurants([finalRestaurant]);
      setMemberships([demoMembership]);
      setRole("owner");
      setIsDemoMode(true);
      await saveSnapshot({ user: demoUser, activeRestaurantId: finalRestaurant.id, isDemoMode: true });
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      await refreshPOS(finalRestaurant.id);
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      setIsLoading(false);
    },
    [posProvider, refreshPOS, saveSnapshot]
  );

  const createRestaurant = useCallback(
    async (profile: { name: string; cuisine_type?: string | null; operational_profile?: RestaurantOperationalProfile }) => {
      if (!authUser) {
        throw new Error("Sign in before creating a restaurant.");
      }
      const nextRestaurant = await createRestaurantWithOwner(profile.name, profile.cuisine_type ?? null);
      if (profile.operational_profile) {
        const updatedRestaurant = await updateRestaurantProfile(nextRestaurant.id, {
          operational_profile: profile.operational_profile,
          service_style: profile.operational_profile.serviceStyle
        });
        await hydrateSupabaseUser(authUser, updatedRestaurant.id);
        return updatedRestaurant;
      }
      await hydrateSupabaseUser(authUser, nextRestaurant.id);
      return nextRestaurant;
    },
    [authUser, hydrateSupabaseUser]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase is not configured. Enable local demo mode for device-only testing.");
      }
      clearPasswordRecovery();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Could not load authenticated user.");
      await hydrateSupabaseUser(data.user);
    },
    [clearPasswordRecovery, hydrateSupabaseUser]
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpOutcome> => {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase is not configured. Enable local demo mode for device-only testing.");
      }
      clearPasswordRecovery();
      const normalizedEmail = normalizeSignupEmail(email);
      if (!isValidSignupEmail(normalizedEmail)) {
        throw new Error("Enter a valid email address.");
      }
      const passwordError = validateSignupPassword(password);
      if (passwordError) throw new Error(passwordError);

      const pendingInviteToken = await readPendingInviteToken();
      const emailRedirectTo = Linking.createURL(
        (pendingInviteToken ? buildInviteClaimPath(pendingInviteToken) : "/").replace(/^\//, "")
      );

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo }
      });
      if (error) throw error;
      if (!data.user) throw new Error("Could not create account.");
      if (isDuplicateAuthIdentity(data.user)) {
        throw new Error("An account with this email already exists. Sign in instead.");
      }

      if (data.session?.user) {
        await hydrateSupabaseUser(data.session.user);
        return { status: "signed_in" };
      }

      return { status: "confirm_email", email: normalizedEmail };
    },
    [clearPasswordRecovery, hydrateSupabaseUser]
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured. Password reset requires cloud auth.");
    }
    const normalizedEmail = normalizeRecoveryEmail(email);
    if (!isValidRecoveryEmail(normalizedEmail)) {
      throw new Error("Enter a valid email address.");
    }
    const redirectTo = Linking.createURL(PASSWORD_RESET_PATH.replace(/^\//, ""));
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    if (error) throw error;
  }, []);

  const completePasswordReset = useCallback(
    async (password: string) => {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase is not configured. Password reset requires cloud auth.");
      }
      const validationError = validateNewPassword(password);
      if (validationError) throw new Error(validationError);
      if (!passwordRecoveryPending) {
        throw new Error("Open the password reset link from your email before setting a new password.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearPasswordRecovery();
    },
    [clearPasswordRecovery, passwordRecoveryPending]
  );

  const switchRestaurant = useCallback(
    async (restaurantId: string) => {
      requireRestaurantAccess(memberships, restaurantId);
      const requestId = ++switchRequestIdRef.current;
      const nextRestaurant = availableRestaurants.find((item) => item.id === restaurantId) ?? await fetchRestaurant(restaurantId);
      if (requestId !== switchRequestIdRef.current) return;
      const membership = activeMembershipForRestaurant(memberships, restaurantId);
      activeRestaurantIdRef.current = nextRestaurant.id;
      setRestaurant(nextRestaurant);
      setRole(membership?.role ?? null);
      if (authUser) {
        setUser(
          appUserFromAuth(
            authUser,
            nextRestaurant.id,
            membership?.role ?? null,
            user?.name
          )
        );
      }
      await refreshPOS(nextRestaurant.id);
      if (requestId !== switchRequestIdRef.current) return;
      await saveSnapshot({ user, activeRestaurantId: nextRestaurant.id, isDemoMode });
    },
    [authUser, availableRestaurants, isDemoMode, memberships, refreshPOS, saveSnapshot, user]
  );

  const connectDemoPOS = useCallback(
    async (provider: PosProvider) => {
      if (!isDemoMode) {
        throw new Error("Demo POS data is only available in local demo mode.");
      }
      const sessionRequestId = ++sessionRequestIdRef.current;
      const nextRestaurant = await loadDemoPOSData(
        provider,
        isDemoDatasetRestaurantName(restaurant?.name) ? { preset: DEMO_DATASET.id } : undefined
      );
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      activeRestaurantIdRef.current = nextRestaurant.id;
      setRestaurant(nextRestaurant);
      await saveSnapshot({ user, activeRestaurantId: nextRestaurant.id, isDemoMode: true });
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      await refreshPOS(nextRestaurant.id);
    },
    [isDemoMode, refreshPOS, restaurant?.name, saveSnapshot, user]
  );

  const refreshPosStatus = useCallback(async () => {
    const expectedRestaurantId = activeRestaurantIdRef.current;
    const requestId = ++posRequestIdRef.current;
    if (posStatusRestaurantIdRef.current !== expectedRestaurantId) {
      clearPosStatus();
    }
    try {
      const status = await fetchPOSStatus(expectedRestaurantId);
      if (
        requestId !== posRequestIdRef.current ||
        activeRestaurantIdRef.current !== expectedRestaurantId
      ) {
        return;
      }
      settlePosStatus(expectedRestaurantId, {
        provider: status.provider,
        label: status.label
      });
    } catch (error) {
      if (
        requestId !== posRequestIdRef.current ||
        activeRestaurantIdRef.current !== expectedRestaurantId
      ) {
        return;
      }
      settlePosStatus(expectedRestaurantId, null, true);
      throw error;
    }
  }, [clearPosStatus, settlePosStatus]);

  const refreshSession = useCallback(async () => {
    if (authUser && isSupabaseConfigured) {
      await hydrateSupabaseUser(authUser, activeRestaurantIdRef.current);
      return;
    }
    if (isDemoMode) {
      await hydrateLocalDemo({
        user,
        activeRestaurantId: activeRestaurantIdRef.current,
        isDemoMode: true
      });
    }
  }, [authUser, hydrateLocalDemo, hydrateSupabaseUser, isDemoMode, user]);

  const applyOperatorDisplayName = useCallback(
    async (name: string) => {
      const normalized = resolveOperatorDisplayName(name, user?.email ?? null);
      if (!user) {
        setUser({
          id: authUser?.id ?? DEMO_USER_ID,
          restaurant_id: activeRestaurantIdRef.current,
          name: normalized,
          email: authUser?.email ?? DEMO_DATASET.user.email,
          role: role ?? "staff",
          created_at: authUser?.created_at ?? new Date().toISOString()
        });
        return;
      }

      const nextUser: AppUser = {
        ...user,
        restaurant_id: activeRestaurantIdRef.current,
        name: normalized
      };
      setUser(nextUser);
      await saveSnapshot({
        user: isDemoMode ? nextUser : undefined,
        activeRestaurantId: activeRestaurantIdRef.current,
        isDemoMode
      });
    },
    [authUser, isDemoMode, role, saveSnapshot, user]
  );

  const applyRestaurantProfile = useCallback(
    async (nextRestaurant: Restaurant) => {
      activeRestaurantIdRef.current = nextRestaurant.id;
      setRestaurant(nextRestaurant);
      setAvailableRestaurants((current) => {
        const exists = current.some((entry) => entry.id === nextRestaurant.id);
        if (!exists) return [nextRestaurant, ...current];
        return current.map((entry) => (entry.id === nextRestaurant.id ? nextRestaurant : entry));
      });
      if (user) {
        const nextUser: AppUser = {
          ...user,
          restaurant_id: nextRestaurant.id
        };
        setUser(nextUser);
        await saveSnapshot({
          user: isDemoMode ? nextUser : undefined,
          activeRestaurantId: nextRestaurant.id,
          isDemoMode
        });
        return;
      }
      await saveSnapshot({
        user: undefined,
        activeRestaurantId: nextRestaurant.id,
        isDemoMode
      });
    },
    [isDemoMode, saveSnapshot, user]
  );

  const resetDemoData = useCallback(async (profile?: { posProvider?: PosProvider } & DemoSetupProfile) => {
    if (!isDemoMode) {
      throw new Error("Demo reset is only available in local demo mode.");
    }
    const sessionRequestId = ++sessionRequestIdRef.current;
    const nextRestaurant = await resetDemoService(
      profile?.posProvider ?? posProvider ?? DEMO_DATASET.defaultPosProvider,
      profile
    );
    if (sessionRequestId !== sessionRequestIdRef.current) return;
    activeRestaurantIdRef.current = nextRestaurant.id;
    setRestaurant(nextRestaurant);
    await saveSnapshot({ user, activeRestaurantId: nextRestaurant.id, isDemoMode: true });
    if (sessionRequestId !== sessionRequestIdRef.current) return;
    await refreshPOS(nextRestaurant.id);
  }, [isDemoMode, posProvider, refreshPOS, saveSnapshot, user]);

  const signOut = useCallback(async () => {
    clearPasswordRecovery();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    await clearSessionState();
  }, [clearPasswordRecovery, clearSessionState]);

  const clearLocalSessionAfterAccountDeletion = useCallback(async () => {
    clearPasswordRecovery();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          captureMiseError(error, {
            flow: "session",
            operation: "sign_out_after_account_deletion"
          });
        }
      } catch (remoteSignOutError) {
        captureMiseError(remoteSignOutError, {
          flow: "session",
          operation: "sign_out_after_account_deletion"
        });
      }
    }
    await clearSessionState();
  }, [clearPasswordRecovery, clearSessionState]);

  const value = useMemo<MiseSessionContextValue>(
    () => ({
      ready,
      isLoading,
      user,
      authUser,
      restaurant,
      activeRestaurantId,
      activeRestaurant: restaurant,
      availableRestaurants,
      memberships,
      role,
      posProvider,
      posStatusLabel,
      posStatusRestaurantId,
      posStatusError,
      isDemoMode,
      usingLocalDemo: isDemoMode,
      canUseDemoMode: demoModeAvailable,
      passwordRecoveryPending,
      passwordRecoveryLinkError,
      signIn,
      signUp,
      requestPasswordReset,
      completePasswordReset,
      clearPasswordRecovery,
      clearPasswordRecoveryLinkError,
      continueWithDemo,
      createRestaurant,
      switchRestaurant,
      connectDemoPOS,
      refreshPosStatus,
      refreshSession,
      applyOperatorDisplayName,
      applyRestaurantProfile,
      resetDemoData,
      signOut,
      clearLocalSessionAfterAccountDeletion
    }),
    [
      activeRestaurantId,
      applyOperatorDisplayName,
      applyRestaurantProfile,
      authUser,
      availableRestaurants,
      clearLocalSessionAfterAccountDeletion,
      clearPasswordRecovery,
      clearPasswordRecoveryLinkError,
      completePasswordReset,
      continueWithDemo,
      createRestaurant,
      connectDemoPOS,
      isDemoMode,
      isLoading,
      memberships,
      passwordRecoveryLinkError,
      passwordRecoveryPending,
      posProvider,
      posStatusLabel,
      posStatusRestaurantId,
      posStatusError,
      ready,
      refreshPosStatus,
      refreshSession,
      requestPasswordReset,
      restaurant,
      resetDemoData,
      role,
      signIn,
      signUp,
      signOut,
      switchRestaurant,
      user
    ]
  );

  return <MiseSessionContext.Provider value={value}>{children}</MiseSessionContext.Provider>;
}

export function useMiseSession() {
  const context = useContext(MiseSessionContext);
  if (!context) {
    throw new Error("useMiseSession must be used inside MiseSessionProvider");
  }
  return context;
}
