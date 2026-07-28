import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { canUseDemoMode as canUseDemoModeForConfig, readPublicAppConfig } from "../lib/appConfig";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type {
  AppUser,
  PosProvider,
  Restaurant,
  RestaurantMembership,
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
  fetchMembershipsForAuthUser,
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
  isDemoMode: boolean;
  usingLocalDemo: boolean;
  canUseDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  continueWithDemo: (profile?: { name?: string; cuisine_type?: string; posProvider?: PosProvider } & DemoSetupProfile) => Promise<void>;
  switchRestaurant: (restaurantId: string) => Promise<void>;
  connectDemoPOS: (provider: PosProvider) => Promise<void>;
  resetDemoData: (profile?: { posProvider?: PosProvider } & DemoSetupProfile) => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = "mise:session:v2";
const appConfig = readPublicAppConfig();
const demoModeAvailable = canUseDemoModeForConfig(appConfig) && !isSupabaseConfigured;

const MiseSessionContext = createContext<MiseSessionContextValue | null>(null);

function appUserFromAuth(
  authUser: SupabaseUser,
  restaurantId: string | null,
  role: RestaurantRole | null
): AppUser {
  const email = authUser.email ?? "";
  return {
    id: authUser.id,
    restaurant_id: restaurantId,
    name: email.split("@")[0] || "Restaurant Operator",
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
  const activeRestaurantIdRef = useRef<string | null>(null);
  const userRef = useRef<AppUser | null>(null);
  const isDemoModeRef = useRef(false);
  const posRequestIdRef = useRef(0);
  const switchRequestIdRef = useRef(0);
  const sessionRequestIdRef = useRef(0);
  const storageQueueRef = useRef<Promise<void>>(Promise.resolve());

  const activeRestaurantId = restaurant?.id ?? null;
  activeRestaurantIdRef.current = activeRestaurantId;
  userRef.current = user;
  isDemoModeRef.current = isDemoMode;

  const refreshPOS = useCallback(async (restaurantId?: string | null) => {
    const expectedRestaurantId = restaurantId ?? null;
    const requestId = ++posRequestIdRef.current;
    const status = await fetchPOSStatus(expectedRestaurantId);
    if (
      requestId !== posRequestIdRef.current ||
      activeRestaurantIdRef.current !== expectedRestaurantId
    ) return;
    setPosProvider(status.provider);
    setPosStatusLabel(status.label);
  }, []);

  const saveSnapshot = useCallback(async (snapshot: SessionSnapshot) => {
    const write = storageQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)));
    storageQueueRef.current = write;
    await write;
  }, []);

  const clearSessionState = useCallback(async () => {
    sessionRequestIdRef.current += 1;
    switchRequestIdRef.current += 1;
    posRequestIdRef.current += 1;
    activeRestaurantIdRef.current = null;
    setUser(null);
    setAuthUser(null);
    setRestaurant(null);
    setAvailableRestaurants([]);
    setMemberships([]);
    setRole(null);
    setIsDemoMode(false);
    setPosProvider(null);
    setPosStatusLabel("Not connected");
    const removal = storageQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.removeItem(STORAGE_KEY));
    storageQueueRef.current = removal;
    await removal;
  }, []);

  const hydrateSupabaseUser = useCallback(
    async (nextAuthUser: SupabaseUser, preferredRestaurantId?: string | null) => {
      const sessionRequestId = ++sessionRequestIdRef.current;
      setIsLoading(true);
      setAuthUser(nextAuthUser);
      setIsDemoMode(false);

      const nextMemberships = await fetchMembershipsForAuthUser(nextAuthUser.id);
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      setMemberships(nextMemberships);

      if (nextMemberships.length === 0) {
        activeRestaurantIdRef.current = null;
        setRestaurant(null);
        setAvailableRestaurants([]);
        setRole(null);
        setUser(appUserFromAuth(nextAuthUser, null, null));
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
      setUser(appUserFromAuth(nextAuthUser, activeRestaurant?.id ?? null, activeMembership.role));
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
      const nextRestaurant = await fetchRestaurant(restaurantId);
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      const demoUser: AppUser =
        snapshot?.user ?? {
          id: DEMO_USER_ID,
          restaurant_id: DEMO_RESTAURANT_ID,
          name: DEMO_DATASET.user.name,
          email: DEMO_DATASET.user.email,
          role: "owner",
          created_at: new Date().toISOString()
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

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
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
  }, [clearSessionState, hydrateLocalDemo, hydrateSupabaseUser]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUser) return;
    const client = supabase;

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
          setPosProvider(null);
          setPosStatusLabel("Not connected");
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
    // Primary signal: Realtime events on the caller's own membership rows
    // (RLS-scoped; restaurant_memberships is the only table in the
    // supabase_realtime publication). Grants, role changes, and revocations
    // apply within seconds instead of waiting for a poll.
    const membershipChannel = client
      .channel(`restaurant-memberships:${authUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_memberships",
          filter: `user_id=eq.${authUser.id}`
        },
        () => void revalidateLiveMemberships()
      )
      .subscribe((status) => {
        // Recover missed events after a dropped socket reconnects.
        if (status === "SUBSCRIBED") void revalidateLiveMemberships();
      });
    // Safety net in case the Realtime socket silently degrades.
    const interval = setInterval(() => {
      void revalidateLiveMemberships();
    }, 300_000);

    return () => {
      mounted = false;
      clearInterval(interval);
      void client.removeChannel(membershipChannel);
      appStateSubscription.remove();
      unsubscribeDenials();
    };
  }, [authUser, hydrateSupabaseUser, memberships, saveSnapshot]);

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

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase is not configured. Enable local demo mode for device-only testing.");
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Could not load authenticated user.");
      await hydrateSupabaseUser(data.user);
    },
    [hydrateSupabaseUser]
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
      if (authUser) setUser(appUserFromAuth(authUser, nextRestaurant.id, membership?.role ?? null));
      await refreshPOS(nextRestaurant.id);
      if (requestId !== switchRequestIdRef.current) return;
      await saveSnapshot({
        user: userRef.current,
        activeRestaurantId: nextRestaurant.id,
        isDemoMode: isDemoModeRef.current
      });
    },
    [authUser, availableRestaurants, memberships, refreshPOS, saveSnapshot]
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
      await saveSnapshot({
        user: userRef.current,
        activeRestaurantId: nextRestaurant.id,
        isDemoMode: true
      });
      if (sessionRequestId !== sessionRequestIdRef.current) return;
      await refreshPOS(nextRestaurant.id);
    },
    [isDemoMode, refreshPOS, restaurant?.name, saveSnapshot]
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
    await saveSnapshot({
      user: userRef.current,
      activeRestaurantId: nextRestaurant.id,
      isDemoMode: true
    });
    if (sessionRequestId !== sessionRequestIdRef.current) return;
    await refreshPOS(nextRestaurant.id);
  }, [isDemoMode, posProvider, refreshPOS, saveSnapshot]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    await clearSessionState();
  }, [clearSessionState]);

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
      isDemoMode,
      usingLocalDemo: isDemoMode,
      canUseDemoMode: demoModeAvailable,
      signIn,
      continueWithDemo,
      switchRestaurant,
      connectDemoPOS,
      resetDemoData,
      signOut
    }),
    [
      activeRestaurantId,
      authUser,
      availableRestaurants,
      connectDemoPOS,
      continueWithDemo,
      isDemoMode,
      isLoading,
      memberships,
      posProvider,
      posStatusLabel,
      ready,
      restaurant,
      resetDemoData,
      role,
      signIn,
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
