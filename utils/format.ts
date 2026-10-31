export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatCompactCurrency(value: number) {
  if (Math.abs(value) < 1000) return formatCurrency(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Restaurant-local calendar day for operating-date math.
 *
 * Invalid, empty, or Unicode-padded IANA names must fail closed. Falling back
 * to the UTC calendar day invents the wrong operating date near timezone
 * boundaries (for example Asia/Tokyo Nov 1 vs UTC Oct 31). Do not Unicode-trim
 * into a clean IANA identity — Intl validates the raw value, matching waste
 * analysis / supplier reliability and the domain timezone fail-closed tips.
 */
export function toDateKeyInTimeZone(date: Date, timeZone: string) {
  requireOperatingDateTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = values.get("year");
    const month = values.get("month");
    const day = values.get("day");
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // requireOperatingDateTimeZone already validated the IANA name. Incomplete
    // formatToParts results must not invent a UTC calendar day.
  }
  throw new Error("Operating date requires a valid restaurant timezone.");
}

function requireOperatingDateTimeZone(timeZone: string) {
  if (!timeZone.trim()) {
    throw new Error("Operating date requires a restaurant timezone.");
  }
  try {
    // Validate the raw IANA value. Do not Unicode-trim into a clean identity —
    // padding that survives emptiness checks must fail closed, not invent UTC.
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new Error("Operating date requires a valid restaurant timezone.");
  }
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? new Date(`${dateKey}T12:00:00.000Z`)
    : null;
  if (!parsed || !Number.isFinite(parsed.getTime())) return dateKey;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateKey(parsed);
}

export function nextDateKeyInTimeZone(date: Date, timeZone: string) {
  return addDaysToDateKey(toDateKeyInTimeZone(date, timeZone), 1);
}

export function humanDate(dateKey: string | null) {
  if (!dateKey) return "Not set";
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}
