import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import { isProductionApp } from "./appConfig";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const missingSupabaseWarningState = globalThis as typeof globalThis & {
  __miseMissingSupabaseEnvWarned?: boolean;
};

if (!isSupabaseConfigured && !isProductionApp() && !missingSupabaseWarningState.__miseMissingSupabaseEnvWarned) {
  missingSupabaseWarningState.__miseMissingSupabaseEnvWarned = true;
  console.warn("Mise is running without Supabase public env vars. Cloud auth and persistence are disabled.");
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
        flowType: "pkce"
      }
    })
  : null;
