export type PreferenceSettingsLoadState = "loading" | "ready" | "error";

export function resolvePreferenceSettingsLoadState(input: {
  sessionReady: boolean;
  ready: boolean;
  loadError: boolean;
}): PreferenceSettingsLoadState {
  if (!input.sessionReady || !input.ready) return "loading";
  if (input.loadError) return "error";
  return "ready";
}

export function presentLanguageSettingsSelection(
  state: PreferenceSettingsLoadState,
  locale: string | null | undefined
): {
  selectedLocale: string | null;
  interactive: boolean;
} {
  if (state === "loading") {
    return { selectedLocale: null, interactive: false };
  }
  return {
    selectedLocale: locale ?? null,
    interactive: state === "ready"
  };
}

export function presentPreferenceSettingsNote(
  state: PreferenceSettingsLoadState,
  copy: {
    loading: string;
    unavailable: string;
    ready: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return copy.ready;
}

export function presentNotificationSettingsSummary(
  state: PreferenceSettingsLoadState,
  mutedCount: number,
  copy: {
    loading: string;
    unavailable: string;
    muted: string;
    persistence: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  if (mutedCount > 0) return copy.muted;
  return copy.persistence;
}

export function presentPreferenceSettingsValuesVisible(
  state: PreferenceSettingsLoadState
): boolean {
  return state === "ready" || state === "error";
}

export function presentPreferenceSettingsInteractive(
  state: PreferenceSettingsLoadState
): boolean {
  return state === "ready";
}
