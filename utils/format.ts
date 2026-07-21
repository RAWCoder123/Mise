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

export function toDateKeyInTimeZone(date: Date, timeZone: string) {
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
    return year && month && day ? `${year}-${month}-${day}` : toDateKey(date);
  } catch {
    return toDateKey(date);
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
