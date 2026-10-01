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

export type LanguageSettingsNoticeReason = "saved" | "saveFailed";

export function presentLanguageSettingsNoticeCopy(
  reason: LanguageSettingsNoticeReason,
  copy: Record<LanguageSettingsNoticeReason, { title: string; message: string }>
): { tone: "danger" | "success"; title: string; message: string } {
  const selected = copy[reason] ?? copy.saveFailed;
  return {
    tone: reason === "saved" ? "success" : "danger",
    title: selected.title,
    message: selected.message
  };
}
