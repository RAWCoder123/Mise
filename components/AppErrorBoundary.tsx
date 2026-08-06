import { Component, type ErrorInfo, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import { StyleSheet, Text, View } from "react-native";

import { colors, typography } from "../constants/theme";
import {
  DEFAULT_LOCALE,
  detectDeviceLocale,
  matchSupportedLocale,
  translate,
  type AppLocale
} from "../i18n/catalog";
import { captureMiseError } from "../services/telemetry";
import { Button } from "./ui/Button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureMiseError(error, {
      boundary: "root",
      component_stack: info.componentStack
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const locale = resolveBoundaryLocale();

    return (
      <View style={styles.shell}>
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.panel}>
          <Text accessibilityRole="header" style={styles.title}>{translate(locale, "appError.title")}</Text>
          <Text style={styles.copy}>{translate(locale, "appError.body")}</Text>
          <Button
            accessibilityLabel={translate(locale, "appError.retry")}
            accessibilityHint={translate(locale, "appError.retryHint")}
            title={translate(locale, "appError.retry")}
            onPress={() => this.setState({ hasError: false })}
            fullWidth
          />
        </View>
      </View>
    );
  }
}

/**
 * The root boundary sits outside LocaleProvider, so it cannot use React
 * context. Keep locale detection defensive: a failing native localization
 * module must never prevent the recovery UI from rendering.
 */
function resolveBoundaryLocale(): AppLocale {
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
    // Continue to the runtime locale fallback below.
  }

  try {
    return detectDeviceLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.canvas,
    padding: 20,
    justifyContent: "center"
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18
  },
  title: {
    color: colors.text,
    ...typography.screenTitle
  },
  copy: {
    marginTop: 8,
    marginBottom: 16,
    color: colors.muted,
    ...typography.body
  }
});
