import "react-native-url-polyfill/auto";

import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { colors, fontFamilies } from "../constants/theme";
import { LocaleProvider } from "../contexts/LocaleContext";
import { MiseSessionProvider } from "../contexts/MiseSessionContext";
import { hostedLocalePreferenceAdapter } from "../services/localePreferences";
import { initMiseTelemetry } from "../services/telemetry";

// Initialize before first render so the error boundary and session context can
// report from startup. No-op (zero network calls) when telemetry env is absent.
initMiseTelemetry();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold
  });

  useWebAppStyles();

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <MiseSessionProvider>
          <LocaleProvider hostedPreferenceAdapter={hostedLocalePreferenceAdapter}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="inventory/[id]" />
              <Stack.Screen name="inventory/count" />
              <Stack.Screen name="orders/[id]" />
              <Stack.Screen name="more/create-task" />
              <Stack.Screen name="more/log-delivery" />
              <Stack.Screen name="more/scan-item" />
              <Stack.Screen name="more/daily-report" />
              <Stack.Screen name="more/daily-brief" />
              <Stack.Screen name="more/waste" />
              <Stack.Screen name="more/activity" />
              <Stack.Screen name="more/operational-issues" />
              <Stack.Screen name="more/restaurant-memory" />
              <Stack.Screen name="settings/pos" />
              <Stack.Screen name="settings/pos-mappings" />
              <Stack.Screen name="settings/recipes" />
              <Stack.Screen name="settings/language" />
              <Stack.Screen name="settings/gmail" />
              <Stack.Screen name="settings/suppliers" />
              <Stack.Screen name="settings/autonomy" />
            </Stack>
            <StatusBar style="dark" />
          </LocaleProvider>
        </MiseSessionProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

function useWebAppStyles() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const style = document.createElement("style");
    style.setAttribute("data-mise-web-styles", "true");
    style.textContent = `
      html, body, #root {
        background: ${colors.canvas};
        font-family: ${fontFamilies.body}, Inter, system-ui, sans-serif;
      }

      *:focus-visible {
        outline: 3px solid ${colors.accent} !important;
        outline-offset: 2px !important;
      }

      input:focus-visible,
      textarea:focus-visible {
        outline-offset: 0 !important;
      }
    `;
    document.head.appendChild(style);

    return () => style.remove();
  }, []);
}
