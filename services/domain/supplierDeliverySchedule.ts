/**
 * Deterministic supplier delivery-schedule helpers.
 * Empty delivery days and a null cutoff preserve pre-tip recommendation behavior.
 * Weekdays use JavaScript Date numbering: 0 = Sunday … 6 = Saturday.
 */

export type SupplierWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface SupplierDeliverySchedule {
  deliveryDays: readonly SupplierWeekday[];
  /** Local restaurant minutes from midnight. Null means unknown / unset. */
  orderCutoffMinutes: number | null;
}

export function finiteNonNegativeScheduleNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

export function normalizeDeliveryDays(value: unknown): SupplierWeekday[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<SupplierWeekday>();
  for (const entry of value) {
    const numeric = typeof entry === "number" ? entry : Number(entry);
    if (!Number.isFinite(numeric)) continue;
    const whole = Math.floor(numeric);
    if (whole < 0 || whole > 6) continue;
    unique.add(whole as SupplierWeekday);
  }
  return [...unique].sort((left, right) => left - right);
}

export function normalizeOrderCutoffMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  const whole = Math.floor(numeric);
  if (whole < 0 || whole > 1439) return null;
  return whole;
}

export function parseOrderCutoffInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

export function formatOrderCutoffMinutes(value: number | null | undefined): string {
  const minutes = normalizeOrderCutoffMinutes(value);
  if (minutes === null) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function normalizeSupplierDeliverySchedule(input: {
  delivery_days?: unknown;
  deliveryDays?: unknown;
  order_cutoff_minutes?: unknown;
  orderCutoffMinutes?: unknown;
}): SupplierDeliverySchedule {
  return {
    deliveryDays: normalizeDeliveryDays(input.delivery_days ?? input.deliveryDays),
    orderCutoffMinutes: normalizeOrderCutoffMinutes(
      input.order_cutoff_minutes ?? input.orderCutoffMinutes
    )
  };
}

/**
 * Weekday for a restaurant operating-date key (YYYY-MM-DD). Uses UTC noon so the
 * calendar day is stable regardless of the caller's local offset.
 */
export function weekdayFromOperatingDate(operatingDate: string): SupplierWeekday | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operatingDate)) return null;
  const parsed = new Date(`${operatingDate}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.getUTCDay() as SupplierWeekday;
}

export function localMinutesInTimeZone(now: Date, timeZone: string | null | undefined): number | null {
  if (!timeZone || typeof timeZone !== "string" || !timeZone.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const hour = Number(values.get("hour"));
    const minute = Number(values.get("minute"));
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

export function isPastOrderCutoff(input: {
  operatingWeekday: SupplierWeekday;
  deliveryDays: readonly SupplierWeekday[];
  orderCutoffMinutes: number | null;
  localMinutes: number | null;
}): boolean {
  const days = normalizeDeliveryDays(input.deliveryDays);
  if (!days.includes(input.operatingWeekday)) return false;
  const cutoff = normalizeOrderCutoffMinutes(input.orderCutoffMinutes);
  if (cutoff === null || input.localMinutes === null) return false;
  return input.localMinutes >= cutoff;
}

/**
 * Days until the next configured delivery day. Returns null when no schedule is set.
 * When today is a delivery day and the order cutoff has already passed, today is skipped.
 */
export function daysUntilNextDelivery(input: {
  operatingDate: string;
  deliveryDays: readonly number[];
  orderCutoffMinutes?: number | null;
  localMinutes?: number | null;
}): number | null {
  const days = normalizeDeliveryDays(input.deliveryDays);
  if (days.length === 0) return null;
  const startWeekday = weekdayFromOperatingDate(input.operatingDate);
  if (startWeekday === null) return null;
  const skipToday = isPastOrderCutoff({
    operatingWeekday: startWeekday,
    deliveryDays: days,
    orderCutoffMinutes: input.orderCutoffMinutes ?? null,
    localMinutes: input.localMinutes ?? null
  });
  for (let offset = 0; offset < 7; offset += 1) {
    if (offset === 0 && skipToday) continue;
    const weekday = ((startWeekday + offset) % 7) as SupplierWeekday;
    if (days.includes(weekday)) return offset;
  }
  return null;
}

/**
 * True when projected coverage cannot survive until the next supplier delivery.
 * An empty schedule disables this gate.
 */
export function coverageMissesNextDelivery(
  daysCoverage: number | null | undefined,
  daysUntilDelivery: number | null
): boolean {
  if (daysUntilDelivery === null) return false;
  if (daysCoverage === null || daysCoverage === undefined || !Number.isFinite(daysCoverage)) {
    return false;
  }
  return daysCoverage <= daysUntilDelivery;
}
