import { translate, type AppLocale, type MessageKey } from "../../i18n/catalog";
import { formatLocalizedDate, formatLocalizedList, formatLocalizedNumber } from "../../i18n/formatters";
import type { ActivityWindowSummary } from "../domain/activityEvents";

export type ActivityWindowSentenceInput = Pick<
  ActivityWindowSummary,
  "since" | "forecastUpdates" | "ordersPrepared" | "staffingRisks" | "routineChecks"
>;

export type PresentActivityWindowOptions = {
  /** Preformatted since label (skips locale time formatting). */
  sinceLabel?: string;
  /** Restaurant timezone for since-clock display. Defaults to UTC. */
  timeZone?: string;
};

const PART_KEYS = {
  forecast: {
    one: "home.activity.window.part.forecast.one",
    other: "home.activity.window.part.forecast.other"
  },
  orders: {
    one: "home.activity.window.part.orders.one",
    other: "home.activity.window.part.orders.other"
  },
  staffing: {
    one: "home.activity.window.part.staffing.one",
    other: "home.activity.window.part.staffing.other"
  },
  routine: {
    one: "home.activity.window.part.routine.one",
    other: "home.activity.window.part.routine.other"
  }
} as const satisfies Record<"forecast" | "orders" | "staffing" | "routine", Record<"one" | "other", MessageKey>>;

/**
 * Locale-aware "since you were away" activity-window sentence.
 *
 * Builds from structured window counts so durable English `sentence` on
 * ActivityWindowSummary can stay audit-stable. Does not invent activity.
 */
export function presentActivityWindowSentence(
  locale: AppLocale,
  summary: ActivityWindowSentenceInput,
  options: PresentActivityWindowOptions = {}
): string {
  const sinceLabel =
    options.sinceLabel?.trim() ||
    formatSinceLabel(locale, summary.since, options.timeZone);

  const parts = buildActivityWindowParts(locale, summary);
  if (parts.length === 0) {
    return translate(locale, "home.activity.window.empty", { since: sinceLabel });
  }

  return translate(locale, "home.activity.window.withParts", {
    since: sinceLabel,
    parts: formatLocalizedList(locale, parts)
  });
}

function formatSinceLabel(locale: AppLocale, sinceIso: string, timeZone?: string): string {
  const trimmed = sinceIso.trim();
  if (!trimmed || !Number.isFinite(Date.parse(trimmed))) {
    return translate(locale, "home.activity.window.since.earlier");
  }

  return formatLocalizedDate(locale, trimmed, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone?.trim() || "UTC"
  });
}

function buildActivityWindowParts(
  locale: AppLocale,
  summary: ActivityWindowSentenceInput
): string[] {
  const parts: string[] = [];

  pushCountedPart(parts, locale, summary.forecastUpdates, "forecast");
  pushCountedPart(parts, locale, summary.ordersPrepared, "orders");
  pushCountedPart(parts, locale, summary.staffingRisks, "staffing");
  pushCountedPart(parts, locale, summary.routineChecks, "routine");

  return parts;
}

function pushCountedPart(
  parts: string[],
  locale: AppLocale,
  count: number,
  kind: keyof typeof PART_KEYS
) {
  if (!Number.isFinite(count) || count <= 0) return;
  const plural = count === 1 ? "one" : "other";
  parts.push(
    translate(locale, PART_KEYS[kind][plural], {
      count: formatLocalizedNumber(locale, count)
    })
  );
}
