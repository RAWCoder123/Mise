import * as QueryParams from "expo-auth-session/build/QueryParams";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export type AuthOAuthProvider = "google" | "apple";

export function getAuthRedirectTo() {
  return makeRedirectUri({
    scheme: "mise",
    path: "auth/callback"
  });
}

export function isMiseAuthCallbackUrl(url: string) {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? "").replace(/^\//, "");
    if (path === "auth/callback" || path.endsWith("auth/callback")) return true;
  } catch {
    // Fall through to string checks for partial deep links.
  }
  return (
    url.includes("/auth/callback") ||
    url.startsWith("mise://auth/callback") ||
    url.includes("--/auth/callback")
  );
}

/** Exchange an OAuth redirect URL for a Supabase session (PKCE or implicit tokens). */
export async function createSessionFromUrl(url: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Enable local demo mode for device-only testing.");
  }

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) {
    return existing.session;
  }

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  const accessToken = typeof params.access_token === "string" ? params.access_token : null;
  const refreshToken = typeof params.refresh_token === "string" ? params.refresh_token : null;
  const code = typeof params.code === "string" ? params.code : null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) throw error;
    return data.session;
  }

  return null;
}

/**
 * Start Google/Apple OAuth for Expo native and web.
 * Invite-only admission still applies: new accounts are not created when signup is disabled.
 */
export async function signInWithOAuthProvider(provider: AuthOAuthProvider) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Enable local demo mode for device-only testing.");
  }

  const redirectTo = getAuthRedirectTo();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== "web"
    }
  });
  if (error) throw error;

  if (Platform.OS === "web") {
    // Browser navigates to the provider; session completes on /auth/callback.
    return;
  }

  if (!data.url) {
    throw new Error("OAuth provider did not return an authorization URL.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    if (result.type === "cancel" || result.type === "dismiss") {
      return;
    }
    throw new Error("OAuth sign-in did not complete.");
  }

  await createSessionFromUrl(result.url);
}
