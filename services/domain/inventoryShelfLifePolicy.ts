/**
 * Deterministic shelf-life policy helpers for perishable inventory.
 * Defaults of zero preserve pre-tip coverage copy and overstock heuristics.
 */

export function finiteNonNegativePolicyNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

/** Whole days of usable life after receipt. 0 means unknown / not configured. */
export function normalizeShelfLifeDays(value: unknown): number {
  const numeric = finiteNonNegativePolicyNumber(value, 0);
  const whole = Math.floor(numeric);
  return Math.min(3650, whole);
}

/**
 * True when projected coverage exceeds the configured shelf life.
 * Shelf life of 0 disables this gate so dry goods keep the generic heuristic.
 */
export function coverageExceedsShelfLife(
  daysCoverage: number | null | undefined,
  shelfLifeDays: number
): boolean {
  const shelfLife = normalizeShelfLifeDays(shelfLifeDays);
  if (shelfLife <= 0) return false;
  if (daysCoverage === null || daysCoverage === undefined || !Number.isFinite(daysCoverage)) {
    return false;
  }
  return daysCoverage > shelfLife;
}
