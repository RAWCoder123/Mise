import type { MessageKey } from "../../i18n/catalog";

/**
 * Known TodaySummary / Daily Report `miseStatus` strings that may appear as
 * badges. Only these exact values are localized; anything else is shown as-is
 * so the UI never invents operational facts.
 */

/** Exact monitoring copy currently emitted by `buildTodaySummary` in miseDomain. */
export const MISE_STATUS_MONITORING_EN =
  "Mise is monitoring today's sales, inventory levels, and ordering patterns." as const;

const KNOWN_STATUS_KEYS = {
  Ready: "dailyReport.miseStatus.ready",
  Watch: "dailyReport.miseStatus.watch",
  Attention: "dailyReport.miseStatus.attention",
  [MISE_STATUS_MONITORING_EN]: "dailyReport.miseStatus.monitoring"
} as const satisfies Record<string, MessageKey>;

export function miseStatusLabelKey(status: string): MessageKey | null {
  if (Object.prototype.hasOwnProperty.call(KNOWN_STATUS_KEYS, status)) {
    return KNOWN_STATUS_KEYS[status as keyof typeof KNOWN_STATUS_KEYS];
  }
  return null;
}

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function presentMiseStatusLabel(status: string, t: Translate): string {
  const key = miseStatusLabelKey(status);
  if (key) return t(key);
  const trimmed = status.trim();
  return trimmed || "—";
}
