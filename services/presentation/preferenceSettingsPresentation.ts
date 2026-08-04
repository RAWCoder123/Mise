import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  type OperatorNotificationPreferences
} from "../domain/notificationPreferences";

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

/**
 * Soft-refresh may keep last-known preference values in context for settings
 * RetryNotice UX, but operational muting must fail closed whenever hosted
 * (or any) preference authority is unverified. Otherwise a revoked-tenant or
 * denied soft-load can keep hiding Today tasks behind stale mute state.
 */
export function resolveEffectiveNotificationPreferences(input: {
  preferences: OperatorNotificationPreferences;
  ready: boolean;
  loadError: boolean;
}): OperatorNotificationPreferences {
  if (!input.ready || input.loadError) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
  return normalizeNotificationPreferences(input.preferences);
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

export type LanguageSettingsNoticeReason = "saved" | "saveFailed";
export type NotificationSettingsNoticeReason = "saved" | "saveFailed";

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

export function presentNotificationSettingsNoticeCopy(
  reason: NotificationSettingsNoticeReason,
  copy: Record<NotificationSettingsNoticeReason, { title: string; message: string }>
): { tone: "danger" | "success"; title: string; message: string } {
  const selected = copy[reason] ?? copy.saveFailed;
  return {
    tone: reason === "saved" ? "success" : "danger",
    title: selected.title,
    message: selected.message
  };
}
