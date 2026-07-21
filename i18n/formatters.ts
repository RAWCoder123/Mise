import { translate, type AppLocale } from "./catalog";

export type LocalizedDateInput = Date | number | string;

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  timeZone?: string;
}

export interface RelativeTimeOptions {
  now?: LocalizedDateInput;
  numeric?: Intl.RelativeTimeFormatNumeric;
  style?: Intl.RelativeTimeFormatStyle;
}

export interface DueTimeOptions {
  now?: LocalizedDateInput;
  timeZone?: string;
  dateOptions?: Intl.DateTimeFormatOptions;
}

const INTL_LOCALES: Readonly<Record<AppLocale, string>> = {
  en: "en-US",
  es: "es-ES",
  "zh-Hans": "zh-Hans-CN"
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function intlLocaleFor(locale: AppLocale): string {
  return INTL_LOCALES[locale];
}

export function formatLocalizedNumber(
  locale: AppLocale,
  value: number,
  options: Intl.NumberFormatOptions = {}
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(intlLocaleFor(locale), options).format(value);
}

export function parseLocalizedNumber(locale: AppLocale, input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = new Intl.NumberFormat(intlLocaleFor(locale)).formatToParts(12345.6);
  const group = parts.find((part) => part.type === "group")?.value;
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  let normalized = trimmed.replace(/[\s\u00a0\u202f]/g, "");
  if (group) normalized = normalized.split(group).join("");
  if (decimal !== ".") normalized = normalized.split(decimal).join(".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatLocalizedList(
  locale: AppLocale,
  values: readonly string[],
  options: Intl.ListFormatOptions = {}
): string {
  return new Intl.ListFormat(intlLocaleFor(locale), {
    style: "long",
    type: "conjunction",
    ...options
  }).format(values);
}

export function formatLocalizedCurrency(
  locale: AppLocale,
  value: number,
  currency = "USD",
  options: Omit<Intl.NumberFormatOptions, "style" | "currency"> = {}
): string {
  if (!Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat(intlLocaleFor(locale), {
      style: "currency",
      currency,
      ...options
    }).format(value);
  } catch {
    return new Intl.NumberFormat(intlLocaleFor(locale), {
      style: "currency",
      currency: "USD",
      ...options
    }).format(value);
  }
}

/**
 * Produces a currency value sized for compact KPI surfaces. Some Intl locales
 * (notably Simplified Chinese) do not apply compact notation below 10,000, so
 * the 1,000–9,999 range uses the localized 千 unit instead of overflowing a
 * four-column metric strip.
 */
export function formatLocalizedCompactCurrency(
  locale: AppLocale,
  value: number,
  currency = "USD"
): string {
  if (!Number.isFinite(value)) return "—";

  const commonOptions: Omit<Intl.NumberFormatOptions, "style" | "currency"> = {
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 1
  };

  if (locale === "zh-Hans" && Math.abs(value) >= 1_000 && Math.abs(value) < 10_000) {
    return `${formatLocalizedCurrency(locale, value / 1_000, currency, commonOptions)}千`;
  }

  return formatLocalizedCurrency(locale, value, currency, {
    ...commonOptions,
    notation: "compact",
    compactDisplay: "short"
  });
}

export function formatLocalizedDate(
  locale: AppLocale,
  value: LocalizedDateInput,
  options: DateFormatOptions = {}
): string {
  const date = toValidDate(value);
  if (!date) return "—";

  try {
    return new Intl.DateTimeFormat(intlLocaleFor(locale), options).format(date);
  } catch {
    const { timeZone: _invalidTimeZone, ...safeOptions } = options;
    return new Intl.DateTimeFormat(intlLocaleFor(locale), safeOptions).format(date);
  }
}

export function formatLocalizedRelativeTime(
  locale: AppLocale,
  target: LocalizedDateInput,
  options: RelativeTimeOptions = {}
): string {
  const targetDate = toValidDate(target);
  const now = toValidDate(options.now ?? Date.now());
  if (!targetDate || !now) return "—";

  const { value, unit } = relativeValue(targetDate.getTime() - now.getTime());
  return new Intl.RelativeTimeFormat(intlLocaleFor(locale), {
    numeric: options.numeric ?? "auto",
    style: options.style ?? "long"
  }).format(value, unit);
}

/**
 * Formats operational deadlines using short, scan-friendly labels. Near-term
 * deadlines retain their useful precision; later deadlines collapse to a
 * calendar label in the restaurant timezone.
 */
export function formatLocalizedDueTime(
  locale: AppLocale,
  target: LocalizedDateInput,
  options: DueTimeOptions = {}
): string {
  const targetDate = toValidDate(target);
  const now = toValidDate(options.now ?? Date.now());
  if (!targetDate || !now) return "—";

  const difference = targetDate.getTime() - now.getTime();
  if (difference < 0) {
    if (Math.abs(difference) < MINUTE_MS) return translate(locale, "relative.overdue");
    return translate(locale, "relative.overdueBy", {
      duration: formatLocalizedDuration(locale, Math.abs(difference))
    });
  }

  if (difference < MINUTE_MS) return translate(locale, "relative.dueNow");
  if (difference < 12 * HOUR_MS) {
    return translate(locale, "relative.dueIn", {
      duration: formatLocalizedDuration(locale, difference)
    });
  }

  const dayDifference = calendarDayDifference(now, targetDate, options.timeZone);
  if (dayDifference === 0) return translate(locale, "relative.today");
  if (dayDifference === 1) return translate(locale, "relative.tomorrow");

  return formatLocalizedDate(locale, targetDate, {
    month: "short",
    day: "numeric",
    ...(targetDate.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    ...options.dateOptions,
    timeZone: options.timeZone
  });
}

export function formatLocalizedDuration(locale: AppLocale, milliseconds: number): string {
  const absolute = Math.abs(milliseconds);
  const unit = absolute < HOUR_MS ? "minute" : absolute < DAY_MS ? "hour" : "day";
  const divisor = unit === "minute" ? MINUTE_MS : unit === "hour" ? HOUR_MS : DAY_MS;
  const count = Math.max(1, Math.round(absolute / divisor));
  const plural = new Intl.PluralRules(intlLocaleFor(locale)).select(count) === "one" ? "one" : "other";
  const key = `duration.${unit}.${plural}` as const;

  return translate(locale, key, {
    count: formatLocalizedNumber(locale, count)
  });
}

function relativeValue(difference: number): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const absolute = Math.abs(difference);
  const unit: Intl.RelativeTimeFormatUnit =
    absolute < MINUTE_MS ? "second" : absolute < HOUR_MS ? "minute" : absolute < DAY_MS ? "hour" : "day";
  const divisor = unit === "second" ? 1_000 : unit === "minute" ? MINUTE_MS : unit === "hour" ? HOUR_MS : DAY_MS;
  const magnitude = absolute === 0 ? 0 : Math.max(1, Math.round(absolute / divisor));
  return { value: difference < 0 ? -magnitude : magnitude, unit };
}

function calendarDayDifference(from: Date, to: Date, timeZone?: string): number | null {
  const fromKey = dateKeyInTimeZone(from, timeZone);
  const toKey = dateKeyInTimeZone(to, timeZone);
  if (!fromKey || !toKey) return null;
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

function dateKeyInTimeZone(date: Date, timeZone?: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = values.get("year");
    const month = values.get("month");
    const day = values.get("day");
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function toValidDate(value: LocalizedDateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
