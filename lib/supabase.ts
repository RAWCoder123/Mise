import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { isProductionApp } from "./appConfig";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && !isProductionApp() && shouldWarnMissingSupabaseConfig()) {
  console.warn("Mise is running without Supabase public env vars. Cloud auth and persistence are disabled.");
}

function shouldWarnMissingSupabaseConfig() {
  const warningKey = "mise:missing-supabase-env-warning";
  const globalWarningState = globalThis as typeof globalThis & { __miseMissingSupabaseEnvWarned?: boolean };

  if (typeof sessionStorage === "undefined") {
    if (globalWarningState.__miseMissingSupabaseEnvWarned) return false;
    globalWarningState.__miseMissingSupabaseEnvWarned = true;
    return true;
  }

  try {
    if (sessionStorage.getItem(warningKey) === "shown") return false;
    sessionStorage.setItem(warningKey, "shown");
  } catch {
    if (globalWarningState.__miseMissingSupabaseEnvWarned) return false;
    globalWarningState.__miseMissingSupabaseEnvWarned = true;
  }

  return true;
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;
