/**
 * Deterministic purchasing policy helpers for lead time and minimum order quantity.
 * Defaults of zero preserve pre-tip recommendation behavior.
 */

export function finiteNonNegativePolicyNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

export function normalizeLeadTimeDays(value: unknown): number {
  const numeric = finiteNonNegativePolicyNumber(value, 0);
  const whole = Math.floor(numeric);
  return Math.min(365, whole);
}

export function normalizeMinimumOrderQuantity(value: unknown, maximum = 1_000_000): number {
  const numeric = finiteNonNegativePolicyNumber(value, 0);
  return Math.min(maximum, numeric);
}

/**
 * When a positive shortfall exists, raise the order to the configured MOQ.
 * Zero/negative suggestions stay zero — MOQ never invents an order on its own.
 */
export function applyMinimumOrderQuantity(
  suggestedQuantity: number,
  minimumOrderQuantity: number
): number {
  const suggested = finiteNonNegativePolicyNumber(suggestedQuantity, 0);
  const moq = normalizeMinimumOrderQuantity(minimumOrderQuantity);
  if (suggested <= 0) return 0;
  if (moq <= 0) return suggested;
  return Math.max(suggested, moq);
}

/**
 * True when projected coverage cannot survive the supplier lead time.
 * Lead time of 0 disables this gate (unknown / same-day delivery).
 */
export function coverageWithinLeadTime(
  daysCoverage: number | null | undefined,
  leadTimeDays: number
): boolean {
  const lead = normalizeLeadTimeDays(leadTimeDays);
  if (lead <= 0) return false;
  if (daysCoverage === null || daysCoverage === undefined || !Number.isFinite(daysCoverage)) {
    return false;
  }
  return daysCoverage <= lead;
}
